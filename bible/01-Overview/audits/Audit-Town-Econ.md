# AUDIT TOWN-ECON (2026-10-16) - the town economy, audited

Mac, of TOWN-ECON TE1 (`06-Systems/Town-Economy-Arc.md`; branch `claude/party-loot-pr-asp0u8` at 2303055d): **"Lets
audit everything we have so far"**. This page is the findings, each with its verdict. What the audit changed is written
into the record's sections as they now stand, each marked AUDIT TOWN-ECON and its id.

## How it was run

Four lanes, each a cold adversarial reader of a FROZEN snapshot (a worktree at 2303055d - `Home.md`'s DO NOT FIX WHILE
THE VERIFIER IS READING: nothing in the tree moved until all four had reported), each told to prove a finding - a repro
run against the real code, or the code quoted with a concrete trace - before reporting it; then the author's pass, every
finding reproduced or traced before it was acted on, and each fix pinned and mutated (`TOWNECON-AUDIT-<id>`):

| Lane | Over | How |
|---|---|---|
| LAW - the price | `townEconLaw.js` through `shopAdjustment`, `tradeCost`, `getTradePrice`, `calculateTradePrice` (the online half, MERC-SLOPE, ESSENTIALS-HALF), `seatShopFactor` | real prices through the real walk for every Prosperity, shop quality, region index, haggler and stack; ECON1's walk over 4,000 days for the carry |
| CLI - the client | `townEcon.js` and every line the slice wired into `world.js`, `travelViewMarks.js`; the removed `seatTipAt` | every input two clients at one counter read; the seat book's beats; the raids' sharing online; `_townOfMapId`'s rows; the call costs |
| UI - the card | `townTipOf` and its words in 25 languages, `readTip`, `heldMap.js` (`_hoverLabel`, `_refreshTip`, `_tapTip`), `travelViewHud.js`, `.hmtip` | the real CSS stack and fonts in headless Chromium at desktop and phone viewports; the real `t()` with each locale loaded |
| DOC - the record | every sentence the slice wrote; the tests; the mutants; the translations; TE2's designed claims against the service's code | eleven probe mutants beyond the slice's 35; the re-aimed records run |

What reached a player: nothing (the branch is unmerged, no pull request opened). On the branch, a Booming town's counter
asked less than it paid, and the essentials' half made a round trip of firewood pay at nearly every counter above the
middle (LAW-1); the town's day was this machine's clock's (LAW-2); a seat town's card ran past a landscape phone (UI-1).

## Findings

### Lane LAW - the price

| # | Sev | Finding | Verdict |
|---|---|---|---|
| LAW-1 | HIGH | Above the middle a counter's ask fell while its pay stood at 1, and ESSENTIALS-HALF's break-even needs the two equal: five firewood bought and sold back paid at 134 of 140 counters at Prosperity 51 (13 to buy, 15 to sell; at 100, quality 20, index 2,500: 40 and 55), the pieces landing back on the shelf - no cap | FIXED: what a counter pays falls by the same share either side of the middle (`townSaleFactor`, the V), never above what it asks; the lane's sweep after: no counter at any Prosperity pays a round trip. Pinned by the real trade walk over every Prosperity, quality and index (`test/systems/townecon.test.js`); mutants |
| LAW-2 | MED | The town's day read this machine's raw clock, not the relay's - two clients across midnight read 46 and 41, and a clock set by hand chose any day of the cycle (a Buy factor from 0.885 to 1.045 in a month) | FIXED: `nowMs: battleNowMs` (the relay's offset, as every shared day); pinned; mutant |
| LAW-3 | MED | TE1 widens the carry between regions REALM P0.4 closed: 136 of 4,000 days paid a carrier before, 1,752 after, the mean gain 16 to 28 gold | LEFT - Mac's call, written with its numbers (`Town-Economy-Arc.md` section 7.4); decided and CLOSED 2026-10-18 (LAW-3: a counter's piece never sells for more than it cost - section 7.4), and audited again (`Audit-Town-Econ-2.md` PRICE-1, PRICE-2) |
| LAW-4 | LOW | "Never pays more" is false by one gold: MERC-SLOPE's online sale is not monotone in cost (2,307 of 302,400 sales below the middle paid a gold more); never a loop | LEFT, the claim reworded to the factor (decision 4) |
| LAW-5 | LOW | The Mages Guild's SellMagic read factor 1, so a Destitute town's guild paid the region's price its shops would not; and with no reading the seat's factor reached it | FIXED: `TOWN_SALE_MODES` (Sell, SellMagic); the fallback asks only on Buy and Repair (CLI-3); pinned; mutants |
| LAW-6 | NIT | An Edict named after an object property (`toString`) read the prototype's function, the sum became a string and the reading went to the middle; a share of Infinity counted nothing | FIXED: the table's own names alone; NaN alone counts nothing; pinned; mutants |
| LAW-7 | NIT | Section 0's "2.4 times (521 against 1,505)" set one day's ratio beside the span's extremes | FIXED: both stated as what they are |

