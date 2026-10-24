# AUDIT KG (2026-10-13) - The King's Gambit, audited

The owner, of the King's Gambit's work (`11-Multiplayer/Kings-Gambit.md`: KG0, the design record and its decisions;
KG1, the law, `src/net/kingsGambit.js`; KG2, the innkeeper's play at a regular's chair, `src/systems/gambit/gambitPatrons.js`,
and its measure - the branch at 3b50a59b5): **"Audit this and ensure absolute perfection. Ensure any of the UI is
enhanced plus, our own coat and easily understandable/readable"**. This page is the findings, each with its verdict.
What the audit changed is written into the record's sections as they now stand, each marked AUDIT KG and its id, and
summed up in its section 13; the UI the owner asked for is its section 14.

## How it was run

Four lanes, each a cold adversarial reader of a FROZEN snapshot (the branch at 3b50a59b5 - Home.md's DO NOT FIX WHILE
THE VERIFIER IS READING: the fixes waited in a scratch worktree until every lane had reported), each told to prove a
finding against the code, the mod's decompiled C# and its IL, a test or a browser before reporting it; then the
author's own lane, and every finding read again against the code or the C# by the author before it was acted on:

| Lane | Over | How |
|---|---|---|
| A - the law | `src/net/kingsGambit.js`, `test/net/kg1_law.test.js`, `tools/mutants/kg1.json`, sections 2 and 11 | line by line against the C# and its IL; an independent transliteration of the C#'s game driven against the port on identical sources over 3,000 seeded games and 7.37 million steps, lawful and unlawful commands from both sides (0 mismatches); every recorded mutant and its own on a scratch copy |
| B - the play | `src/systems/gambit/gambitPatrons.js`, `tools/kgMeasure.mjs`, `test/tooling/kg2_patrons.test.js`, `tools/mutants/kg2.json`, sections 2.7, 10.5, 10.7 and 12 | AiAction rule by rule against the IL (the order of draws, float32 at each step, every comparison); 800 games replayed decision for decision (98,442 decisions) against each mutant recorded as equivalent; the measure run again at another seed and played on past its caps |
| C - the record | every claim of the record and its index lines | each against the code, the C#, the prop's geometry (the real `iliacPlaces` from every chair), the gates; the measure's 8,000 games run again |
| D - the UI | the record's panel and cloth plans, against Enhanced Plus, the house's own coat and Plain Words | Hold'em's and Iliac Hand's panels - the two the game's panel was to copy - painted by their real painters in headless Chromium under the enhanced and the Plus sheets, at 390x844 and 1280x800; every planned mark's contrast on the four layouts' and the Open field's floor tones |
| The author | the fixes; the record's own words | every lane's reproduction run again before acting; the measure run whole after the fixes (8,000 games); every mutant run |

