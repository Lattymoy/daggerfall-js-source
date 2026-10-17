# AUDIT D1-NEAR (2026-10-12) - the account Worker's place, audited

The owner, of D1-NEAR (`11-Multiplayer/Scale-Arc.md` D1-NEAR: the account Worker taken off Smart Placement, which ran
it in Sydney, and placed by name beside its database's primary; the deploy's report of where it runs - PR #846, at
0263350fb): **"Audit this"**. This page is the findings, each with its verdict. What the audit changed is written into
the record's sections as they now stand, each marked AUDIT D1-NEAR and its id.

## How it was run

Three lanes, each a cold adversarial reader of a FROZEN snapshot (a git worktree at 0263350fb - Home.md's DO NOT FIX
WHILE THE VERIFIER IS READING), each told to verify a finding against the code, Cloudflare's docs or the raw data before
reporting it; then the author's own lane, and every finding checked again by the author before it was acted on:

| Lane | Over | How |
|---|---|---|
| P - the platform | whether `[placement] region` is valid, what it moves, and what in the service depends on where it runs | wrangler 4.149.0's own `normalizeAndValidatePlacement` and `parseConfigPlacement` run over the toml; Cloudflare's placement, cron, D1, Durable Object and API references; a sweep of `server-account/src/` for `request.cf`, the Cache API, per-isolate state, `cf-connecting-ip`; the relay and the client |
| M - the measurement and every claim | the probes' raw outputs, and every number and sentence the slice wrote | the inference re-derived from the raw numbers; every claim in the toml, the record, the D1-LOAD note, the index line, the testing row, the workflow's comment, the test's header and the pull request traced to the data or the code; the Guild tab's statements counted in the code |
| T - the step and the pins | the deploy's report step under the runner's shell, the test, the mutants | the step run under `bash --noprofile --norc -eo pipefail` over REAL curl 8.5 against a local stand-in for both routes, HTTP/1.1 and HTTP/2; 37 scratch mutants of the step and the placement |
| The author | the location inference and the live placement | the bounds re-derived (noise only adds); the live placement read again at 18:02 UTC (`remote-SYD`, 30 of 30); real curl's `-w` on a refused connection and a 503 with and without `-f`; D1's REST reference for what a query's answer says of where it ran |

Nothing failed or harmed. The line is valid wrangler 4 config (it uploads `{"mode":"targeted","region":"aws:us-west-1"}`,
no warning), moves the fetch handler alone, and nothing in the service depends on where it runs; no route that asks the
primary twice or more gets slower for anyone. The findings are a record that said more than its data held - a city
where the data gives a region, "a few ms" where D1's own time is unknown, a statement count one too high - and a report
step that timed answers which never came and held few of its own rules.

## Findings