### Lane CLI - the client

| # | Sev | Finding | Verdict |
|---|---|---|---|
| CLI-1 | MED | = LAW-2 | FIXED there |
| CLI-2 | LOW | = LAW-5 | FIXED there |
| CLI-3 | LOW | A seat at a place outside MAPS' three town types lost its Overworld card (the Held Map fell back), and its counter's SellMagic took the seat's discount | FIXED: the seat keeps SEAT-TIP's own card on both maps; the seat's factor only on what a counter asks; pinned; mutants |
| CLI-4 | LOW | Each client prices the seat term from its last seat list (5 to 15 minutes; a Turning's read spread over 2) - two buyers can differ for those minutes | LEFT, written (decision 2): SEAT1d's Market Day lives with the same beat |
| CLI-5 | NIT | An Ether isle's place has no economy and no card - right, and unwritten | FIXED: written (decision 1) |

Checked and sound: the raids are the same on every client online (the room's switch, the shared day, the hub's cleanses
replayed); `_townOfMapId` agrees across clients (the town packs are forced online); every shop interior carries
`townMapId`; a trade window's row costs 0.56 µs, a hovered plate 6.2 µs a frame; no counter outside `worldModes.js`
needed naming.

### Lane UI - the card

| # | Sev | Finding | Verdict |
|---|---|---|---|
| UI-1 | MED | The worst seat town's card (8 lines, a siege week) was 388 px tall and ran 36 px past a 640x360 landscape phone (the manifest locks phones to landscape), its siege line cut - CARD-FIT again, in height | FIXED: a held seat's Charter line left out (its holder line names the guild), TOWN_TIP_LINES_MAX 7; measured after: 350 px, inside every viewport the lane measured; and `.hmtip` bounded in height (`max-height`, CARD-FIT's own calc); pinned; mutants. LEFT: on a screen 640 px wide a 320-px card cannot stand beside a pointer at its middle, and covers the town it names - every card there does (a finger's tap shows it for TAP_TIP_S and lets it go) |
| UI-2 | LOW | The area line set English (`charterName`, `guildWords`) inside every language's grammar | FIXED: the line worded in each language round the town's or the crown's kingdom's name and the guild's own; SEAT-TIP's own lines stay English (as before TE1, section 6); mutant |
| UI-3 | LOW | The trend ignored the event the card reported (yesterday was read on today's raid and seat) | FIXED: worded as the market's - "Market rising." |
| UI-4 | LOW | The card's price left out Market Day, which is everyone's | FIXED: the asking share is the town's with the seat's for a buyer of no guild; pinned; mutant |
| UI-5 | LOW | On the Held Map a raided town answers with the raid's card, so the town's own (naming the raid) never shows there | LEFT, decided: the raid's card is the more urgent word; the town's is the Overworld's (section 3) |
| UI-6 | NIT | The Held Map's card under a still pointer went stale (refreshed only when a mark moved) | FIXED: a showing card asked again at the poll, rewritten only when its words change; pinned; mutant |
| UI-7 | NIT | Two roundings printed one share as two numbers ("1% more and pay 2% less") | FIXED: one rounding; pinned; mutant |
| UI-8 | NIT | A plain space before "%" let the number and its sign wrap apart (53 renders, cs/da/nb/sv) | FIXED: a no-break space in every draft that spaces it |
| UI-9 | NIT | Words that read badly together (a band and its trend the same word; de "Kämpfend"; ru "В упадке" as a level; "the region's." with no noun; no scale on the number) | FIXED: bands redrafted (de, sv, da, nb, ru, uk, bg, pt-BR), "/100", "the region's usual prices" |
| UI-10 | LOW | The Overworld shows no card on a tap without movement | LEFT: as before TE1 for every card there, not this slice's (section 6) |

### Lane DOC - the record

| # | Sev | Finding | Verdict |
|---|---|---|---|
| DOC-1 | MED | TE2's sources could not be keyed by pixel: a trader's stall names its town by map id, a patron's sale by map id - and the reason raids were left out (the client's word for a pixel) held for a board too | FIXED in the design: keyed by map id, a witnessed town registry (`world_witness`'s own rule), raids a source |
| DOC-2 | MED | The client keeps a Watch receipt only at a seat's pixel, so TE2's footsteps would have raised seat towns alone | FIXED in the design: the `keepWatch` change named |
| DOC-3 | MED | Seven of eleven probe mutants survived the tests: a seat's Standing and Edict never reaching the reading, the area's seat (any seat, or none), one act of the players' unsaid, the seat card's clock, an unread Standing, SellMagic | FIXED: the reading tested with seats dressed by the real seat book, three seats across two regions, the thresholds and the clocks; mutants |
| DOC-4 | LOW | Economy law 5 called TOWN-ECON "the one exception" to fixed NPC prices - SEAT1d and LW11 move them already | FIXED: all three named |
| DOC-5 | LOW | = LAW-5 | FIXED there |
| DOC-6 | LOW | = UI-5 | LEFT there |
| DOC-7 | LOW | `exterior.js` was flagged as selling nothing at a town's counter; it builds the interiors' modes, as the development host | FIXED: flagged as what it is |
| DOC-8 | LOW | Three records still described SEAT-TIP's `seatTipAt` | FIXED: `Field-Bugs-2026-10-04e.md` struck and pointed on; `Held-Map-Arc.md` and `Travel-View.md` noted |
| DOC-9 | LOW | = UI-2 | FIXED there |
| DOC-10 | LOW | = UI-7, and a price key no Prosperity reaches, translated 25 times | FIXED: the keys are the five a card can say |
| DOC-11 | NIT | = LAW-7 | FIXED there |
| DOC-12 | NIT | Decision 2 counted the seat's rule in a baseline every client computes alike | FIXED: the seat list's beat written |
| DOC-13 | NIT | The cycle's formula, the pixel key's wording, a moved pin named under the wrong slice, a mutant no test title named | FIXED |

Checked and sound: the gates (68 of 68), the slice's tests and moved pins, the l10n suites (234 of 234), every
placeholder in every language, buy and sell kept apart in every language, no line-number cite, the host ceiling's note.

## Also found

- **The essentials' round trip at a seat town** (SEAT1d's, live before TE1): a seat's discount lowers what its counters
  ask, Market Day for everyone and the members' always, while what they pay stands - five firewood on Market Day, 13 to
  buy and 15 to sell. TE1 neither opens nor widens it. Mac's call (`Town-Economy-Arc.md` section 7.5) - decided and
  CLOSED 2026-10-18 (SEAT-LOOP), and its bound carried to where the price is made by `Audit-Town-Econ-2.md` PRICE-4.
- Two mutant records survive their tests on `main` (9ae7e62b) as on the branch - not this slice's, left for their own
  arcs' next pass: `EVENT-TIP-the-ring-answers-with-no-card` (`tools/mutants/eventtip.json`) and
  `HORSEFACE-the-placing-paints-minus-one` (`tools/mutants/fb1004e.json`).