Nothing found harmed a game a player can reach: no screen of The King's Gambit exists yet, and the law and the play have
no caller until KG3. The findings are a law that leaned at float64 where the mod leans at float32 and could spin on a
stuck source, a measure built on a claim the rules break, three mutants recorded as equivalent that are not, a board
laid by a rule the record misread and a pieces' look decided twice, a UI plan that copied two panels outside the
house's kit and the mod's own palette and words, and pins that held less than they said. While the lanes read, main
took CARDS-PLUS (#869), which dressed the two card panels in the kit through one shared kit; the record's UI builds on
it (D1).

## Findings

| # | Sev | Finding | Verdict |
|---|---|---|---|
| A1 / B6 / C11 | HIGH | AutoFill's lean compared NextDouble at float64 (`nextDouble(rand32) < KG_AUTOFILL_LEAN`) where the C# compares Unity's float `Random.value < 0.5f` (IL `ldc.r4 0.5`, `bge.un.s`) - the 64 raw draws 2147483584 to 2147483647 round up to 0.5f and do not lean in the mod, and leaned in the port; the record and KG2's own module said Random.value is NextDouble at float32 | FIXED: `f32(nextDouble(rand32)) < f32(KG_AUTOFILL_LEAN)` (section 11); pinned at raw 2147483583 (leans) and 2147483584 (does not); KG1-lean-f64 dead |
| C1 | HIGH | Section 5.3 laid the board "square to the line between the two chairs", citing `iliacPlaces` - whose rule since AUDIT CARDS-6 B3 is square to the line from the cloth's middle to seat 0's chair, 23.8 degrees off the table's short axis from a long-side chair; a board laid so fits 5.13 cm cells, askew on the felt, and the 7.08 cm the record carried into 10.1, 10.7 and Active-Arcs is never reached | FIXED: DECIDED along the table's own axes, Hold'em's way - 7.08 cm cells from a long side, 6.13 from an end, the guest's side the head whatever chair it takes; Iliac Hand's lay recorded as NOT CHOSEN, with its figure; `world/iliacCloth.js`'s header no longer names the old rule |
| C2 | HIGH | Section 5.4 (the proposal: a bar on the base, a blow's lunge, a fade) and 10.1 (a bar over the card's top, a tip, a fall to the fallen pile) both bound KG4 | FIXED: 5.4 defers to 10.1, the mod's own place for the bar |
| B1 | HIGH | KG2-move-king, KG2-move-king-up and KG2-jitter (the king's 20 at 19 and 21, the jitter at 0.2) were recorded equivalent on a half-point-grid argument; float32 rounding after the jitter decides ties at a score's binade - 63.5 parts two draws that 64.5 ties, 64 ties two that 63 parts, and 0.2f (exactly twice 0.1f) parts draws 0.1 rounds together. The measure's own play parted 0.1 from 0.2 (Seasoned, seed 7, game 143, its first action) | FIXED: the three are mutants like any other, dead on three boards built at float32's edges (`test/tooling/kg2_patrons.test.js`, AT FLOAT32); section 12's "decide nothing" sentence replaced by THE ROUNDING DECIDES |
| D19 | HIGH | The cloth's marks planned in the mod's colours told by colour alone: the two sides' blue and red 1.00:1 in grey, reach against range 1.13:1, a target's fill 1.18:1 on the Pillared hall, the loss number 1.61:1 on the Moat and bridges' light floor | FIXED: section 14.8 and 10.1, 10.7 - the sides light and dark (the kit's bone and dark stone) and shaped apart, every mark double-edged (3.9:1 or better on every floor), reach a wash, range an outline, a target a blood ring with a sword, the numbers signed in the pixel face with a hard outline |
| D1 | HIGH | Hold'em's `.dfcards` and Iliac Hand's `.dfiliac` panels are in no role of the stone-and-brass kit - Georgia, words at 11 and 12 px, a 1 px gold line on a plate of their own, none of the Plus themes or DFO Grimoire's dress - though both shipped after PLUS-DRESS; the game's panel was to copy them, and opens from Hold'em's | FIXED ON MAIN THE SAME DAY by CARDS-PLUS (#869, `11-Multiplayer/Tavern-Cards.md` section 38), which landed while this audit ran: both panels in the kit through a shared kit, `ui/card/cardPanelKit.js` (the chrome, the classic skin's cut, the fold's words). The slice this audit had planned for it, KG-COAT, is withdrawn, and the game's panel is the third to wear that kit (14.1) |
| A2 | MED | `autoFill` drew from the source as handed, so a source stuck where drawBelow throws every draw back (0xFFFFFFFF for a list of 46) spun it for ever - and `dealRegular` calls it before `newGambit` can refuse the source | FIXED: Auto-fill draws through the law's checked source (`checkedRand32`, exported) and answers null for a broken one, which `newGambit` refuses; pinned (a non-integer, a dry script, a stuck source; `dealRegular` refusing one); KG1-autofill-unchecked dead |
| B3 / C7 | MED | The measure stopped a game at the two kings alone, on the claim (its header, section 12, Active-Arcs and the pull request's body) that neither king ever moves again - a blunder walks a lone king, and 'kings' games were decided inside the 200-round cap (five in the record's own first 200 at seed 1) | FIXED: every game played to its end or to the cap, one undecided then counted by what stands; the whole measure run again and every figure re-derived (section 12, 10.7); the claim corrected everywhere; KG2-measure-kings-stopped dead |
| D2 | MED | Section 5.5 copied Iliac Hand's painter and named no role, no kit, no Plus theme, no dress | FIXED: 5.5 and 14.1 - the kit by role, the panel's sheet writing layout and ink only |
| D3 | MED | No face named; the panels copied set Georgia on the root and every button, so TEXT-FONT reached them only through `!important` | FIXED: 14.1 - the chrome's pixel face on the root, never another family nor `!important` (the two panels' Georgia: CARDS-PLUS) |
| D4 | MED | No type sizes; the copied panels put a reader's words at 11 and 12 px | FIXED: 14.2 - the chrome's parts at the chrome's sizes, the game's reading blocks at 15 px, nothing under 12, the sheet in FONT3's floor pin |
| D5 | MED | No finger sizes; the copied panels' presses measure 21 to 26 px on a 390 px phone | FIXED: 14.3 - the chrome's coarse-pointer 44 px (the two panels': CARDS-PLUS, its audit's E5) and the game's own tiles and rows the same |
| D6 | MED | The press on the cloth: a column is 26 px at best on an upright phone, and a move or a blow is spent at once | FIXED: 14.3 - a 22 px snap, a touch press that stages before it spends |
| D7 | MED | Information by hover alone - the piece's line, the range, the cards' rules in a `title` | FIXED: 14.3, 10.7 - a press shows what a hover does |
| D8 | MED | No what-it-is, no next step, no guide, no words list; a TUT1 page cannot hold the game | FIXED: 14.4 - the four plain-words blocks, the guide open until a first game |
| D10 | MED | The mod's words verbatim: "He will not sit down ...", "He has had a few drinks ...", "plus N gold from the innkeeper", "click", "sqrt(HP x Attack)", a name glued to translated words | FIXED: 14.6, 10.4, 10.5, 10.7 - no pronoun guessed, the regular named, "press", the cost in words, one sentence one pattern |
| D13 | MED | A regular's row a name and a blurb; what a stake wins or loses unsaid until it is down | FIXED: 10.5, 14.5 - what makes the tier hard, the night's purse, the stake's outcome under the picks |
| D14 | MED | Refusals planned as disabled presses; no words for the law's refusal words; the copied panels fade a refusal to 2.83:1 | FIXED: 10.7, 14.3, 14.5, 14.9 - pressable, saying why, every refusal word said |
| D15 | MED | Presses that cost gold (Forfeit; Stand up mid-game) unmarked | FIXED: 14.3 - the warn role, the cost in the label, a second press |
| D17 | MED | No phone layout; the copied panels cover 59% and 67% of a phone and stand over the board on a desktop | FIXED: 14.7 - a sheet and a strip, the board's box kept clear (the probe) |
| D18 | MED | No keyboard or pad way to a cell | FIXED: 14.3 - a cell cursor on the arrows and the d-pad |
| D20 | MED | The mod's IMGUI palette on the cloth: a yellow selection, the mod's highlights, a red-to-green bar, tinted numbers | FIXED: 14.8, 10.1, 10.7 - the house's coat: brass selection, the vitals' meter, the warn role's blood |
| D23 | MED | No slice carried a UI acceptance | FIXED: section 7's four UI rules; section 8's KG3 and KG4 rows; 14.9's pins and the three panels' one probe |
| K1 | MED | The author's: the regulars are of both genders, and the record, the KG2 module, its tests, its Ledger row, Active-Arcs and the pull request's body called every one "he" | FIXED: each the regular, or the regular's name |
| A3 | LOW | A hole in an army (`[0, , 1]`) passed `armyRefusal` (`every` steps over it) and `newGambit` then threw; a hole in the armies, potions or budgets passed too | FIXED: every index read (`Array.from`; each side by its index); pinned; four mutants dead |
| A4 | LOW | The law throws, not refuses, on a malformed state - a forward risk where KG5 stores tables | DEFERRED TO KG5, recorded (5.8, 11): the relay checks a stored table's state when the room loads it; the law trusts the states it mints |
| A5 | LOW | A ranged blow at one cell (no shot) unpinned - KG4 draws the bolt off the flag | FIXED: pinned; KG1-shot-adjacent dead |
| A6 | LOW | The blow's float32 multiplier unpinned: the 4.5 pin passes a float64 multiplier and an unrounded draw | FIXED: pinned on a Lich's 38 and a Gargoyle's 28; two mutants dead |
| A7 | LOW | SpawnHazardPair's forty tries pinned from above only (39 survived) | FIXED: every try drawn, and a pair laid at the fortieth; dead |
| A8 | LOW | A hazard's try on water unpinned | FIXED: a try on the moat's water refused; dead |
| A9 | LOW | The sight line pinned at four cells only (`d > 2`, `d > 3` survived) | FIXED: refused shots behind a wall at two and three; both dead |
| A10 | LOW | The guest's potions never drunk in a test | FIXED: a guest's potion and its own 'potions' refusal; two mutants dead |
| A11 | LOW | The moat's bridge range pinned by one value (a divisor's bound read it alike), and the 1009 comment claimed no divisor could | FIXED: a moat bridged at 4; the comment says when a divisor reads alike; dead |
| A12 | LOW | The source's bound unpinned (100 survived, and would refuse lawful deals) and its negative check removable | FIXED: the bound pinned, the thirty failures' 519 draws dealt through `newGambit`, -4294967295 refused; two mutants dead |
| B2 | LOW | Weak pins in the play: the escape's bite by kind, a boxed piece giving way to the next, the escape's order, the move's, the escape's and the blow's scores and the strike's coin at float64, the blunder's foe by its place | FIXED: a board for each in `test/tooling/kg2_patrons.test.js`; eight mutants dead |
| B8 | LOW | The play's inputs unguarded: a stuck source hung drawBelow, a non-integer one always blundered, a tier whose blunder is no number never blundered | FIXED: a step draws through `checkedRand32`, and a broken source or such a tier takes no step (null, never a silent End turn); pinned; three mutants dead |
| C3 | LOW | Two first guesses for the online turn clock (5.8's 45 s, 10.7's 60 s) | FIXED: 5.8 says 60 s and names Iliac Hand's 45 as Iliac Hand's |
| C4 | LOW | AutoFill filed under KG2 in sections 4 and 8 | FIXED: the law's, KG1; the regular's army through it |
| C5 | LOW | The starter deck "nine units" in a list of ten | FIXED: ten |
| C6 | LOW | Section 11 called `nextDouble` unexported, its correction appended | FIXED: the sentence retired |
| C8 | LOW | 10.1's lunge doubled the mod's (0.3 and 0.12 of a cell; the mod's height is 0.15 and 0.06) | FIXED |
| C9 | LOW | 2.9 read OnConnectionLost as the dropped peer's loss - whichever client stops hearing pays itself the pot | FIXED |
| C10 | LOW | Section 1 counted the stake arrays among those the C# view cannot show | FIXED: three sound tables alone |
| C12 | LOW | Stale lines: 6's "if chosen", 5.4's "the proposal", 5.7's open MEASURE, 5.8's relay bundle without `systems/mathf.js`, Active-Arcs' "the owner's call", Page-Index's "before any code" | FIXED, each |
| C13 | LOW | KG3 "the first playable game" while the press on a cell was KG4's | FIXED: the press, staged, in KG3 |
| D9 | LOW | Numbers typed in the plan; the stake's with no export to read | FIXED: 14.4 - every figure the law's; KG3 exports the stake's |
| D11 | LOW | A unit's "cost in gold" | FIXED: 10.2 - points, never gold |
| D12 | LOW | Iliac Hand's gem and shield on a gambit face (a Rat's 1 and 1 beside its 6 points) | FIXED: 5.1, 14.1 - picture-only faces |
| D16 | LOW | The log unsized, untabled, and cut in the copied panels | FIXED for the game's panel: 14.5, 10.7 - the chrome's log, its sentences tabled before KG3, each to fit a line. RECORDED: the shared chrome (`ui/card/cardPanelKit.js`, CARDS-PLUS) still cuts a line too long for it - `white-space: nowrap` and an ellipsis, so its scroll stands on whole lines - where FONT1 F8 asks a long line wrapped whole (lane D measured Hold'em's showdown line, 522 px of words in a 328 px line); the three panels' one home, for the card tables' next change |
| D21 | LOW | The tutorial plan: the ratchet, `page()` reading a getter at load, the stale 'tavern-cards' page, the seam, a covered panel | FIXED: 14.5, 10.7 |
| D22 | LOW | Words the ratchet or the text core will refuse: the other panels' press, barks, the Features row, units' and kings' names | FIXED: 14.6, 10.4 |
| C14 | NOTE | 10.7's lean first guess could not see the player's own four nearest rows | FIXED: a first guess that keeps the whole depth in view; a phone upright left to the probe |
| C15 | NOTE | The log's 12 lines are the port's: the mod's AddLog keeps two | FIXED: marked |
| C16 | NOTE | The tutorial page cannot name a crown (the catalogue's pin refuses "Daggerfall") | RECORDED: 10.7, 14.5 |
| C17 | NOTE | The credit needs an author (CR1); the owner has named none | RECORDED: 10.7 - the credits' unnamed form until then |
| C18 | NOTE | The Features row needs declaring by id (WM3) - the bundle ships no settings | RECORDED: 10.7 |
| C21 | NOTE | The Grizzly Bear was the Dreugh's rules twin (3, 4, common, the same Reveal); KG-SET will move `test/systems/loot/cards8_catalog.test.js`'s pins | FIXED: the Bear a 3/5 that tires (its effect valid, its words `fxText`'s); KG-SET's pins listed (10.3) |
| C22 | NOTE | 10.1's walk along the path is the port's own (the mod slides straight), and the move event carries only its ends | RECORDED: 10.1 - KG4 walks GetReachable's first-met path on the state before the move |
| C23 | NOTE | 5.9 had the save's question the wrong way round | FIXED: world.js asks the modes |
| C24 | NOTE | 2.9 omitted RETRACT; KG6's stakes need an escrow arm of their own; the bundle's own facts (sizes, hashes) cannot be read again - it is not in the tree | FIXED: RETRACT in 2.9, KG6's arm in 5.8; the bundle's facts stand as read at KG0 |
| A13 | NOTE | Strict float32 is one of two readings ECMA-335 allows the blow (a runtime may keep the product wide) | RECORDED: section 11 - the narrow reading kept and pinned (A6) |
| A14 / C19 | NOTE | Mutants no game can fail: the host's fall read first, MapIsPlayable at float64 or `>`, `blowRoll`'s least 0, MakeUnit at float64, the sight line's samples at 3, AutoFill's 200 rounds (never more than twelve run) | RECORDED: section 4 no longer calls the 97% and the 200 rounds pinned by play; THE END's test title no longer claims an order no game shows |
| A15 | NOTE | The roster's ties sorted by English names; the mod sorted by the player's language's | RECORDED: 11, 10.2 - one roster for the law; KG3's grid sorts a cost's ties by the names the player reads |
| B4 / C20 | NOTE | "No decided game ran past 68" was one sample's (the published run reached 84) | FIXED with B3: the measure says its longest decided game (189) |
| B5 | NOTE | The measure's neighbouring games' first draws correlated at -0.48 (xorshift32 seeded with near seeds) | FIXED: each game's seed mixed by MurmurHash3's finalizer; pinned (lag-1 under 0.1); dead |
| B7 | NOTE | Unity's `Random.value` is [0, 1], both ends - the record wrote [0, 0.1) and [0, 1); "9 of 30 drinks" pins no float32 | FIXED: 2.7, `escapeCell`'s doc; section 12 says the potion's float32 is kept, unpinnable |
| B9 | NOTE | The purse note counted undecided games as no gold without saying so | FIXED: 10.7 says so; its figures re-derived from the new measure |

## Pinned

`test/net/kg1_law.test.js` (18 tests): A1's lean at its float32 edge, A2's broken sources, A3's holes, A5-A12 each.
`test/tooling/kg2_patrons.test.js` (11 tests - AT FLOAT32 new): B1's three boards and B2's six, B8's broken source and unread
tiers, the step's guards with no draw taken, a stuck source at the deal, and the measure's miniature again - its
tallies under the new measure, a game counted 'kings' and one 'long' at the cap, two kings alone played on to round
189, and the games' seeds mixed. Mutants: `tools/mutants/kg1.json` 98 (AUDIT KG's eighteen and three re-aimed by
content), all dead; `tools/mutants/kg2.json` 108 (AUDIT KG's thirteen, the three equivalents made mutants, one
re-aimed by content), all dead - one survived its first run (KG2-step-ending: the checked source answered null for an
empty script before the guard was reached; the guards are pinned now with sources that would choose a blow, and no
draw taken), and dies.
