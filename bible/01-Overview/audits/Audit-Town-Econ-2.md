# AUDIT TOWN-ECON 2 (2026-10-18) - the town economy, audited again

Mac, of TOWN-ECON TE1 to TE3 with SEAT-LOOP and LAW-3 (`06-Systems/Town-Economy-Arc.md`, branch `ccr-74bb5b3a-7syebj` at
61bf1707de): **"Lets audit everything and ensure perfection. Ensure the sea trade routes plug into this system also"**.
The sea trade is the arc's section 8 (SEA-TRADE), built while the lanes read; this page is the audit's findings, each
with its verdict. What the audit changed is written into the record's sections as they now stand, each marked AUDIT
TOWN-ECON 2 and its id; the first audit's page is `Audit-Town-Econ.md`.

## How it was run

Five lanes, each a cold adversarial reader of a FROZEN snapshot (a worktree at 61bf1707de - `Home.md`'s DO NOT FIX WHILE
THE VERIFIER IS READING: the lanes' tree never moved), each told to prove a finding with a probe run against the real
code, or the code quoted with a concrete trace; then the author's pass, every finding traced before it was acted on, and
each fix pinned and mutated (`TOWNECON-AUDIT2-<id>`, `tools/mutants/townecon5.json`). The probes are the session's
scratchpad's (`audit-probes/{price,service,client,living,record}`), named under each finding.

| Lane | Over |
|---|---|
| PRICE - the trade laws | `townEconLaw.js`, `tradeModes.js` (the mark, the tally, the sale), `shopAdjustment`, the Stores and the sockets the marked pieces travel through |
| SERVICE - the account service | `server-account/src/townEcon.js`, migration 0132, the routes, the clock, INT16, the read's load |
| CLIENT - the book and the wiring | `townEconBook.js`, `townEconHost.js`, the `world.js` lines, the card's cost |
| LIVING - TE3, the card, the words | `trips.js`, `lines.js`, `livingTown.js`, `chapterSheet.js`, the card on a phone (headless Chromium), the 25 languages |
| RECORD - the docs and the pins | every sentence written since TE1, the tests, the mutants (probe mutants beyond the records) |

What reached a player: nothing (the branch is unmerged; no pull request is open).

## Findings

### Lane PRICE - the trade laws

| # | Sev | Finding | Verdict |
|---|---|---|---|
| PRICE-1 | MED | LAW-3 shared a lot's price by each piece's NO-HOLIDAY ask: on Warriors Festival the halved weapon was marked above what it cost and the armour beside it below, so keeping the armour and selling the weapon dear paid +10,560 a trip (`p1_holiday_split.mjs`) | FIXED: the purchase's own holiday and guild in the asks (`markCounterBought`'s `holidayId`, `guildFactionId`; both commits hand them); pinned (`townecon_audit2.test.js`); mutants |
| PRICE-2 | HIGH | The mark washed off for free: a bought material put in the Stores came back out of a withdrawal minted fresh and unmarked (+24,125 on 10,250 of Diamonds at twenty dear counters, `p2_stores_launder.mjs`), and a socketed gem extracted the same (+282 a Diamond past the fee, `p8_socket_launder.mjs`) - LAW-3's carry and the same-town inter-counter spread paid again | FIXED: a counter's piece is no service unit - counted out of the bag's held count, taken last and only for a station's own put-in, never by the Stores page, a writ or the market (`materialsBag.js` counterPiece, `profBook.js`); a stone a counter sold keeps its mark on its socket (`socketBought`) and comes out with it. LIMIT: a station's put-in whose craft is then refused leaves its units in the Stores. Pinned; mutants |
| PRICE-3 | LOW | Since SEAT-LOOP Market Day lowers what counters pay everyone, but the card printed the town's paying factor alone - wrong at 61 Prosperities of 101, and the test pinned the wrong text (`p3_card_pay.mjs`) | FIXED: the card's pay is `townShopFactor`'s Sell; re-pinned at every Prosperity and seat factor; mutant |
| PRICE-4 | LOW | SEAT-LOOP's bound lived only in `townEcon.shopFactor`: `shopAdjustment`'s own fallback and LW11's friend's counter paid above the ask, held only by LAW-3's mark (`p5_shopadj.mjs`) | FIXED: the fallback holds a sale to the seat's factor; the friend's price both ways; pinned; mutants |
| PRICE-5 | LOW | A per-piece share floored to 0: forty arrows bought beside a dai-katana sold for 0 forever, and spread 0 to found arrows merged in (`p7_zero_share.mjs`) | FIXED: a gold a piece first where the lot paid one, the rest by the asks; pinned; mutant |
| PRICE-6 | LOW | An improvement after purchase (a gem set, a hone) was capped at the purchase price (`p9_improved_capped.mjs`) | FIXED: `counterValue`, the value it was bought at - the part bought capped, the rest the player's own; kept by the law, a merge and a split; pinned; mutants |
| PRICE-7 | NIT | Docs and comments misdescribing the laws after SEAT-LOOP and LAW-3; the quick sale listed though dead | FIXED: each rewritten (arc 3, 7.4, `world.js`, `worldModes.js`) |

