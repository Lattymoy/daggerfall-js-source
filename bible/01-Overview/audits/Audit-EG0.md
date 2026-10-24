# AUDIT EG0 - the Elite Gates design page, audited

Mac, 2026-10-11, of the first draft of `11-Multiplayer/Elite-Gates.md` (EG0): *"Do a comprehensive audit and ensure this
is the best and most detailed it can be"*.

## Method

The audit ran five cold lanes, each a separate reader, on a FROZEN snapshot of the page: commit 177a3acd6, copied to
the scratchpad before any lane started. No edit was made until every lane had returned (Home.md's 17l: *DO NOT FIX
WHILE THE VERIFIER IS READING*). Then every finding was verified by hand:

- a code claim, against the tree (the file and the symbol);
- a number, by recomputing it (lane 2's scripts, and a re-run of its pace model under the revised rules);
- a lore claim, against UESP and the port's own book (`src/systems/portBooks.js`).

| lane | reads | findings |
|---|---|---|
| 1. code truth | every claim the page makes about the shipped tree, about 210 checked | 31 (5 HIGH, 13 MEDIUM, 13 LOW) |
| 2. numbers and consistency | every formula and table recomputed; the pace simulated; the real motor and collider run | 23 |
| 3. architecture, trust and failure | the open, the orders, the stake, the receipts; durability; exploits; the Process rules | 17 |
| 4. game design and the player's experience | scaling from 1 to 8, the one life, the bosses, the rewards, the first breach | 16 |
| 5. lore, words and the bible's rules | canon, the vocabulary's collisions, the conventions | 18 |

There were **105 findings**, and a sixth lane later found 28 more in the revision (below). Verdicts:

- **CONFIRMED**: the finding is true as stated.
- **PARTIAL**: true in substance, wrong in a detail, which is named.
- **REFUTED**: false.

None was refuted. Where two lanes found one fault, both rows name the one fix. Every resolution names the section of
the revised page that carries it.

## Lane 1 - code truth

| id | sev | finding | verdict | resolution |
|---|---|---|---|---|
| C1 | HIGH | `i` called "an order id"; it is every order's issue time. `egopen`/`egadmit` are not in `ORDER_KINDS` | CONFIRMED (`identityToken.js`: `orderValid` reads `c.e - c.i <= ORDER_TTL_S`) | 21: `ez` is the order id; `ORDER_KINDS` gains both, a relay version |
| C2 | HIGH | "every blow the gate ships keeps the floor" is false under Colossal (slamR 8.5) | CONFIRMED (`gateMods.js` colossal) | 12.2: the floor CLAMPS; the gate's tightest blows named against the escape build |
| C3 | HIGH | `restackStones` is a load-time fold, not a restack to a service count; the purse adds serpent embers | CONFIRMED (`gateSpoils.js`, `EMBERS_EARNED_SQL`) | 5: no restack exists, EG2 builds it; the precedent is `insigniaPurse` |
| C4 | HIGH | `amap` is the dungeon automap share, not a world mark | CONFIRMED (`wire.js` PARTY-MAP) | 6: the hub's call (`k:'call'`) on the party channel; 21: its frame |
| C5 | HIGH | `orreryOf` takes a slot, reads the slot's own Hour marks for its fray and has no turns-band parameter | CONFIRMED (`sdBrain.js`) | 8.4: EG4 widens `orreryOf(s, {turnsMin, turnsMax, fray})` |
| C6 | MED | the membrane's colours and heights are compiled into the shader; no scale uniform | CONFIRMED (`gatePass.js` `MEMBRANE_FS`) | 6: EG9 adds tint and scale uniforms |
| C7 | MED | `shapeStamp` carries only the marks' changes, not a full shape | CONFIRMED (`sdRemnant.js`) | 19: a full shape stamp, new |
| C8 | MED | `TELEGRAPH_POINTS_MAX`/`SPOKES_MAX` are per-shape limits; the pass draws one shape a call | CONFIRMED | 23: 24 shapes a frame, one call each; the limits stay per-shape |
| C9 | MED | `bossCardRoll(kind)` mints one card per kind | CONFIRMED (`bossCards.js` `BOSS_CARDS`) | 17: each lord its own key in `BOSS_CARDS` |
| C10 | MED | the gate's trials have no `.law` and no X keys; `sdMarksLaw` cannot fold them; "Echoing" is a trial's name | CONFIRMED (`gateMods.js`) | 13: four boss-general trials recast as X-keyed laws; no reused names |
| C11 | MED | PORTAL-GIFT is client-side at save load; a post claim writes an item, never an account count | CONFIRMED (`save.js` `givePortalGift`, migration 0094) | 5: the send migration adds to `eg_keys`; the post only words it |
| C12 | MED | rite-only rows (`earned = 'rite'`) are no kill | CONFIRMED (`accounts.js`) | 5: both the gift and the certain first key read `earned != 'rite'` |
| C13 | MED | `standSdRealm` is in `worldModes.js`, not `dungeonContext.js` | CONFIRMED | 26: `standEgHall` beside it in `worldModes.js` |
| C14 | MED | the chart's `x` is the crystals' share | CONFIRMED (`damageChart`) | 14: the lean reads the blow kind `r`, not the chart |
| C15 | MED | the gate's Harrier marks the challenger farthest from the boss, not from itself | CONFIRMED (`harrierBeat`) | 11: the anchor is the lord in a Court, the Harrier elsewhere |
| C16 | MED | `gateLandingFor` refuses a record without a gate day and takes its yaw from the day | CONFIRMED (`gateArena.js`) | 6: widened to take an arch record |
| C17 | MED | the relay's body trail is 2 s, not a span's length | CONFIRMED (`bossBody.js` `BODY_TRAIL_MS`) | 19: `spanFair` is an online accumulator of its own |
| C18 | MED | the Steps' `amp` is half the swing (1.0-2.0 m) | CONFIRMED (`sdSteps.js` `DRIFT_AMPS`) | 10: `amp` (half the swing) 1.0-2.0 m |
| C19 | LOW | 382xx is not the Hour's range; it is town beds, pictures, Lefay and the merchant yard | CONFIRMED (`SD_REALM_ARCHIVE` 38151) | 23: "after the merchant yard's 38221" |
| C20 | LOW | 573-574 are the Ayleid stones, not the gate's | CONFIRMED (`ayleidStones.js`) | 5: the gate's 570-572, the Ayleid stones' 573-574 |
| C21 | LOW | rift health should cite `hostTeamHpFor` (with `HOST_HP_MIN`), not `crystalHpFor` | CONFIRMED | 8.1 |
| C22 | LOW | the deed also needs 7 days in the guild | CONFIRMED (`marksLaw.js` `tenureS`) | 17 |
| C23 | LOW | the module-scope readers were listed wrong; the motes read lazily | CONFIRMED | 10: the readers named |
| C24 | LOW | `buildHallModel`, `spanOf` and `bossOf` are taken; `sdSeed`, `topWithMe`, `rimSpots`, `stepHost` and `makeSong` are not exported | CONFIRMED | 9, 10, 12: `buildEgHallModel`, `egSpanOf`, `egBossOf`; 27: exported once and imported; 24: each score writes its own `makeSong` |
| C25 | LOW | `registerLevitateWard` keeps one function; registering again replaces it | CONFIRMED (`playerEntity.js`) | 10: OR'd into the one registration |
| C26 | LOW | the clear sweep tracks a single key | CONFIRMED (`gateClearance.js` `swept`) | 6: widened to a set of keys |
| C27 | LOW | `claimGate`'s context has no `rand` | CONFIRMED (`accounts.js`) | 5: it gains `rand` |
| C28 | LOW | song names break the 8-character stems | CONFIRMED (a convention: GATEWAR1, HOURHOLW) | 24: eight-character names |
| C29 | LOW | the lowest-piece law is in Sigil-Sets section 2 | CONFIRMED | 17 |
| C30 | LOW | 600 m is the beacon's height, not its reach | CONFIRMED | 6 |
| C31 | LOW | existing files written without `src/` read as planned; planned tools name no directory | CONFIRMED | throughout: existing paths carry `src/`; planned tools are "under tools/" |

## Lane 2 - numbers and consistency

| id | sev | finding | verdict | resolution |
|---|---|---|---|---|
| N1 | HIGH | the claimed walls (Ward 25-30 at the cap, the board's top past Hall 100) break the 3-hour last word | CONFIRMED (re-run: 1x stops at 5, 2x at 12, the cap at 14) | 16: the model re-run under the revised rules; the last word named as what stops strong companies; starting deeper is how the Wellhead is reached |
| N2 | HIGH | "never one of the two before it" cannot be met by pools of two | CONFIRMED | 12.3: earlier bands' lords join every pool; no repeat in the last `min(2, pool-1)` |
| N3 | HIGH | the Examination, the Final Examination and the tether cannot be done by small companies; the Alone board dies at the Battlemaster | CONFIRMED | 12.2: THE ERRAND FLOOR; 12.3: every errand's *n* = 1 rule |
| N4 | HIGH | the hold returns mid-run (1 h against 3 h 20) | CONFIRMED | 21: the stake is returned only by a void, never a clock |
| N5 | HIGH | Colossal's phase-3 Slam breaks the floor; the gate's pin passes only without slack | CONFIRMED (also C2) | 12.2: the floor clamps |
| N6 | MED | the floor cannot be computed for whole-arena and haven blows; fury would shorten them without limit | CONFIRMED | 12.2: THE CHECK CLASS; 12.3: haven wind-ups from their escape |
| N7 | MED | the Beat's floor (1.8 s) fails the solver (0.45 s window) | CONFIRMED | 10: nothing gets faster; the Beat keeps 2.4 s (window 1.05 s) |
| N8 | MED | the Crumble's 0.45 s floor fails the page's own rule | CONFIRMED | 10: the Crumble keeps 0.7 s (0.63 s needed at the span build) |
| N9 | MED | three reference builds; the solver certifies windows the sweep cannot use | CONFIRMED | 10: THE SPAN BUILD (solver and sweep) and THE ESCAPE BUILD (the floor); gaps at most 3.2 m |
| N10 | MED | a Descent's landing is overshot (no air control) | CONFIRMED (lane 2 ran the real motor) | 10: a 5 m landing and a 1.2 m parapet |
| N11 | MED | the Pendulum's 6 m push always casts back | CONFIRMED | 10: said plainly; a touch is a fall unless Iron Footing III |
| N12 | MED | "at the cap" ignores the Vestiges' factors (up to about 2.08) | CONFIRMED | 14: the product capped at 1.25; 16: a column with it |
| N13 | MED | one decree per family allows four, but the formula gave six; no decree had a family | CONFIRMED | 13: a family column; at most four |
| N14 | MED | the legion cap's 14 was unreachable, with no depth term | CONFIRMED | 8.1: `clamp(2 + ceil(1.5n) + floor((c-1)/5), 3, 14)` |
| N15 | MED | the Yard held 12 s in all and ended in about 20 s | CONFIRMED | 8.1: 12 s for each rift, times the depth |
| N16 | MED | the summary and section 5 disagreed on when the count starts | CONFIRMED | 6: the count starts when the first hall wakes, everywhere |
| N17 | MED | the forging comparison ("less than an honest gate-goer") was wrong (0.31 against 0.17-0.5) | CONFIRMED | 5: 6 asks a tier (0.155 a day) and 2 keys a week |
| N18 | MED | bands and bodies disagreed (Divers, Atronachs, Seducers, decrees pulling later kinds forward) | CONFIRMED | 7, 11, 13: one band table; decrees draw only unlocked kinds |
| N19 | LOW | "four signatures" (three exist); "thirteen Kyn"; the champion always a Kynreeve | CONFIRMED | 12.4, 17, 8.5 |
| N20 | LOW | the Drift's amplitude semantics; "in each period" undefined | CONFIRMED | 10: half the swing; "in every 12 s of the clock" |
| N21 | LOW | blows missing the numbers the floor needs (Gore, the island's crack, the walkway strike, the vent lane, a span vent) | CONFIRMED | 8.3, 10, 12.3: each given its width and wind-up |
| N22 | LOW | arithmetic and wording (ttkRef 30; Tithe's size; caster ranges; Wellspring under the cadence floor; the count's formula; "pays twice") | CONFIRMED | 6: the count's formula; 12.2: the deep growth; 13, 16, 17 |
| N23 | LOW | depth shares make one-shots; fury makes failed checks lethal | CONFIRMED | 12.2: shares capped at x1.5; CHECK damage fixed |

## Lane 3 - architecture, trust and failure

| id | sev | finding | verdict | resolution |
|---|---|---|---|---|
| A1 | HIGH | the 1-hour return gives free keys and can settle twice | CONFIRMED (receipts live 7 days; the relay cannot reach the service) | 21: THE STAKE, spent by a receipt, returned only by a void; idempotent open on `rq`; the tombstone |
| A2 | HIGH | `eg_live` never expires, and admit does not write it | CONFIRMED | 21: `{b, until}`, written by open and admit in one conditional update |
| A3 | HIGH | the order's fields clash with `identityToken` (60 s, `i`, `st` a siege field, `ORDER_KINDS` frozen) | CONFIRMED | 21: 60 s, `eb`/`ez`/`ew`, `EG_ORDER_FIELDS` exclusive |
| A4 | HIGH | no route to `eg:<b>` before the hall; no receipt path for an absent member | CONFIRMED | 21: opening through the hub (`EG_INTERNAL_OPEN`, `eglive`, `egrc`); the room as presence |
| A5 | HIGH | a relay deploy mid-run (sockets dropped, the client ahead of the relay) | CONFIRMED (`relay-deploy.yml`, `SD_LOST_MS`) | 20: THE DRAIN, a law pin per breach, time across a restart, *Return to the Spire* |
| A6 | HIGH | an idle account is carried to the deep titles | CONFIRMED | 15: EARNERS by `earned(f, sub)` over the circle; idleness counted |
| A7 | HIGH | conditional Vestiges' factors raise the cap unseen; Fade with no cooldown | CONFIRMED | 14: expected factors, the product capped at 1.25; Fade's 8 s |
| A8 | HIGH | `spanFair` cannot be built from 2 s trails; poses do not say their hall | CONFIRMED (`BODY_TRAIL_MS`) | 19: an online accumulator; `here` and `down` bracket the halls |
| A9 | MED | `down` unverified; no arrival signal | CONFIRMED | 7: `here`, `down` within 3 m, the wake on every arrival |
| A10 | MED | durability (checkpoints, deterministic receipts, storage); the socket-flap dodge; the cost | CONFIRMED | 20 |
| A11 | MED | the find is asked by the owner, not the killer; tier is the client's word; alts | CONFIRMED (`_killedBy`) | 5: the killer asks; handle and record required; weekly cap |
| A12 | MED | the board measures ratcheting, not delving | CONFIRMED | 18: the Descent from the first hall; the Depths for the ratchet |
| A13 | MED | the four-host list is incomplete (saves, rest, companions, the Portal Stone, regeneration...) | PARTIAL (the sites are 19 and 38 in `world.js`, not 17 and 28; the gap is real) | 22: `madeLevelOf` and `MADE_LEVEL_RULES`, with a sweep test |
| A14 | MED | the span law would pull client code into the relay bundle; `orreryOf` and `_sdTurn` need widening | CONFIRMED | 9: the leaf `net/eliteGates/egSpanLaw.js`; 8.4: `orreryOf` widened and `orreryJudge` extracted |
| A15 | MED | the page did not say how it keeps each Process rule | CONFIRMED | 27 |
| A16 | LOW | Watchfire's lead must be uniform; the body count must apply the defensive Vestiges | CONFIRMED | 14: `EG_TELL_LEAD_MS` for every blow; 19: the body count |
| A17 | LOW | unknown rooms write nothing; `lv` frozen; `home` refuses re-entry; the room holds the arch's site | CONFIRMED | 6, 20, 21 |

## Lane 4 - game design and the player's experience

| id | sev | finding | verdict | resolution |
|---|---|---|---|---|
| G1 | HIGH | one life with a company of eight benches the fallen for hours | CONFIRMED | 15: THE RECALL (once, at the next Redoubt), the witness, the bequest, forsaking; *the Unfallen* for the purist |
| G2 | HIGH | nothing is ever at risk, so the way home is no decision | CONFIRMED | 15: RELIQUARIES, opened only by the way home |
| G3 | HIGH | no scaling rule for errands that need several people | CONFIRMED (also N3) | 12.2: THE ERRAND FLOOR; 12.3: every lord's *n* rules; 8.1: the legion cap by *n*; 12.2: a fall retires its share |
| G4 | HIGH | the floor checks one shape at a time, in empty space, with no latency | CONFIRMED (`perilAt` exists to widen) | 12.2: THE UNION FLOOR, a 0.5 s slack; 8.3: Breakers across, never along |
| G5 | HIGH | party Vestiges stack eightfold; death saves make one life one a minute | CONFIRMED (`lootPowers.js`: Divine Grace, The Hour Turns, Unbroken) | 14: stacking rules, the caps, death saves at the Redoubt |
| G6 | HIGH | Redoubt embers would flood the economy | CONFIRMED | 17: weekly pay, embers where earned, a pity count, the Broker's sink |
| G7 | HIGH | the roster contradicts itself, repeats the gate, and relies on tells the engine cannot give | CONFIRMED (Feud's feint grammar; WB13a T8) | 12.3: the pool law; Ozzath replaced by the Armsmaster's duel; the Colossus climbed, the Wyrm's pillars, Ilthys's banners; feints and umbral discs, no shadow tells |
| G8 | MED | the count and the session (the rest running, absence, wasted time, the model) | CONFIRMED | 6: the rest holds the count, the respite, the surplus, absence never on the stair; 16: the model re-run |
| G9 | MED | the all-time ratchet decides the season board; one bracket for 2 and 8 | CONFIRMED | 15: the season's ratchet, half the best at a season's start; 18: three brackets |
| G10 | MED | the span's toll rewards standing still | CONFIRMED | 10: a toll by islands missed, THE HIGH ROAD; 8: a gentler cast-back; 8.2: THE GOLD RUN |
| G11 | MED | depth past Hall 56 is numbers only, and fury speeds blows up (against Mac's WBX *"nothing gets faster"*) | CONFIRMED (`World-Bosses.md` WB13) | 12.2: fury adds waves and chained blows, never speed; 16: the rites, the deep growth x1.03; 13: four decrees and ranks |
| G12 | MED | five kinds for ever; health between halls unstated | CONFIRMED (`courtRules`) | 7: the rhythm; 8.7: the twists; 8: health between halls; 8.4: the Athenaeum worked together and rewarded |
| G13 | MED | melee idle against fliers; the dark hides foes | CONFIRMED | 12.3: chains a blade strikes, grounded windows; 23: rim lights |
| G14 | MED | the offer's lean read nothing; Watchfire blue reads as safe; flat percentages | CONFIRMED | 14: the lean by blow kind; Watchfire crimson and dashed; resonance's capstones |
| G15 | MED | gathering eight at a wild arch; a first Court with a four-rune check | CONFIRMED | 6: THE CALL; 7: the account's first circle fixed; 25: the HUD and the first breach |
| G16 | LOW | accessibility (gold against red; the Examination's order by light alone) | CONFIRMED | 23: keylines and chevrons, numerals and chimes, the personal sting |

## Lane 5 - lore, words and the bible's rules

| id | sev | finding | verdict | resolution |
|---|---|---|---|---|
| L1 | HIGH | "destroyed when Dagon was banished" and "its halls still garrisoned" are false canon | CONFIRMED (UESP Lore:Battlespire, Lore:Weir Gate; `portBooks.js`) | 3: canon restated; the torn halls marked as the port's invention |
| L2 | HIGH | a Valkynaz is a warrior duke, not a prince; Varlet omitted | CONFIRMED (Lore:Kyn; `iliacCards.js` keeps `prince` for Princes) | 3, 12.4: "Lord of the Galleries"; eight ranks |
| L3 | HIGH | "shards hold a breach open" contradicts the shipped book and the page's own mechanic | CONFIRMED (*"It is his will that holds the door"*) | 3: the Elite door is the key's and the Redoubts', never a lord's |
| L4 | HIGH | "Spire Sigil" brings back the retired word | CONFIRMED (Lore:Sigil Stone; WB12) | 4, 5: the Weir Key |
| L5 | HIGH | "Kyn" means Dremora; most of the bosses are not | CONFIRMED | 4, 12: "lords"; the Twin Lords of the Fire and Frost clans |
| L6 | HIGH | "Ward" had seven meanings, one shipped player text (the Ward-Bearers on the bar) | CONFIRMED (`gateBossBar.js`) | 4: the checkpoint is the Redoubt; havens, cages, Bearing, Shieldweaver, the flight bans |
| L7 | HIGH | "brand" and the Vestige families collide with the Sigil Sets and a parkour move | CONFIRMED | 4: decrees; Stone, Blade, Hunt, Arcana, Fellowship; the Kindling's blow retired with Ozzath |
| L8 | HIGH | duplicate keys in one merge (Echoing, The Fraying, Unmoored) | CONFIRMED (`gateMods.js`, `sdMarks.js`) | 13: Twin Charge, Gale-Swept; The Fraying drawn as the Hour's |
| L9 | MED | the start window cannot be DFU's MessageBox (its buttons are fixed art) | CONFIRMED (`messageBox.js` `MB_BUTTONS`) | 5: DFU's list picker (`listPicker.js`), the enhanced picker |
| L10 | MED | "the count" meant three things; "hold" two | CONFIRMED | 4: the count, the balance, the stake |
| L11 | MED | DEATH-PENALTY is the port's own and runs in the world host's respawn; the Ledger row's plan | CONFIRMED (Port-Ledger A) | 15, 22; the summary's Ledger paragraph |
| L12 | MED | "Hall 1's door" is wrong for a breach started deeper | CONFIRMED | 6, 7: "the first hall" |
| L13 | MED | "four signatures" (three); aspect names differ from `GATE_ASPECTS` | CONFIRMED | 12.4: three in turn under the four aspects, named as the code names them; Garoth named |
| L14 | MED | the champion's rank drifts from the bands' | CONFIRMED | 7, 8.5: the band's champion |
| L15 | MED | two rules unbuildable as written (decree families; the lean) | CONFIRMED | 13: a family column; 14: the lean by blow kind |
| L16 | LOW | smaller collisions (Muster, Fleet, Executioner, Brotherhood, Banner, Wellspring, Soul-Warden, Hall of Wards, Sentinel, spires, an unnamed aura) | CONFIRMED | 4, 11, 12, 13, 14, 17, 18: the descent, Fleetfoot, Culling Edge, Fallen's Due, Spire's Standard, Rift-Torn, the Cairn-Keeper, the Deepest Redoubts, the Lurker, pillars, Firstlight. Two proposed renames were themselves taken (Oathbound, an Aetheric set; Last Stand, a loot power): Challenger's Oath and Battlemage's Reprieve stand instead |
| L17 | LOW | canon the page omitted (Imago Storm; the Wellhead's arena; the Seducers' wings; the council's titles) | PARTIAL (used; that Storm "ran Clan Dagon" afterwards is not carried, only that he turned on his Prince) | 3: Storm, the arena, the wings; the Armsmaster and Spellmaster |
| L18 | LOW | writing (capitalisation; "closes each Ward"; the door in circle 1; Normal and Regular; the herald's words; hedges; an unflagged placeholder; the test plan) | CONFIRMED | 2, 3, 4, 5, 18, 29 |

## Re-verification - a sixth cold lane on the revision

The revision was frozen again and read by a sixth lane against every row above, for leftover words, internal
consistency, the new code claims and clarity. It found **28** problems (3 HIGH, 17 MEDIUM, 8 LOW). Each was verified
and fixed in place; none was refuted.

| id | sev | finding | verdict | resolution |
|---|---|---|---|---|
| R1 | HIGH | the Examination lost what the company does, and its window went negative for *n* = 5-8 and under the errand floor at 4 | CONFIRMED | 12.3: each rune stood in order; `10 + 4 x max(0, runes - n)`, pinned |
| R2 | HIGH | the first hall's wake was undefined (no pull before it) | CONFIRMED | 7: it wakes when the company has arrived, or when the open window ends |
| R3 | HIGH | the stake: a void both spent and returned; a force deploy could not return a spent one; the clock cut voids short; "the opening" undefined | CONFIRMED | 21: spent by a `w` or a non-void `x`; returned by `v` or `x` `'void'`; the clock after 7 days; the opening defined (and in 6) |
| R4 | MED | "Twelve lords" (there are thirteen); "three season boards" (one is all-time) | CONFIRMED | the summary |
| R5 | MED | "the first hall" meant Hall 1 in places where a breach may start deeper | CONFIRMED | 5, 15, 16, 17, 18: Hall 1 |
| R6 | MED | the fixed first circle broke the rhythm | CONFIRMED | 7: Rift-Yard, Span, Proving Walk, Rampart, Court |
| R7 | MED | "five families, so four" did not follow; the Bargain's fifth decree; rank II undefined | CONFIRMED | 13: the formula caps at four, the Bargain may add a fifth; a rank II column |
| R8 | MED | three families and a two-of-three lean conflicted | CONFIRMED | 14: one card from the leaned family |
| R9 | MED | "1 in 3 at a Valkynaz's Redoubt" had been dropped | CONFIRMED | 17 |
| R10 | MED | tell grammar: mirrors, Feud's feint, Watchfire's dashes | CONFIRMED (`Feud-Arc.md` 7.3) | 12.2: every real blow glints, Feud's grammar exactly; 12.4: the true lord's rim light; 14: Watchfire pulses solid |
| R11 | MED | relay-applied Vestiges do read the client's blow kind | CONFIRMED | 19: named, and why a lie gains nothing |
| R12 | MED | the union floor lacked the reaction slack | CONFIRMED | 12.2 |
| R13 | MED | a chained shape could be built with a 0.6 s wind-up, under the floor | CONFIRMED | 12.2, 13: telegraphed at the landing, landing max(0.6 s, its floor) later |
| R14 | MED | the Spire's embers never reached `EMBERS_EARNED_SQL`; the sink misread the Broker's stock law | CONFIRMED (`accounts.js`; SET7's day stock) | 17, 21 |
| R15 | MED | Culling Edge passed the 1.25 cap at every rank | CONFIRMED | 14: declared factors at most 1.25, relay-established at most 1.6 |
| R16 | MED | a reload returned to the arrival plate, the dodge the socket rule forbids | CONFIRMED | 20 |
| R17 | MED | The Hour Turns and Unbroken live in `sigilSetPowers.js`; a garbled sentence | CONFIRMED | 14 |
| R18 | MED | Clan Feud put two lords on a one-fight seam | CONFIRMED (`this._sdFight`) | 16: the band's champion beside the lord, one seam |
| R19 | MED | the Crossing's escape ran into the void; the walkway's length unbounded | CONFIRMED (`WALK_HALF_W` 3.2) | 12.3: at most 24 m, 3.0 s, the escape along it |
| R20 | MED | the call's word to the company was missing | CONFIRMED | 6, 21: `k:'call'` and *Answer the call* |
| R21 | LOW | `hostTeamHpFor` is already exported | CONFIRMED | 11, 27 |
| R22 | LOW | leftover and colliding words (Kyn Muster, warded, rite, Vengeful and Burning as affixes, respite, chains) | CONFIRMED | Kyn Levy, banned, tides, Searing and Wrathful, a quiet hall, anchors |
| R23 | LOW | the Leap's floor unnamed; Grath's crack short; the elite Cleave "at the floor"; wind-ups missing | CONFIRMED | 11, 12.2, 12.3 |
| R24 | LOW | `why` values undefined or missing; a first fall's receipt unstated | CONFIRMED | 21 |
| R25 | LOW | `BOSS_CARD_PER_MILLE` is per kind | CONFIRMED (`bossCards.js`) | 17 |
| R26 | LOW | versions moved (`world192`, `acct112`); bare paths; a section reference; "the edge of the Shade" | CONFIRMED | 16, 17, 20, 21 |
| R27 | LOW | smaller gaps: unshipped Valkynaz, Legion-Lord, the Colossus's hearts, Divers' ground, Marks kinds, earners, resonance, the haven keyline, the Nova's damage, Vengeful in the cap, `egSpoils.js`'s slice, kinds by slice, bodies shared by two kinds | CONFIRMED | 8.2, 11, 12.3, 13, 14, 15, 17, 23, 29 |
| R28 | LOW | three rows above placed their resolutions wrongly (G10, C30, C4) | CONFIRMED | the rows corrected |

## What the audit changed, in one place

- **Lore**: canon restated from UESP and the port's book; the torn halls, the Kyn's proving ground and the Weir Keys'
  road marked as the port's invention.
- **Words**: a vocabulary table (section 4); Weir Key, Redoubt, decree, lord, the five families.
- **Protocol**:
  - opening through the hub;
  - the stake and its void;
  - `eg_live` with an expiry;
  - orders that fit `identityToken`;
  - the drain, the law pin and durability;
  - `spanFair` as an accumulator;
  - one judge for every shape.
- **Fairness**:
  - two builds;
  - the wind-up floor at the escape build with 0.5 s of slack;
  - the union floor, the CHECK class and the errand floor;
  - nothing faster with depth.
- **The run**:
  - the rhythm and the twists;
  - the call;
  - the rest that holds the count, the respite and the surplus;
  - the recall, the witness and the bequest;
  - Reliquaries;
  - the earners.
- **The lords**: a roster with three per Galleries pool and a pool law; the Armsmaster's duel; the Colossus climbed;
  feints the engine can draw; every errand scaled for *n* = 1 to 8.
- **The economy**: weekly pay; embers at the Valkynaz Redoubts and for new depth; a pity count; the Broker's sink;
  Vestige caps; death saves at the Redoubt.
- **The boards**: the Descent from the first hall in three brackets, the Depths and the Deepest Redoubts.
- **The pace**: re-modelled under the revised rules. The last word, not the count, stops a strong company, and
  starting deeper is how the Wellhead is reached.

## Sources

- UESP: Lore:Battlespire, Lore:Weir Gate, Lore:Kyn, Lore:Sigil Stone, Lore:Soul Cairn, Lore:Shade Perilous,
  Lore:Havoc Wellhead, Lore:Imago Storm, Lore:Xivilai Moath.
- The tree at 177a3acd6, `src/systems/portBooks.js`, and lane 2's scripts. Lane 2's scripts and the re-run model
  (`pace.mjs`) live in the session's scratchpad and are not committed.
