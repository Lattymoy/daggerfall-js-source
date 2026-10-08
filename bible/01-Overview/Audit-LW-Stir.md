# AUDIT LW-STIR

## AUDIT LW-STIR - LW-STIR audited, 2026-10-08

Mac: *"Lets audit everything and ensure perfection"*, of LW-STIR (`06-Systems/Living-World.md`, Mac: "I say we improve
the living world and go deeper. Having spontaneous interactions, like a traveller being hostile with a guard and other
smaller details that make the world feel more alive") - the watch's word at the gate and on its rounds, the town's
quarrels, haggles and pleas, the street hushing and turning to look, its small voices. The audit was begun on the head
LW-STIR left (`fe5c7ba4c`) and its first finding settled there (F1); its lenses never reported, and the branch was taken
up again on main (#699) - so the lenses were run on that merge (`a35acc7c1`, frozen in a detached worktree so no fix
moved under a verdict - Home.md, 17l): **the dealer's math and laws** (A: `stir.js` and its words), **the street and
every reader** (B: `livingTown.js`'s staging, the bodies, the speech, the cost), **the plans and the hosts** (C: the
`gate` stay, every reader of a plan, the four hosts, save and load) and **the pins' and the record's honesty** (D) -
four independent adversarial reviewers, never in the repository - and this session's own (F). **The game's own towns
(E) were not run**: the container the audit was taken up in holds no ARENA2 and can reach none, so every number here is
the synthetic towns' (`test/lwTown.mjs`), and the measured table's real-town rows stand unmeasured again (`Living-World.md`
says so beneath it).

Every finding was reproduced before it was fixed - each lens's own probe, and each probe run again on the fixed tree.
Every fix's pin fails on the code as it stood before it - proven by its mutants (`tools/mutants/auditlwstir.json`), each
the old line put back. Each change carries an `AUDIT LW-STIR` comment.

### Fixed

| ID | Sev | Finding | Fix |
|---|---|---|---|
| B1 = C1 | Major | **The day's incidents were kept by who was in town, not by their plans.** `_stirOf` kept a day's deal while the same ids stood the day, and the plans are made again with the same people: the roads' word come after a reader's first census (the host answers nothing while its ways are asked), a harbour sounded late, a crew's arrival moved. The reader there before kept the day the old plans dealt: a morning of the 4 x 4 town staged apart from a reader come after at 2,292 of 8,401 beats, a traveller on the road staged at 372; the harbour's, 12 incidents apart; a stall's keeper held silent a whole round in an incident that was no longer dealt. | Kept by the plans too (`_planGen`, as LW-SPACE's `_walksFrom` is - the generation after the deal, so the plans the deal itself made count): no beat apart, no traveller staged, the harbour's and the crew's deals alike. |
| A1 | Major (latent) | **A gate's word was lost once the clock passed 2^24 minutes.** The word is laid to end where the halt does, and `lay` allowed its sum 1e-9 over; at 2^24 a bit of the clock is 3.7e-9, so a sum one bit long was refused, the next round's try could never end by the halt's end, and the stranger stood the halt out unquestioned - 416 of 955 halts a day at the online sky's 0.4 minutes a second. The online sky reaches 2^24 minutes on 2028-01-07 (`skyLaw.js`; offline the clock starts at 523,530). | The slack a few of the sum's last bits, never under 1e-9 (`stir.js slack`): 955 of 955. |
| A2 | Minor | **A second party halted in a round another's word held stood its halt out unquestioned.** `gateHalt` sizes each party's halt for a word of its own, and the street has one incident at a spot a round: two parties a minute apart at one gate, the second halted 4.8 minutes and asked nothing (684 such pairs in the lens's days); "every halt questioned" was the record's, and LW-STIR's own pin title said "waits on, and is waved through". | One party's word a round of a gate's: `stir.js gateWord` names the round a halt's word falls in, and `livingTown.js _gateOf` takes the parties come in by the gate in the order they come - a party whose word's round an earlier one holds is waved through, in at once. Every halt the plans keep is questioned (the lens's town: 99 of 99, 101 of 101). |
| A3 | Minor | **A quarrel was laid with nobody stepping in while the watch stood through it.** The watch that steps in was chosen before the quarrel was laid - the first on duty there in time - and only it was asked to stand through the words: at a handover the one leaving was chosen, and the quarrel went on unbroken while the one come on stood beside it (3 of 5 laid so, three shouted lines each). | Chosen as the words are laid, on each try: whichever of the watch stands through them. |
| A4 = B3 | Minor | **A beggar's plea took a stall's keeper off their stall.** A plea always kept the beggar's stand, so a keeper asked at their stall walked to the beggar's (85 of 330 pleas, 61 keepers alone at the stall moved a median 2.18 m, to 4.90 m) - against the record's "the one who keeps their stand - a beggar, a stall's keeper". | Put to a keeper at the stall, the beggar come to it (`anchor` 1): of the 61 keepers asked alone at their stall, 57 stand where they would with no plea, and 4 nearer their own stand (to 2.55 m) - where the beggar's own place in a circle, left empty by the plea, had kept them off it. |
| B2 | Minor | **The day was dealt from this reader's people.** The census skipped one lent to the watch before the deal, and `peopleOf` holds a household living here beyond the census (`extraPeople`, Project Legacy's - a player's own, which another reader has not): the dealer picks partners from those there, so a lend changed incidents between others mid-word (5 of 12 cut or changed, back again when the guard went), and a reader with a household dealt the town's own incidents apart (49 of 752 in twenty days). | The lent dealt and left out, as the struck down are; the household never dealt. 0 of 12, 0 of 752. |
| B4 | Minor | **An incident's beggar or keeper was drawn as their still picture.** LW-LOOKS stands one alone at their pitch or stall as the game's still picture, alike from every side, and an incident takes its two out of their circles - so "the two turned to each other" was `where`'s alone: 12 of 12 keepers of pleas and haggles in view were the picture. | Themselves while it runs at its spot (`_stirring`), as one of a circle is: 0 of 12. A still picture among the onlookers keeps its pose (recorded below). |
| C2 | Minor | **A halt could keep a stranger from walking out.** A day visit begun before noon leaves two hours after (`trips.js`), and the halt pushes the walk in later: where the walk in from the gate and the halt passed the leaving minute, the plan's walk out was never begun - in at the tavern's door, then "away" at the gate to the day's end (174 of 6,468 halted two-hour visits of an 8 x 8 city, every door a lodging). | A party whose halt and walk in would reach their leaving is waved through (`_gateOf`'s `short`). |
| A5 | Nit | A beggar asked a stranger by name ("A septim for bread, kind Finn?" to one of Wayrest - 43 of 153 pleas to strangers), as F1's stranger named the wrong town. | A stranger is asked from the pleas that name nobody (`PLEA_UNNAMED`); one of the town still may be named. |
| A6 | Nit | Both men of a patrol's pair called the hour, a minute or two apart (8 of 14 hours) - `stir.js`'s own typedef says the second stands by. | The first of a pair calls it. |
| A7 | Nit | A pair's second could break up a quarrel beside his first (20 of 20 where his stay began first, or his id sorted first) - by the census's id scheme's luck, not a law. | Never the second of a pair. |
| B6 | Nit | A small voice was read from the plan entry at the clock: a walker held by the politeness gate owes its minutes, its plan already at the stall, and cried its wares 8.8 m short of it. | The entry where the body is (`_now` less what they owe). |
| B7 | Nit | One of an incident was held the spot's whole round: walking on after its words, they passed the player who stopped before them unspoken (9 of 9; after the round, "Good day, stranger."). | Of the incident from their coming together to its end (`_stirring`); their own after. |

