# AUDIT FRONTS - two provinces a game day, 2026-10-29

The owner: *"Audit this"*, of FRONTS (`03-World/World-Wide.md` FRONTS, commits `b21387ee6` to `f5435dd6c`) - the
provinces' turns past the Bay, the gates, stars, raids and Abyss Dungeons that read them, the Timers' rows and the travel
map's card. Three lanes read it cold, each with the repo read-only and its proof scripts in a scratch directory: the law
and the server (A), the client and its words (B), and the records and the pins (C). No lane found a fault in the
schedule, in the gating of the four kinds or in the cap; their findings are in what the player is told, in pins that
could not fail, and in the record. Every finding was re-run against the tree before it was fixed.

Each fix is pinned in `test/net/fronts1_law.test.js` (11) or `test/ui/fronts1_card.test.js` (1, the card drawn by
`HeldMapWindow` itself). Mutation-proven: `tools/mutants/fronts.json`, 35 records (18 before, two re-aimed), all dead.

Severity is the lanes' own: **bug** a wrong thing a player sees; **risk** one under a condition; **doc** the record says
what is not so; **test-gap** a pin that cannot fail; **nit** a word or a cost. A finding two lanes made is listed once.

## A - the law and the server

| ID | Sev | Finding | Fix |
|---|---|---|---|
| A1 | bug | **The Hollow's Discord cards gave the wrong next rise.** A fall's and a fade's "Next may rise" was the record's rest; a province's next waits for its turn and a free place, up to 14 hours later. | `sdLaw.js sdRiseNotBefore` - the rest, the turn and the cap - handed by the hub to `sdHeraldPost` (`next`). |
| A2 | risk | **A freed place went to the lowest lane.** The director beat its lanes in order, so over a year of unbeaten Hollows High Rock rose 62 times and Black Marsh 20. | `sdBeatOrder`: the Bay's, then the province whose last Hollow rose longest ago. Measured on the law: 40 to 49 a province, where lane order gave 21 to 70. |
| A3 | risk | **A raid's or a star's lane is read off its key, not its pixel.** A modified client can say a stirred province's raid or star from a pixel in another province. The hole predates FRONTS; the turns make it worth a little more. | Not fixed: the relay holds no picture of the provinces, and a raid's kills are the client's word already. Recorded, and put to the owner. |
| A4 | risk | **The deploy order was half recorded.** An older page on world286 stands off-turn stars and raids too, not only gates, and the relay drops their words. | Recorded in full (World-Wide.md FRONTS, the deploy). The site may go first: it sends nothing world286 alone reads. |
| A5 | test-gap | **"starOk made to read them" had no killer**, and one gate line could not fail. | `starOk` asserted directly for an off-turn star, its mutant run against `star1_law` too; the gate line dropped. |
| A6 | doc | **A province's festival night can be split.** Every other night's last star lands on a day's edge, so a turn gets one or two of a night's three. | Recorded. |
| A7 | doc | **Hammerfell's gate's omen comes the day before its turn** (21:48; it opens at 00:48). | Recorded. |
| A9 | risk | **A turn that ended while the census was asked armed nothing.** | The hub arms the director's next move when a rise is refused. |

## B - the client and its words

| ID | Sev | Finding | Fix |
|---|---|---|---|
| B1 | bug | **The Timers' "An Abyss Dungeon rises" counted down to turns the hub would refuse** while two Hollows stood past the Bay - the usual state, since a Hollow stands two real days. | The row says `sdRiseNotBefore` over the lanes' records the client holds. |
| B2 | bug | **The card and the Timers said more than the law.** "World events here from" stood beside a found Hollow, the Sky-Ketch and the serpent. (C4.) | The words name the four kinds: "Gates, raids, stars and Abyss Dungeons start here from {when}"; the row "Past the Bay: {a} and {b}". |
| B3 | bug | **No language but English had the six new rows.** | Drafted in the thirteen complete languages (`tools/l10nInSession.mjs`); the twelve partial ones owe them with the rest. |
| B4 | bug | **The schedule row counted as an event under way.** | A front row is `sched`; `timerGroups` counts no schedule as under way. |
| B5 | risk | As A4. | |
| B6 | risk | **Offline, a save lost three in four of its province raids**, by a schedule of the shared clock it does not run on. | The fronts are online alone (`raidsForLane`'s `fronted`, `sharedClockOn()`). |
| B7, B8 | test-gap | **The rise row's instant and the card had no killer.** (C2, C3.) | Pinned; the card drawn by `HeldMapWindow`, with a skewed clock. |
| B9 | nit | A card left open across the day's turn keeps its line. | Recorded; the card is drawn again on the next pick. |
| B10 | nit | As A7. | |
| B11 | nit | The fronts' mark was Starfall's violet. | Green, `#8fd17a`. |
| B12 | nit | The host's lanes check was written three times. | `createGateLanes` says `lanesOk()`; the host's two entries read it. |
| B13 | nit | The hourglass's label named no fronts; the rows are the enhanced skin's alone. | Its label names the provinces' turns; the skin recorded. |

## C - the records and the pins

| ID | Sev | Finding | Fix |
|---|---|---|---|
| C1 | test-gap | **No pin read which provinces the rows name.** | The three titles pinned against the day's lanes, by name. |
| C5 | doc | WW6's "125 raids a game day past the Bay" stood beside the example FRONTS moved. | Narrowed: 29 to 33 a day since FRONTS. |
| C6 | doc | **Pages a reader acts on still said every province, every day** (World-Wide.md's slices, WW2, WW5; Starfall.md; Super-Dungeons.md; Raiding-Parties.md). | Each narrowed with a pointer to FRONTS. |
| C8 | nit | "About 52 raids" measured 53 (51 to 55). | Corrected. |
| C9 | nit | "Two days" for a Hollow, in a section where a day is two hours. | "Two real days". |
| C10 | nit | EG3's golden re-record was not in the record. | Recorded with its proof. |
| C11 | nit | The patch notes' cap holds only for Hollows risen after the update. | The notes say so. |
| C12 | nit | Two test titles claimed what their bodies did not check. | The stagger's count checks each standing gate is on its turn; the star test is titled for its sites. |
