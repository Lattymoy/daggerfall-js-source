# AUDIT CARDS-2 (2026-10-08) - the Tavern Cards arc, CARDS0 to CARDS4

Mac: **"Lets do a deep comprehensive audit on everything so far. Perfection"** - the arc on
`11-Multiplayer/Tavern-Cards.md` after CARDS3 and CARDS4 landed on the first audit (`Audit-Cards.md`): the cards' law,
the seat and the seated body, offline Hold'em against the tavern's regulars, and the cards and chips on the cloth.

## How it was run

Six lanes, each an adversarial reader of a FROZEN snapshot (a git worktree at da0ee1af - Home.md's DO NOT FIX WHILE THE
VERIFIER IS READING), each told to reproduce every finding before it reported it:

| Lane | Over | How |
|---|---|---|
| A | `net/cardLaw.js`, `systems/cardPatrons.js`, `systems/cardTableSession.js` | 100k random hands with up to five folds out of turn against an independent payout reference; 97k patron decisions through the law; equity against exact enumeration; 1,500 seeded evenings with the player leaving at every moment |
| B | the interior host's card block, the panel, the gold, the cursor | the block sliced from `worldModes.js` and RUN over the real session, gold helpers, cursor hold and panel; Chromium at 360 px |
| C | `world/cardMotion.js`, `world/cardScene.js`, `render/cardTableDraw.js` | the session and the scene at 60 fps over 40 seeds (219k frames): chips counted every frame, cards tracked frame to frame; the lab probe's screenshots |
| D | the seat, the body, the wire, the relay record, the merge | every first-audit fix re-verified on the snapshot; `git merge-tree` against main |
| E | the record and the pins | doc against code; 48 candidate mutants of its own on CARDS3/CARDS4 |
| F | design against build, play | every DECIDED item of sections 1-5 and 7; 7,830 headless evenings under eleven player policies at the three stakes; the panel in Chromium |