| # | Sev | Finding | Verdict |
|---|---|---|---|
| M1 | HIGH | The Newark half of the evidence was half reported: probe B's five local reads (281-498 ms) were left out while its Sydney stream was in. The Newark leg is the only thing that rules out East Asia | FIXED: the table carries both probes' rows, each figure labelled by its probe; the place is read by bounds - noise only adds, so the fastest answers bound the distance and a slow one excludes nothing (the lane read B's slow samples as excluding North America; they exclude nothing, and the verdict stands on A's fastest) |
| M2 / P1 | MED | "California (Los Angeles or San Jose)" overclaimed: the bounds give western North America (Sydney's rules out the east of North America and Europe; Newark's fastest, East Asia); Seattle fits as well; the "~70 / ~140-150" were candidate cities' round trips, not measurements | FIXED: western North America in the toml, the record, the index line and the testing row; and D1 is asked for the city - every deploy reads a `SELECT 1`'s `served_by_colo` where `served_by_primary` says the primary served it |
| M3 | MED | "a few ms beside the primary" contradicted the record's own figures, which leave room for D1's own time to be 5 to some 40 ms a statement; the report's caption said it; the Left's "tens of ms" for the Guild tab rested on it | FIXED: the record, the toml and the caption say D1's own time and a short hop; the Guild tab's look by the arithmetic some 0.15-0.9 s, D1's own time deciding; the batching in Left owed or not by `/v1/guilds/mine`'s D1 wait over its statements after the deploy |
| M4 | MED | "Every statement of every route paid the crossing" ignored the reads SCALE4d's and SCALE4g's sessions hand a replica, which may have been answered near Sydney | FIXED: "every statement on the primary"; the replicas and who pays more written into the record |
| M5 | MED | The D1-LOAD note re-explained that record's floor with data taken a day after it, as fact ("the floor was the Worker's place"), double-counted D1's quiet time, said "now" before the deploy, and left the record's row 3 contradicted | FIXED: the note says the crossing was likely part of the floor if the Worker stood in Sydney then, and how much cannot be said; row 3 carries the same |
| M6 | LOW | "Fifteen" statements for the Guild tab's look: thirteen for a member, fourteen for an officer or the guildmaster, fifteen only with the hourly session touch or a succession write; "distance times its statements" where a batch is one trip | FIXED: thirteen or fourteen, some 2-2.5 s; round trips |
| M7 | LOW | The sign-in line's Durable Object put in western North America from one vantage | FIXED: as far from Sydney as the primary, measured from Sydney alone |
| M8 | LOW | Table rows mixed probes without saying so (probe A's median beside probe B's minimum) | FIXED: each figure labelled by its probe; B's slow Sydney health stream set aside, said |
| M9 | LOW | "Every answer says where it ran": 12 of 2,238 carried no `cf-placement`; the header under `region` placement unverified | FIXED: the count written; the report says `none` where an answer carries none |
| M10 | LOW | "Every socket's hello waits on one mint": SCALE2's minter shares one mint among a connect's sockets | FIXED: every connect's hello |
| M11 | LOW | Computed figures written as measured, effects as if deployed | FIXED: bounds and arithmetic said as such; "once it deploys" where it is an effect |
| M12 | LOW | Cloudflare's behaviour stated with no source | FIXED: placement, cron triggers, D1's data location, Durable Objects' data location and D1's API reference cited; why Smart Placement chose Sydney said to be unknown |
| M13 | LOW | "Nobody measured it": the metrics have kept every request's D1 wait (`double5`) since SCALE4f; nobody read it for the Worker's place | FIXED: "nothing said where it ran"; the post-deploy reading named - the D1 wait over the statements by route, `/v1/seats/sieges/live`'s one statement's own |
| P2 | LOW | A player in Oceania or South-East Asia pays about 150 ms more on the few answers that ask the database nothing (and on a read a replica near Sydney served), breaks even on one statement | KEPT: the trade written into the record; every route of two statements or more - nearly every one - is cheaper for everyone |
| P3 | LOW | Beside the primary, the reads SCALE4d's sessions offer a replica may land on the primary itself - the offload it bought may shrink | OPEN: `double7` over `double3` for the mint and the heartbeat, a day either side of the deploy |
| P4 | LOW | Whether Cloudflare's API takes `region` for this account cannot be checked from here, and wrangler confirms no placement | RECORDED: a refusal fails the Deploy step loudly and leaves the old Worker serving; the report says where the new one runs |
| P5 | LOW | "Does not move" said more than the docs: Durable Objects "do not currently change locations", with relocation planned | FIXED: "does not currently move", cited; the deploy's readout says when it has |
| T1 | MED | A failed transfer's time was kept by no pin: curl writes `-w` on a refused connection too, and the test failed both sides at once, so each discard hid the other - kept, a hung read reads "across an ocean", a hung health "beside the primary" | FIXED: two refusals of five on each side, spread so a kept one moves a middle; each side failing whole, the other answering; four mutants |
| T2 | MED | An error answer was timed as a statement: no `-f`, so a 503 (`no-database`, no statement) or the platform's own 500 read as "~0 ms, beside the primary" | FIXED: `-f` on both curls; two 503 reads and two 503 health answers dropped, the cost ~69 ms of 3 and 3, never ~10 |
| T3 | MED | No bound held: the fake ignored `--max-time`, and the step had no `timeout-minutes` - a hang ran to the job's six hours and failed the deploy | FIXED: `continue-on-error: true` and `timeout-minutes: 4` on the step, every curl's `--max-time 10` and the readout's `timeout 60` held |
| T4 | MED | The step's own keys were unpinned: `shell: sh` (dash refuses `set -o pipefail` and fails the deploy) and `if: false` passed | FIXED: the step's keys held exactly |
| T5 | MED | `-o /dev/null` unpinned: the fake wrote no body; without it, a JSON body with no newline glues the `-w` text, and every deploy's cost reads unmeasured | FIXED: the fake writes the body where `-o` sends it; every call's `-o` held |
| T6 | LOW | The order pin passed vacuously when the health step's name was gone (-1 < n), and "before the smoke steps" was unpinned | FIXED: a name asserted present before any order is read; after the health check and before the first smoke step |
| T7 | LOW | The never-fail guards had no mutant records | FIXED: the four guards' records (and the audit's others) |
| T8 | LOW | The sentence pattern's check of the toml was hollow (SCALE1's comment was a paraphrase it cannot read), and it flagged a quote of the retired sentences | FIXED: the toml's comment held as D1-NEAR's; a double-quoted span stands as history. KEPT: the pattern guards the three retired sentences, not every paraphrase - the testing row says so |
| T9 | LOW | The test left a temporary directory holding a fake `curl` on every run | FIXED: the fakes' directory removed when the step returns (`test/d1nearStep.mjs`) |
| T10 | LOW | "Medians of five" said when two answered; "the reads did not answer" when it was the health | FIXED: each side's count said |
| T11 | LOW | The testing row and the record's Pinned overclaimed what the pins held | FIXED: both say what the pins hold |
| A1 | LOW | The author's own: this line takes away the distance, not D1's own queue under load (D1-LOAD's spikes) | RECORDED: the record's Left |
| X1 | - | `/v1/seats/sieges/live` answers before the route's `try`, and `measured` serves outside one: a D1 failure there escapes as Cloudflare's own 500, with no metrics point (lane T, read on the way) | OPEN, not D1-NEAR's: the route's own slice; the report drops such an answer (`-f`) |

## Proof

- `test/bible/audit_d1near.test.js` (6): a pin for every FIXED finding of the step and the records above.
- `test/bible/d1near.test.js` (2), PIN MOVED: the report's run on the hardened step (its fake curl honours `-f`, `-o`, `-D` and
  `--max-time`, and a fake wrangler answers as D1's REST API - `test/d1nearStep.mjs`, shared by both files), its three
  sentences' pattern letting a quote stand, and the toml's comment held as D1-NEAR's.
- `tools/mutants/audit_d1near.json`: 22 mutants, 22 dead - the one first survivor (the health's middle guard, which only
  a health failing whole could reach) killed by the mirrored case. `tools/mutants/d1near.json`'s 9 dead again, its
  summary record re-aimed by content at the block's new last line.
- The live placement read again at 18:02 UTC: `remote-SYD`, 30 answers of 30 - the slice's finding stands until the
  deploy moves it.