### Lane SERVICE - the account service

| # | Sev | Finding | Verdict |
|---|---|---|---|
| SVC-1 | MED | Three aged accounts confirmed junk map ids at real towns' pixels and places, 48 towns an hour, before any honest report; the true town could never stand and its footsteps and raids counted at the junk id for good - no strike, no audit (`p02_poison.mjs`) | FIXED: a report is a walk (a Watch tick of the reporter's at the pixel); a map id names its own pixel; 12 an hour; a developer's `/town strike` (row, reports, acts, days; never witnessed again) and `/town audit` (each town beside this client's map, FALSE said). LIMIT: a pose is the client's word - accounts posing could still walk a list in, a tick each two minutes, three accounts a town, and the strike undoes it. Pinned; mutants |
| SVC-2 | MED | `/v1/towns/watch` was outside INT16: an account with no seated realm character, or one held, counted footsteps (`p03_int16.mjs`) | FIXED: in PROGRESS_ROUTES (`watch`, the account's seat), spending no bucket; pinned; mutant |
| SVC-3 | MED | Every isolate read every town's days of the fourteen each 300 s, on the primary - 84,000 rows at 2,000 towns (`p06_read.mjs`) | FIXED: the minute's clock counts them once a keeping into `town_econ_kept`, which the isolates read; pinned; mutants |
| SVC-4 | LOW | The registry read a key's 64 oldest reports - 62 earlier dissents held a true town off for ever (`p08_limit64.mjs`) | FIXED: every report read, as the seats'; mutant |
| SVC-5 | LOW | Past the cap every tick still wrote a seen row and three statements, seen rows were kept fourteen days for a two-day receipt, and the client never stopped (`p05_capped.mjs`) | FIXED: the counts and the seen read first, nothing written for a capped or seen tick; the pixels full today said (`full`) and held off by the book; seen rows swept at a receipt's life and a day; pinned; mutants |
| SVC-6 | LOW | A town the table did not take was told `confirmed: true` and kept taking reports | FIXED: `taken`, its reports let go, asked again the next day; pinned; mutant |
| SVC-7 | LOW | No switch to shed TE2's load | FIXED: TOWNS_OPEN 'off' (`towns-closed`, the book stops; the clock counts nothing); pinned; mutant |
| SVC-8 | LOW | The hour's share fell from 40 statements a job to 37; a patron's sale costs two more | ACCEPTED, written in section 4 |
| SVC-9 | NIT | A tick minted a moment past the service's midnight was `old` | FIXED: counted on today; pinned; mutant |
| SVC-10 | NIT | A patron's sale counts for its seller without the week registered | WRITTEN DOWN (section 4): the seller keeps a home and a trader in the town |
| SVC-11 | NIT | The registry key unversioned | FIXED: `1:<map>`, the halls' |
| SVC-12 | NIT | The per-pixel lookups one round trip each | FIXED: one read of every tick's towns |
| SVC-13 | NIT | The `/v1/towns/` header lines inside the chapters' list | FIXED: a list of their own |

### Lane CLIENT - the book and the wiring

| # | Sev | Finding | Verdict |
|---|---|---|---|
| CLI-1 | MED | The market band was read and kept before the players' shares and the seat list had answered; carters' days differed between pages for hours (`p1_marketband_stale.mjs`; LIV-1 and REC-3 found the same) | FIXED: kept only once both have answered, the trips planned before made again (`onBandsReady`); what stays written in section 5 as it is (a band is its first asking's); pinned; mutants |
| CLI-2 | MED | The hovered card's patrons' line walked and split the whole sheet each frame: 235-411 µs a frame where 2.7 had stood (`p4_card_cost.mjs`) | FIXED: the region's list made once a sheet read; pinned; mutant |
| CLI-3 | LOW | The reported table sorted by raw value - past 200 done towns today's row was cut as it was written - and a report answered late wrote back a stale table (`p2_witness_table.mjs`, `p8_witness_race.mjs`) | FIXED: sorted by the day; the table re-read after the answer; pinned; mutants |
| CLI-4 | LOW | A claim was tried only at a new town tick - "the oldest after ten minutes" was not so (`p3_claim_cadence.mjs`) | FIXED: looked at by every reader's ask, each 30 s at most; pinned; mutant |
| CLI-5 | LOW | Section 3 not updated for SEAT-LOOP, and its counts TE1's | FIXED |
| CLI-6 | NIT | The book's relay clock was this device's until the welcome | FIXED: none until the relay's clock is heard; pinned; mutant |
| CLI-7 | NIT | The patrons' line past SEAT_TIP_TEXT_MAX in nl, el, fr | FIXED with LIV-3 |
| CLI-8 | NIT | The shares' read kept asking through an overload | FIXED: in BUSY_READS. The bookmark it forgets stands - a kept-answer route stays on the binding (DISPLAY-REPLICA's rule) |
| CLI-9 | NIT | The temple's and the guilds' services keep the region's price, unsaid | WRITTEN DOWN (section 3) |

### Lane LIVING - TE3, the card and the words

| # | Sev | Finding | Verdict |
|---|---|---|---|
| LIV-1 | MED | The freeze turned "within minutes" into hours | FIXED with CLI-1 |
| LIV-2 | LOW | The carter pin's trip was always null, so its day was never asked (`p1b_testvacuity.mjs`; REC-2) | FIXED: the trip made and its day pinned, the band read on its own day; mutants |
| LIV-3 | LOW | A held seat's card in a Tourney week with three long patrons ran 385 px into a 344 px phone bound, the patrons clipped (`p3_card.mjs`) | FIXED: two by name and the rest a count, and only where the card has room; pinned; mutant |
| LIV-4 | LOW | "Chapter" in eight languages a word no other row used (a church's) | FIXED: each language's own word, redrafted |
| LIV-5 | LOW | ru, pl, cs, uk put the name after a preposition that wants a case; ko's particle fit no vowel ending | FIXED: "in the town of {town}", ko "{town}에서는" |
| LIV-6 | LOW | Destitute and Booming are rare states, not ordinary ones | WRITTEN DOWN (section 5) |
| LIV-7 | LOW | One town's talk in two languages | WRITTEN DOWN (section 5) |
| LIV-8 | NIT | The freeze wiped whole past 4096 | FIXED: oldest first; pinned; mutant |
| LIV-9 | NIT | "That day's band" misdescribed the first asking's | FIXED in the comments, the arc and Testing.md |
| LIV-10 | NIT | The patrons' line past the text bound | FIXED with LIV-3 |
| LIV-11 | NIT | Patrons sorted by name; "area" said of the region | FIXED: the most chapters first; "in the region"; pinned; mutant |
| LIV-12 | NIT | The talk's pool said and joined its eight words each ask | FIXED: read again on the text core's revision; its mutant recorded equivalent (a cost, no answer) |
| LIV-13 | NIT | Active-Arcs said "TE1 BUILT" | FIXED |
| LIV-14 | NIT | The Destitute fortnight's dependence on the online window unwritten | WRITTEN DOWN (section 5, `trips.js`) |
| LIV-15 | NIT | Drafting nits in hu, sv, tr, fi, fr | FIXED: redrafted |

### Lane RECORD - the docs and the pins

| # | Sev | Finding | Verdict |
|---|---|---|---|
| REC-1 | MED | The card's Market Day pay, and its pin | FIXED with PRICE-3 |
| REC-2 | MED | The carter pin cannot fail | FIXED with LIV-2 |
| REC-3 | MED | The market band is not "that day's" | FIXED with CLI-1 |
| REC-4 | MED | Nothing pinned `world.js` handing the pixel builder `townEcon`; the edit was unrecorded | FIXED: pinned on the host's own file; written in section 5; mutant |
| REC-5 | MED | Section 3 and four more pages contradicted 7.5 | FIXED: each rewritten (arc 3, Testing.md, the Ledger's AUDIT row, `world.js`, `worldModes.js`) |
| REC-6 | LOW | LAW-1's walk could no longer fail on LAW-1's hole (SEAT-LOOP's bound masks it) | FIXED: its two mutants named in the price test that kills them; Testing.md reworded |
| REC-7 | LOW | Section 3's counts TE1's | FIXED |
| REC-8 | LOW | `confirmed: true` when nothing was written | FIXED with SVC-6 |
| REC-9 | LOW | The registry's unique keys pinned only together | FIXED: one town at the pixel, one at the place; mutants |
| REC-10 | LOW | Unpinned claims: a tick's own day; a witness refusal's stop; the read's least share; a town's own talk days | FIXED: each pinned; mutants. "A sale on a board counts nothing" stands pinned by the market suite's NOT NULL (the lane's own reading) |
| REC-11 | LOW | Index pages stale ("LEFT for Mac", "TE1 BUILT", "54 of 54") | FIXED |
| REC-12 | LOW | 7.4 and 7.5 named no hosts | FIXED |
| REC-13 | NIT | "Proposed", "designed", "in TE2" | FIXED |
| REC-14 | NIT | Two mutants named in no test title | FIXED |
| REC-15 | NIT | "Every Prosperity" meant steps | FIXED |
| REC-16 | NIT | The Overworld regex accepted either loop's variable | FIXED: each plate's own |
| REC-17 | NIT | Small stale comments | FIXED |
| REC-18 | NIT | Testing.md's townecon row's order | FIXED |

## Also checked and sound

The lanes' "checked and sound" lists stand as they reported them: the day moves only behind a counted act in every
source; the UPSERTs and their binds; the cap never passed; replay and identity; the raid key's index; migration 0131;
statuses and words; the market's and the raids' batches; the Watch pixel's arithmetic; the claims' storage; the
witness's entry edge; the price reads; offline byte-identical; the wiring's order; the cap's own properties over 80,000
random lots; the mark kept by every move but the two PRICE-2 closed; every mutant suite dead; the bible's gates.

## SEA-TRADE against the same findings

Built while the lanes read (section 8), it was held to every finding above: its dealing rides the Watch's claim (INT16,
the caps read first, `full`); its exchange's goods carry the mark (no patron takes them - and no shop buys them, AUDIT
CAPTAIN'S SEA B2); its lanes' count waits for the lanes to stand (BOOT-TDZ II). `tools/mutants/townecon4.json`: 28 dead.