Beside the lanes, the whole suite ran on the snapshot (22,795 tests, 0 failures), and every finding was reproduced again
on the LIVE tree before its fix and after it (the lanes' own scripts, pointed at the live tree).

## Findings

| # | Sev | Finding | Verdict |
|---|---|---|---|
| H1 | HIGH | A load while seated paid the old game's chips into the loaded character: `restorePlayer` runs before `forceExitToExterior({ load: true })`, whose stand cashed the table out - save, sit, buy in, F11, +buy-in, without end (lanes B, D, E). A save taken while seated held the purse short the chips | FIXED: the load's road stands up with `cashOut: false` (the table belonged to the game the load threw away); the save refuses while chips are on the table (`modes.cardTableLive`, `worldQuickSave` and the pause's `savingPrevented`) |
| H2 | HIGH | The regulars were a bottomless faucet: every sitting re-rolled their purses and tempers, and their play had two leaks - the preflop call ignored the price, the postflop call weighed equity against a RANDOM hand whatever the bet. A nut-only shover took +349 big blinds an hour at 5/10, the "exploit" policy +359 (+14,514 gold an hour at 25/50) (lane F) | FIXED: the regulars' book (`regularsFor`, `regularsAfter`) keeps each table's purses and tempers for the game day, on the character's save - a broke regular is gone till tomorrow, a re-sit seats the same purses; the patrons play the price (`PRICE_PER_DOUBLING` past an open's `PRICE_FREE_BB`), defend a cheap one (`DEFEND`), and bend a hand's strength by the bettor's bet (`BETTOR_BEND`, for the raise as for the call). Re-measured with lane F's own sims: exploit -0.5 bb/h, nut-shover -20, stealer +18, tight -16 at 5/10 |
| M1 | MED | An uncontested pot only folded seats reached went to NOBODY (both blinds folded out of turn, the rest to a seat that put in nothing): 516 chip-losing hands in 100k, every one needing two folds out of turn - CARDS5's leaver road (lane A) | FIXED: uncontested, every pot is the one seat still in (`finish`); the fuzz's corrected reference agrees on 60k hands |
| M2 | MED | A purse that shrank after the seat (gold dropped from the inventory) was emptied by "Deal me in": `deductGold` never refuses, it takes what there is and answers the shortfall (lanes B, E) | FIXED: the purse read again at the press, the range with it; nothing paid that the purse cannot |
| M3 | MED | At phone width the panel's `min-width` beat its `max-width`: Fold and Stand up off a 360 px screen (lanes B, F) | FIXED: `min-width:min(520px,calc(100vw - 32px))`, border-box; every control inside 16..344 px in Chromium |
| M4 | MED | At every showdown the winner's share and the street's last bets were both drawn for up to 0.45 s (+415 chips at worst) (lane C) | FIXED: a share waiting its push is in the pot's one pile; the push starts once the street's bets are in and the cards have turned - 0 mismatches over the 40 seeds |
| M5 | MED | The edge flip lifted the wrong edge: the pivot rose a width and the far edge skidded a width and a half along the cloth (lane C) | FIXED: the roll's sign; pinned through the card's own matrix at five facings - the pivot edge does not move |
| M6 | MED | A fold started from the card's REST: a card still in the air jumped up to 0.87 m, its yaw snapped, the player's face-up cards flipped down in one frame; and a patron could fold before his cards had landed (lanes C, F) | FIXED: a fold throws from where the card is now, turning as it slides (`dealMotion`'s `fromYaw`/`fromRoll`); a patron's thought waits for the cloth (`settleMs`) - 0 jumps or snaps over 100k card-frames |
| M7 | MED | The panel never showed a showdown: the hand was gone the instant it ended (lane F) | FIXED: the session keeps the last showdown until the next deal; the panel shows the hands, the board, the winner and "Ana takes the pot with three of a kind." |
| M8 | MED | An uncalled bet coming home counted as a winner: "You and Ana split the pot" for a hand you lost (lanes A, F) | FIXED: only contested pots are won (`showdownWinners`) |
| M9 | MED | The pins were thin: 43 of lane E's 48 candidate mutants survived - the stand-as-a-blind pin dealt the player the button, foldSeat's re-evaluation unpinned, the host's card block mostly unpinned and pinned by text anywhere in the file, the in-play panel never painted, chips counted only at a quiet flop | FIXED: three new files of pins (`test/auditcards2_table`, `_host` - the host block RUN - and `_cloth`); `tools/mutants/auditcards2.json`: 95 dead and one equivalent (lane E's 41 that still applied, 6 re-aimed, 48 on this audit's fixes) |
| M10 | MED | CARDS3's slice row claimed the fanned hand, the peek and a frame cost measured on the probe; the probe measured nothing - it checked a pose count and called it the picture (lanes E, F) | FIXED: the row says what shipped and what is open; the lab reads the frame back and the probe fails a face-up card that paints no face (proven: with the faces culled, it exits 1) |
| L1 | LOW | An all-in run-out was said as one 'street' event: one burn on the cloth, "The showdown." in the log, the pot pushed before the river turned (lanes A, C) | FIXED: one event per street crossed; each street thrown after the last |
| L2 | LOW | A hand the blinds settled at the deal said no street: its hands turned with no board under them (lane A) | FIXED |
| L3 | LOW | The call that closed a street never showed as a bet: it came out in one drain with its street (lane C) | FIXED: the scene notes an action's chips from the event |
| L4 | LOW | Board neighbours and the burn shared a plane (z-fighting); a board card turned along its own jittered yaw could land past its slot's bound (lane C) | FIXED: alternate layers, the burn a gap and a half off, the turn along the board's axis |
| L5 | LOW | A stack of four columns cut through the second hole card; a won pot slid through its winner's cards (lane C, and this audit's own pin) | FIXED: a seat's stack grows away from its cards; a pot's scoop arcs over them (`SCOOP_LIFT`) |
| L6 | LOW | On a small table bets landed on the board (lane C) | FIXED: the places come in no closer than the middle's own things |
| L7 | LOW | Online, the regulars were seated and dealt in a chair another player sat in (lanes B, C) | FIXED: the regulars take only the free chairs; a full table says so |
| L8 | LOW | With the panel's slider focused, Escape and the function keys were swallowed (lanes B, F) | FIXED: only the slider's own keys stop at the panel |
| L9 | LOW | The same regulars in every town's tavern at one layout cell: the building key is its block's (lane B) | FIXED: the town's map id in the names' seed, the table's key and the cloth's seed |
| L10 | LOW | The log narrated the player in the third person ("You calls 30.", "Mac calls 30."), called a bet a raise, never said all in; the panel repeated the buy-in's constants (lanes E, F) | FIXED: the second person, "bets", "goes all in", the hand's name with its article; `BUY_IN_MIN_BB`/`BUY_IN_START_BB` imported |
| L11 | LOW | Seated in third person, this host drew the body standing where it stood (lane D) | FIXED: a seat takes the head (`mwViewFirstPerson`) and holds it as the saddle does (`riding`) |
| L12 | LOW | Section 3's decided thickness and pass and the mouse's hand, and section 7's "no client-dealt card online", were changed or left unbuilt without a record (lanes E, F) | FIXED: recorded (Tavern-Cards sections 3, 7, 16) |
| L13 | LOW | The FOUR HOSTS statement named only `worldModes.js` (lane E) | FIXED: the card table is `worldModes.js`'s, which world.js and exterior.js both mount; the save's refusal is world.js's (exterior.js never saves) |
| L14 | LOW | Page-Index said CARDS1-CARDS4 shipped (CARDS2c has not); the slices' own test and mutant counts stale (lane E) | FIXED |
| - | - | The dead stayed seated: the exhaustion's collapse sets health to 0 past every hurt listener (lane B) | FIXED: the frame stands the dead up |

## What held

Lane A: the law's 100k hands never stuck, never moved a chip in a fold, never leaked a folded hand; payouts matched the
reference on 75k showdowns; every patron decision legal over 97k; equity unbiased against exact enumeration (|z| <= 1.52
at 40k samples); the Chen table matches the published values; the session conserved every chip on every tick over
1,500 evenings, the player leaving at every moment. Lane B: the slot emptied before the occupant is told; 50 sittings
left no panel, no style, no draw, no cursor hold; no HTML injection (textContent throughout). Lane C: no NaN at any
clock; determinism; poses() about 3 us a frame; hole cards upright to their owner on all four sides; the matrices and
the atlas orientation right. Lane D: every first-audit fix HOLDS (C1, C2, S1, B1-B6, D1-D6, C3-C5, E1-E10); world175's
row byte-identical to main's; world176 does not collide (main is still at world175).

## Recorded, not built

- The patrons are names, not the room's living residents seated at the table; they do not talk (CARDS4's open).
- The fanned hand, the peek, a drag of chips, the shuffle's riffle; the frame cost on a phone.
- The 25/50 exploit re-measure read +74 bb/h over 90 evenings - inside the noise at that tier (a per-evening deviation
  near 2,000 big blinds); the bot's play is the same at every tier, and 5/10's -0.5 is the signal. The day's book caps
  what one table pays in a day at its regulars' purses.
- `E-host-holeof-all` is equivalent: the cloth turns up only the player's own cards whatever it is told.
- THE MERGE (lane D): main is 43 commits on; three files conflict - `worldModes.js` at `tryExit` (the seat's
  `if (cardSeat) { standFromCardTable(); return true; }` must stay the FIRST statement, above main's profession press
  arms, or a seated press starts a gather), `Testing.md` (the suite line, the rows) and `Active-Arcs.md` (both sides'
  lines). To be merged before a pull request.