### The record

| ID | Sev | Finding | Outcome |
|---|---|---|---|
| C | Minor | "The four gates of a city are posted round the clock, and every stranger comes in by one": a city of 45 blocks or more posts its four; of 36 three, of 25 one, of 16 none (no gate scene at all) - and one off a ship comes in by the dock. | FIXED (`Living-World.md`). |
| A | Nit | "The gate's, the day's and the minute's draw": the second's (`Math.round(inT * 60)`), in `Living-World.md` and `stir.js` alike. | FIXED. |
| A, B | Minor | "The watch on duty standing there through it steps in", "every halt questioned", "a stall's keeper ... where they stand", "the two turned to each other", "every reader alike" - false, each by a finding above. | True now; the section says how. |
| B5 | Nit | "Every incident's two FACE_M apart in the middle of it": on the close-built 4 x 4 town 349 of 353 - a spot of 22 or more has no place before the one who keeps their stand (`besideStand` null), and the other speaks from their own, up to 4.8 m off. Open, walled and 3 x 3 towns exact (307, 78, 210). | Said so (`Living-World.md`); recorded below. |
| - | - | The measured table is LW-STIR's, before its audit: A6 halves a pair's calls of the hour and A2 waves a few second parties through. | Said so beneath it; the real towns' rows not measured again (no ARENA2). |

