# FIELD BUGS 2026-10-22 - the sign-in failing at midnight UTC, every night, read to its root

The owner (2026-10-22): "Apparently people are having a hard time logging on rn", then "I feel like this happens at
the same time every day", then "The servers are on fire right now. We need to do something" and "Start the real fix".
The live account service and relay were read through their own points (Analytics Engine `daggerfall_accounts` and
`daggerfall_relay`, the columns `tools/d1Load.mjs` and `tools/relayLoad.mjs` read) and D1's own query insights, three
nights running. Read on the code as it stands at main's `66335daa8d`. The account service and the relay are the port's
own (DFU has no server), so no DFU member moves. The pins are `test/net/dayturn.test.js`, the mutants
`tools/mutants/dayturn.json`.

| | Report | What it was | Done |
|---|---|---|---|
| 1 | "a hard time logging on", "the same time every day" | Every page online asked the account service again at 00:00:00 UTC, the moment its day's number changed: the professions' state and the ground's pixels and dungeons, the hall, the town and the seat witnessed once a day. The one database's queue went past what it drains, the retries held it there for two hours and more, and the sign-in's token and the relay's hello failed behind it | DAY-TURN |
| 2 | (found in the same read) | A second hump, 15:00-18:00 UTC most days, as large on 2026-10-20 as midnight's | not traced - open |

## What the live service showed

Each hour's D1 wait (seconds, summed over the hour's asks), its asks answered other than 2xx, and the sign-in's token
asks (`/v1/auth/token`) refused:

| Hour (UTC) | Asks | D1 wait s | Not 2xx | 503 and 429 | Tokens refused | Relay hellos refused |
|---|---|---|---|---|---|---|
| 2026-10-20 23:00 | 676,719 | 531,482 | 34,106 | 3,292 | 1,454 of 18,103 | 7,654 of 41,557 |
| 2026-10-21 00:00 | 656,267 | 2,896,192 | 129,656 | 97,293 | 8,000 of 23,675 | 51,392 of 75,408 |
| 2026-10-21 01:00 | 654,574 | 2,384,241 | 113,762 | 82,617 | 6,494 of 23,405 | 26,068 of 58,174 |
| 2026-10-21 23:00 | 637,440 | 163,992 | 30,833 | 1,712 | 1,263 of 18,309 | 6,633 of 41,901 |
| 2026-10-22 00:00 | 542,593 | 3,132,674 | 168,546 | 141,935 | 12,479 of 24,887 | 69,420 of 78,184 |

A quiet hour waits 50,000-100,000 s; 2026-10-20 00:00 waited 1,711,321. Minute by minute, the last minutes of the day
read `/v1/prof/state` some 60 times a minute and 00:00 read it 3,544 times; `/v1/prof/pixels` went from some 1,250 a
minute to 3,761; the wait went from some 3,000 s a minute to 230,000. D1's own insights put the statements no busier
at 00:05 than at 23:40, each no slower: the time was the queue's, not the queries'. Over 72 hours the refusals the
service said most were `server` 503s on `/v1/homes/town`, `/v1/prof/pixels`, `/v1/homes/yards`,
`/v1/prof/motherlodes`, `/v1/heartbeat`, and the token's own `queue` (47,096) and `server` (45,086). That is a
metastable queue: a burst pushes the wait past the clients' patience, their retries and the next asks arrive into it,
and it stays full long after the burst is gone.

## DAY-TURN (1) - `src/net/dayTurn.js`

Each page chooses once, at random, its moment in the ten minutes past 00:00 UTC (`DAY_TURN_SPREAD_MS`), and the world
host hands that one moment to every book that keeps a UTC day's answer: the professions (`profBook.js` - its state's
refresh, a pixel's and a dungeon's witnessed state), the halls (`npcHallBook.js`), the town economy
(`townEconBook.js`, built by `scenes/townEconHost.js`) and the seats (`townSeatBook.js`). A book keeps the day it holds
until its page's moment, so yesterday's answer stands at most ten minutes into the day, and an answer read inside the
turn is today's at once: a day held is compared with the turned day by `>=`, never `!==`, so a page come online at 00:02
is not asked again at its moment. The day a book asks by, stamps an ask with and closes a refusal for is still the UTC
day - the service's, which is the law's. The burst is spread over the ten minutes: two hundred pages ask at most twenty
a minute (`dayturn.test.js`, "the burst"), not two hundred in the first.

What a player sees for those minutes is the day before's: a pixel's witnessed state (the witnesses' rows outlast a
day, so it is nearly always today's too), the professions' state until it is read, a town or a seat not reported
again until the page's moment. The Motherlodes already turned at their own moment (`motherlodeBook.js`,
`MOTHERLODE_TURN_SPREAD_MS`).

What this does not do: it does not shorten the queue once it is full, and it does not touch the 15:00-18:00 hump (2).
The service's switches stand as they were (`server-account/wrangler.toml`, `PROFESSIONS_OPEN`, `FESTIVAL_OPEN`); setting
either to `dev` from the dashboard is the night's lever while a burst is in the queue.

## The second hump (2) - open

On 2026-10-20 the 16:00 and 17:00 hours waited 2,177,409 s and 2,302,375 s, with 96,399 and 116,484 503s and 429s, and
the relay refused 37,876 and 47,266 hellos; on 2026-10-21 the same hours waited 1,199,237 s and 1,438,602 s. It is not
a day's turn, and no book turns at that hour. Not traced: it needs the per-route minutes of those hours read before
anything is changed.