### Recorded, not changed

- **B5 - no place before them.** Where a spot is crowded past it (22 or more stood about it on the close-built town), the
  street holds no place FACE_M before the one who keeps their stand; the other says their words from their own place.
  A wider ring would stand them through others' places; a dropped incident would be one reader's crowd's, not the plans'.
  Measured on the synthetic towns only; the game's own crowded squares unmeasured here.
- **B4's onlookers.** A beggar or a stall's keeper among those turning to a shout keeps their still picture, which faces
  nobody: a picture keeps its pose (LW-LOOKS: themselves again only when they go on or join a circle).
- **C2's elder half.** A visitor whose walk in from the gate is longer than their stay never walks out at all (3,045 of
  6,468 two-hour visits of the 8 x 8 city, every door a lodging - LW3's `runAway`, before LW-STIR); the real producer
  lodges them at a tavern, which the lens did not measure apart. LW3's, recorded for its own slice.
- **The lens's unconfirmed.** A round straddling 04:00 holding one incident of each day (no real plans reached it); a
  `sandstorm` calling the hour as fair weather (the world's weather holds none outside the dev override); a song cut at
  its slot's edge above 0.88 minutes a second (the rates are 0.2 and 0.4); the people in town changing mid-day dealing a
  word under way again (0 of 25 when a packet made fast, 0 of 15 across 120 edges); one in incidents at two spots at once
  (0 in twenty days of the 8 x 8 town).
- **The cost.** A census beat 0.46 -> 0.52 ms on the 8 x 8 town (327 people), a deal 2.4 ms, its kept check 18.6 µs; one
  deal across the 04:00 turn. Keyed by the plans now (B1), a deal is made again when a plan is.

### The four hosts

LW-STIR's law is the living town's (`stir.js`, `livingTown.js`). `scenes/world.js` - WIRED as LW-STIR has it (the line
layer passes each line's kind; `ui/navalHud.js` draws a shout and a song their own way); `scenes/worldModes.js` -
FLAGGED: no incident indoors (a room's talk is LW8b's, all talk); `scenes/exterior.js` - FLAGGED as LW2 has it (no living
town); `scenes/dungeonContext.js` - no town. Lens C found each claim true; this audit changes no host.

### Pins and mutants

`test/auditlwstir.test.js` (14): F1; A1 past 2^24 at the online rate; A2 the gate's rounds; A3 the handover; A4 the
plea at the stall; A5 no name to a stranger; A6 the pair's hour; A7 the pair's second; B1/C1 the roads' word come late;
B2 the lent and the household; B4 the bodies drawn (real `ResidentWalker`s); B6 the held walker; B7 after the words; C2
the walk out. PIN MOVED: `lwstir_street` (the gate test's title - a second party waved through; its visitors leave no
sooner than the roads let one, two hours after they come in: those in after five had left before they came, and C2
waved them through), `auditlwstir`'s F1 (the same). `tools/mutants/auditlwstir.json` (22, all dead); `lwstir.json`
LW-STIR-gate-share, -break-up, -round, -quarrel-by-pair, -quarrel-once, -call-hours, -call-duty and -halt-post re-aimed
by content (-halt-post survived its first re-aim - `_gateHalt` answered only for the roads' arrivals, so the pin probing
other minutes read nothing; `_gateHalt` judges any minute again), all 55 dead.
