# AUDIT 49 - the Road-to-1:1 campaign, audited, 2026-09-01/02

**On the number.** AUDIT 44 was a measurement; 49 is the record of what
was done with it (45-48 are the other lane's - the Roads and Enhanced
Environments arcs that ran on main beside this campaign). It has no working label in the code, because the
campaign never ran under one: the work carries WAVE labels (ROAD-A,
ROAD-B, ROAD-C, ROAD-D and the closeout), its tests are
`road_a*`/`roadb_*`/`roadc_*`/`road_d*`/`waveD_*`, and its audit rounds
are named for the flights they audited. 44 measured a tree; 49 audits a
campaign - five adversarial review rounds over four waves plus a
closeout, inside a **twenty-two-hour commit window** (2026-09-01 11:54
UTC to 2026-09-02 09:58 UTC), on top of a live-site incident that
happened while the first wave was still merging.

## The method

Unchanged from 44 in every part that matters, and applied to the fixes
rather than to the tree: **build in an isolated worktree, review
adversarially, verify before fixing, fix in a second worktree round, one
gate.** Two rules were tightened.

**The exact wrong value.** The forensic fleet of the 2026-09-01 incident
was required to produce the wrong value, not a suspicion; the closeout
audit inherited that rule and every one of its 42 confirmed findings
carries a `CONFIRMED - reproduced from code, and the exact wrong value
obtained` verdict with the reference line beside the ported line. The
rule is what killed 14 findings whose mechanics were all real.

**A recorded remainder is not a finding.** Every wave group recorded
what it did NOT ship, at the site and in its report. Eight of the
closeout's 14 refutations are exactly this: the mechanics reproduce, the
gap is real, and it was disclosed in advance by the group that left it.
An audit that does not read the builder's own record spends its
verification budget re-finding it.

**Find.** Five review rounds, 32 lenses in total: the Wave A round (5
lanes, one per band - world/season, motor+input, systems, UI, tests+docs),
the C1/flight-1 round (3: bow, rest, tests), the flight-2 round (6:
parity-dungeon, parity-exterior, seams, cross-agent, test-quality,
record-consistency), the CLOSEOUT audit (13: one per wave band, plus
cross-wave seams, dead paths, test quality, perf/regressions, the
record, and the incident+bow lane), and the Wave D round (5: two
build-band lanes, seams+cross-group, test-quality, record).

**Build and fix.** 55 worktree groups: 12 Wave A slice groups, 4 Wave A
review-fix groups, 4 Wave B groups plus B5, 2 Wave C ports (the save
window and automap flight 1), 6 flight-2 stage groups, 4 flight-2
review-fix lanes, 6 closeout fix lanes, 6 flag-retirement lanes, and 10
Wave D groups. Plus the 3 forensic lanes of the incident.

## The count

**145 findings judged across the five rounds: 118 confirmed, 27
refuted.** By round: Wave A 18 confirmed / 1 killed; C1-flight-1 12 / 1;
flight-2 27 / 3; closeout 42 / 14; Wave D 19 / 8. Severity over the 118:
**3 critical, 56 major-or-high, 52 minor-or-medium, 7 low** (the early
rounds graded high/medium/low, the later ones major/minor; the counts are
given in both vocabularies rather than flattened).

Where they landed: **76 findings cite a file in `src/`, 30 cite `test/`,
12 cite `bible/`.** The single most-found file in the campaign is
`src/ui/exteriorAutomapWindow.js` with **14** - the largest never-before-
built surface in the campaign, built last in its flight, and reviewed
hardest.

## The defect classes

Every confirmed finding classified by the shape of the defect, not by the
subsystem it lives in. One class each, assigned from the finding's own
claim and evidence; where a defect and the pin that cemented it were
filed as one finding it is counted as the defect, and where they were
filed separately (the CORT01I0 palette and its pin, the invented automap
hotkeys and their three pins) both are counted:

| Class | n | % |
|---|---|---|
| **vacuous pin** (a test that cannot fail, or a law with no test at all) | 37 | 31% |
| **dropped term** (a term of the reference expression absent at the port site) | 26 | 22% |
| **stale record** (a comment, flag, Ledger row or doc row that has gone false) | 20 | 17% |
| **broken seam** (a correct law whose caller does not deliver it) | 17 | 14% |
| **wrong constant/string** | 12 | 10% |
| **dead path** (code, branch or table that nothing can reach) | 5 | 4% |
| **sign/direction** | 1 | 1% |

Per round, and this is the campaign's real shape:

| Round | n | const | sign | term | seam | dead | pin | record | code-defect share |
|---|---|---|---|---|---|---|---|---|---|
| Wave A review | 18 | 1 | 0 | 7 | 6 | 1 | 2 | 1 | 83% |
| C1/flight-1 review | 12 | 0 | 0 | 3 | 3 | 0 | 6 | 0 | 50% |
| flight-2 review | 27 | 6 | 1 | 5 | 3 | 2 | 5 | 5 | 63% |
| closeout audit | 42 | 4 | 0 | 11 | 5 | 2 | 14 | 6 | 52% |
| Wave D review | 19 | 1 | 0 | 0 | 0 | 0 | 10 | 8 | 5% |
| **total** | **118** | **12** | **1** | **26** | **17** | **5** | **37** | **20** | **52%** |

**61 of 118 are defects in shipped behaviour; 37 are defects in the
pins that were supposed to prove it; 20 are defects in the record that
describes it.** The trajectory is the finding: the code-defect share
falls from 83% in the first round to 5% in the last. By Wave D the
fleet had stopped shipping wrong behaviour and was shipping *unproven*
behaviour and *stale prose* instead - 18 of that round's 19 confirmed
findings are a pin that cannot fail or a sentence that has gone false.

**The recurring classes.** Two dominate and they are the same class seen
from two sides. AUDIT 44's headline shape - the broken seam, a correct
law whose caller does not deliver it - is still here (17), and the
dropped term (26) is its intra-function twin: not a missing caller but a
missing clause, `!IsPlayerInsideDungeon` gone from a two-term gate,
`Time.unscaledDeltaTime` gone from a rotation, `IgnoreCase` gone from a
row match, the DFRandom draw gone from a single-variant record. Together
they are **43 of 61 code defects, 70%**. Against them stands the
campaign's own novel class: the **vacuous pin**, 37 findings and the
largest single class in the audit. It is what happens when a fleet is
required to ship a test with every slice and is measured on a green
suite: the test gets written, and it asserts something that was already
true.

## What was broken

The three criticals, in the order they were found:

- **The default click activated the world through an open window.** A8's
  Mouse0 activate/cast frame was ungated by the overlay in 3 of the 4
  hosts: a left-click on any open native window pressed the window AND
  activated whatever the crosshair pointed at behind it, firing a readied
  spell into it. Found by the Wave A round; three of that round's other
  findings (`clickDelay` unported in two hosts, the large-HUD guard
  unported, the `touchSpell` option no host passes) are the same
  `PlayerActivate` gate arriving in pieces.
- **The exterior automap rotated the wrong way.** `exteriorRotate` moved
  the yaw opposite to DFU's camera - `RotateAround(camPos, -Vector3.up,
  -rotationAmount*dt)` read as its own negation - so rotate-around-player
  no longer held the marker. The only sign/direction defect in 118
  findings, and it was critical: on a first-ever-rendered surface, a sign
  is the whole feature.
- **The courtroom rendered solid red** - and this one is the campaign's
  sharpest lesson. The 2026-09-01 incident's fix was "a palettized IMG
  must mint its own `DFPalette`". B5's court backdrop copied that law one
  file over to `CORT01I0.IMG`, which is **not** one of `imgFile.js:23-30`'s
  six palettized names (verbatim `ImgFile.cs:477-489`), so `_readPalette`
  takes its early return, the fresh palette is never filled, and every
  pixel decodes against an unloaded table. The incident's own remedy,
  applied by analogy without re-checking its predicate, broke a screen the
  incident had not touched. **And its pin asserted the false law**, so
  the defect shipped green.

Below the criticals, the campaign's own defects in its own new work:

- **The season re-skin deleted the ground under a live player.**
  `tickSeason` tore down every built pixel - and with them every collider
  bucket and the terrain floor - while the motor kept running, then never
  re-spawned the player; `heightAt` returned `-Infinity`, so there was no
  ground at all, and the drop was billed as fall damage when it came back.
  A1 made the calendar real; that one slice produced two independent
  breakages in two days - the winter tileset the incident caught on the
  live site, and this one, which no pixel could have shown.
- **The exterior automap's whole control surface was invented.** A WASD
  hotkey table where DFU binds 30 `ExtAutomap*` shortcuts through
  `DialogShortcuts.txt` - which the port has carried since ROAD-A, in
  `src/systems/dialogShortcuts.js`, while the window's own header
  recorded a departure on the grounds that the registry does not exist.
  Drags in native 320x200 pixels where `dragSpeed` is per real screen
  pixel; a right-drag rotate missing `Time.unscaledDeltaTime`, turning
  the map ~60x per pixel; the chrome's `sound` output discarded, silencing
  all 21 button clicks; the shared tooltip and compass drawers
  re-implemented beside the ones S5 had extracted for exactly this second
  caller.
- **Two hosts got half a fix.** The infection popup became a push in two
  of the four hosts that wire it; the exhaustion push removed the slot
  refusal in two hosts and pinned the replacement latch in the third;
  `SpawnCityGuards`' `!IsPlayerInsideDungeon` term went missing from both
  of the port's entries. The class 44 named as structural did not go away
  because a fleet was pointed at it.
- **The save/load window drained one window where DFU drains the stack.**
  `PopToHUD` is `while (TopWindow != dfHUD) PopWindow()`; C1's push turned
  it into a single `PopWindow`, so saving or loading from the pause menu
  left the pause menu standing over the resumed game.
- **`restDecision` returned the producer function as its message**, so
  all four hosts would have printed a function where the prevented-rest
  text belongs.
- **The incident's own standing guard could not guard.** `test/incident_
  texture.test.js` is named by `Incident-2026-09-01.md` as THE protection
  against a repeat. Its "every palettized-IMG site in `src/`" sweep walked
  a hardcoded three-file list (missing `chargenArt.js`, the fourth site,
  where the exact incident could recur with the pin green), enumerated
  six filenames of which two were invented, asserted file-global
  substring presence rather than the palettized load, and its
  "behavioural" half asserted a variable nothing ever wrote. Seven of the
  closeout's 42 findings are this one test.

## The incident, and what it did to the campaign

The campaign's first wave broke the live site, and the record
(`Incident-2026-09-01.md`) is the campaign's own proof of what a green
suite cannot see: 5,600+ tests passing while players saw gold weapons,
mis-coloured caves and snow under deserts. Three forensic lanes, each
required to produce the exact wrong value rather than a suspicion,
returned **two BREAKS-VISUALS and one CLEARED**: the palette clobber
(the A3 prison screen's `PRIS00I0` is one of six palettized IMGs, and
`ImgFile._readPalette` wrote its embedded palette into the session's
shared `ART_PAL`), the winter tileset (A1 made the calendar real, so a
fresh boot became WINTER for the first time in the port's life and lit a
terrain path that had never drawn), and the emissive rework, cleared with
`confidence: certain` because gold could not mechanically come from
emission and reverting it would have re-broken auto-emissive flats while
leaving the real defect live. **A forensic lane that refuses to revert
the innocent change is the method working**, and it is the reason the
subtract law survived to be the thing that lights torches today.

The incident then propagated through the rest of the campaign twice, in
both directions:

- **Its remedy became the third critical.** "A palettized IMG mints its
  own `DFPalette`" was copied one file over to a file the predicate
  excludes, and the courtroom rendered solid red.
- **Its guard became a lens.** `test/incident_texture.test.js` -
  designated by the incident record as THE protection - produced **7 of
  the closeout's 42 findings**, every one of them a way the guard could
  not do its job. It has since been rebuilt to read
  `PALETTIZED_FILENAMES` from `imgFile.js` and to decode a real
  PRIS00I0-shaped buffer.

And it set the campaign's release discipline: three gated PRs in a live
bisect (#47 the solid revert, #48 the pre-Wave-A checkpoint, #49 the
repaired campaign), and the standing rule that a first-ever-rendered path
gets the owner's eyes before merge - which is why everything after Wave B's
first flight is still parked.

## What was fixed

**Every confirmed finding was closed, and the fix rounds are smaller than
the finding counts because duplicates were folded, not dropped.** Wave
A's round: 18 confirmed, 16 canonical (two were the same defect found at
a second host), 4 fix groups. The C1/flight-1 round: 12 confirmed, 11
repairs - the round's own note names the fold ("R4 and R7 are ONE defect
found by two lanes, the over-pruning rule-58 filters - fix once").
The flight-2 round: 27 confirmed, all 27 fixed across 4 lanes
(20 fix entries; the `sound`, hotkey and tooltip findings share repairs).
The closeout: 42 confirmed, all closed by 6 lanes as **33 distinct
repairs** - 14 findings were cross-lens duplicates of 4 defects (the
CORT01I0 palette named 3 times, the incident sweep 7, the dungeon-guard
gate 2, `PopToHUD` 2). Wave D's round: 19 confirmed, all closed.

What the waves themselves shipped, from the group reports:

| Wave | groups | shipped | not-a-gap | recorded |
|---|---|---|---|---|
| A - the slice band | 12 | 34 | 14 | 24 |
| B - the interacting band (B1-B4) | 4 | 11 | 12 | 11 |
| B5 - rest residue | 1 | 8 | - | 9 |
| C1 - the save/load window | 1 | 3 | - | 4 |
| C2 - the automap pair | 7 | 10 stages | - | 59 |
| D - the closable band | 10 | 39 of 42 | - | 16 |

(The "recorded" column is not comparable across waves. Wave A's 24 are
recorded STAGES - work deliberately deferred with its citation. Wave C's
59 are mostly DEPARTURES and deviations from the stage plan, each with
its Ledger row or site comment: the automap arc is the campaign's only
band where the port had to choose a shape DFU's component model does not
offer - held hotkeys at the browser's key-repeat rate, no key-up seam
for the two-phase toggle-close, an FNT plate label where DFU reloads a
yellow `DaggerfallFont` texture.)

Wave D's three unshipped slices are the honest ones: the chargen
picker's scroll-bar HIT (`chargenArt.js:731`, narrowed to itself), the
gold stack in `inventory.js:48`, and the docked large-HUD occlusion
(`hudLarge.js:56`) - each rewritten in place with the evidence rather
than left as a token.

## What was refuted, and why

**27 findings killed, 19% of everything judged** - a higher kill rate
than AUDIT 44's 6%, and it should be: this audit was pointed at fresh
work whose builders had recorded their own remainders.

The refutations sort into four shapes, and the second is the campaign's
most important procedural result:

1. **No defect against the reference** (8). The premise misread the C#,
   or the port is faithful and the auditor was not. The screenshot
   panel's `ScaleToFit` finding computed its expected value from the
   wrong source aspect. The nameplate cache-key finding asserted DFU
   re-solves plate offsets on a rename; DFU does not. The picker
   departure's "100-unit ray" names the beacon's `localScale`, not
   `RaycastAll`'s distance - the C# casts 10000. `windowStack.paused()`'s
   "unread third pillar" is unread in DFU too: `PauseWhileOpen` has six
   hits in the whole reference and no production window sets it.
   `FindStep`'s 9-ray bundle is a faithful port with a triply-recorded
   departure. `D4`'s "vacuous smash pin" was not a tautology, and its
   exhibited mutant was behaviourally equivalent under the port's wiring.
2. **The gap is real and was disclosed** (8). `playerTeleportedIntoDungeon`
   unsaved, A8's combo runtime unreachable from any host,
   `usingRightHandFromSaveVars` with no production caller,
   `teleportPlan.dungeonExitImmediate` read by nobody, `MakeEnemiesHostile`
   absent from the city-watch pool, the pushed mastery box vs the level-up
   sheet, the uncleared Castle Daggerfall teleport latch, and the
   classic-import left-hand law refuted twice from two lenses - every
   mechanical claim reproduced, and every one is a remainder the building
   group wrote down before the auditor arrived. The audit's rule held:
   **a disclosed remainder is a ledger entry, not a finding.**
3. **The record exists, in a channel the brief names** (7). Road-To-1-1's
   deferral to "the wave reports", the arrow-skin departure, the
   exterior-automap departure row, D5's automap closes, and the open-flag
   rule's own past-tense limitation - all recorded in the campaign's
   report directory, the Ledger or the site, which the audit brief names
   as dispositive.
4. **No wrong behaviour is reachable** (3). `CastWhenUsed`'s dropped item,
   D7's missing `OnPop` door, the live `castByItem` on a permanent effect
   entry - the code facts held, no host could produce the consequence, and
   in two of the three the finding's own failure scenario contradicted
   itself.

One finding died on a split vote (the moved MW-D42 pin's "never
swallowed" law, one CONFIRMED and one REFUTED against the two-vote rule),
and it is the only one in 145 that died for want of agreement rather than
for a reason.

Two refutations are worth keeping for what they became. The closeout's
`windowStack.paused()` refutation - "the distinguishing branch is
unreachable in DFU itself" - sits beside a CONFIRMED finding on the same
function saying the second arm is dead code and its pin passes with the
arm deleted; the fix collapsed `paused()` to `return gamePaused;` and
recorded why DFU needs both terms. And the Wave A round killed a finding
that `Home.md`'s board counts past-tense closure notes as open flags,
because that is a recorded limitation of the open-flag rule. It was a
correct refutation and a symptom: four rounds later the closeout's triage
found **69 of 145 flags stale**, most of them that exact shape, and
retired them wholesale. **A recorded limitation is a refutation once and
a policy problem forever.**

## The flag ledger

The campaign's second front. `Home.md`'s generated open-flags list is
mechanically derived from the FLAGGED/INTERIM sites in `src/` and pinned
both ways by `test/audit18_bible_docs.test.js`, so it cannot be edited
into agreement - the flags themselves have to move.

**All 145 flag sites were triaged against the tree and the reference:
69 stale (the work they name has shipped), 42 closable (real, small,
routable), 24 not-a-gap (accurate sentences describing DFU's own
behaviour, mis-read as gaps), 10 blocked (no 1:1 target, or a blocker
outside the site's scope).** The 93 stale-and-not-a-gap flags across 54
files went to 6 retirement lanes, which **retired 96 sites** (three more
turned up inside the same docstrings) and **kept 2** with their reasons -
`buildingLocks.js:60`'s `ownsShip`, genuinely open, and one already
deleted by the fix round. The 42 closable flags became Wave D's 42
slices.

Measured on `bible/Home.md` at each integration: **152 open flags at the
campaign's start, 144 after the closeout fixes, 53 after the retirement
lanes, 17 at the campaign's end.** What survives is the blocked set plus
the three Wave D narrowed rather than shipped.

## The suite

`bible/09-Testing/Testing.md` at `d6e9f01`: **5341 tests across 545
files.** At `c3c12ee`: **6016 tests across 588 files**. Run bare at
`c3c12ee`: **6017 tests, 5810 pass, 0 fail, 207 data-gated skips, 85s.**
**+676 tests, +43 test files** over the campaign - and Testing.md's
headline is one behind the runner, the smallest stale record in the tree.

The tree itself: **302 files changed, +40,797/-2,898 over 125 commits**;
154 `src/` files touched, 22 new `src/` modules, 137 `test/` files
touched; `src/` grew from **478 modules / 167,507 lines** to **500 /
185,899**.

Three of those 676 tests are worth naming, because they are the ones the
audit had to write to make the rest honest: the split of
`roadb_exterior_water.test.js`'s swim table out from behind its
DFU-gated skip (four pure-JS assertions that had never once run in CI),
the `PALETTIZED_FILENAMES` export that lets the incident sweep read the
real six names from `imgFile.js` instead of an invented list, and the
`a8_pointer.test.js` castPending frame rebuilt as an `ActionComplete`
frame so the consume branch is the only thing between the cast's click
and the activation.

## The tail

The campaign's own backlog, recorded rather than shipped, and the place
the next audit should start reading instead of re-finding: Wave A's **24
recorded stages**, Wave B's **11** and B5's **9**, Wave C's **63**
departures and plan deviations (59 in the automap arc alone), Wave D's
**16**, and the flag triage's **10 blocked** sites - the ones with no 1:1
target at all (there is no standalone dungeon scene in DFU to port a
`?dungeon` route's window seams from) or whose blocker is host scope
rather than a missing law (Recall's arrival needs the streaming world's
position machinery, which the probe exterior host does not have). Plus
AUDIT 44's own untouched overflow tail. None of it is load-bearing for
play; all of it is written down at its site.

## Lessons

1. **A green suite grown by a fleet measures the fleet, not the port.**
   The vacuous pin is the largest defect class in this audit (37 of 118,
   31%), and it is a direct product of "ship a test with every slice"
   plus "the gate is a green suite". The pins that failed were not lazy:
   they were written by the same lane that wrote the law, from the same
   understanding, and they asserted the thing the author already believed.
   The only pin worth the line is one whose mutant dies - the closeout's
   test-quality lane and Wave D's round both worked by naming the mutant
   and running it. **Make that the acceptance test for a pin, not
   greenness.**
2. **The record rots faster than the code, and it rots invisibly.** 20
   confirmed findings are stale records - a FLAGGED comment whose thing
   shipped two commits later in the same flight, a Ledger row struck in
   one place and live in another, a module header stating a closed flag's
   claim as present fact, nine Testing.md rows whose counts were bumped
   while their descriptions still described the pre-wave suites. 69 of
   145 open flags were stale. **A record is a claim about the tree and
   should be verified like one**; the mechanically regenerated flag list
   is the only part of the record that could not lie, and it is the part
   that shrank 152 -> 17.
3. **A fix applied by analogy is an unverified fix.** The courtroom
   rendered solid red because the incident's own remedy was copied to a
   file the remedy's predicate excludes, and the pin written beside it
   asserted the false law. The incident record said "any palettized-IMG
   consumer must mint its own palette"; nobody re-read `imgFile.js:23-30`
   to ask whether this consumer was one. **Copy the check, not the
   conclusion.**
4. **Disclosure is the difference between a remainder and a defect, and
   it has to live where an auditor will look.** Fifteen of 27 refutations
   turn on disclosure - eight a remainder the building group wrote down,
   seven a record in a channel the brief named. That rate is only
   tolerable because those records existed and the auditors were told to
   read them.
   Where the disclosure lived only in prose - a departure "recorded,
   Port-Ledger" with no Ledger row - it cost a finding and a refutation
   each time.
5. **The seam is not a backlog; it is the port's permanent tax.** 43 of 61 code defects
   are a missing caller or a missing clause; AUDIT 44 said the same thing
   about a tree the campaign then rewrote 40,000 lines of. It is not a
   backlog that drains. It is what porting a component-and-event engine
   into a module-and-host one costs, permanently, and the only defence
   that has ever worked here is a test that exercises the host, not the
   law.
6. **The first-ever-rendered surface is where the criticals live.** Two
   of three criticals - the exterior rotation sign and the courtroom
   backdrop - are on surfaces that had never drawn a pixel before the
   commit that broke them, which is precisely the incident's standing
   lesson 2 recurring inside the campaign that recorded it. The suite
   cannot see pixels; it could not see them for winter-at-boot, and it
   could not see them for a map that rotates backwards. **The owner's
   eyes remain the only oracle for a path that has never rendered.** The
   campaign acted on its own lesson and stopped: `main`'s tip is still
   `4dedaab` (Wave A + Wave B's first flight + the incident fixes), and
   the parked batch - B5, all of Wave C, the closeout, the flag
   retirement and Wave D - is **46 commits and 236 files ahead of it**,
   gated on the branch. The largest surfaces in the campaign are the two
   that have never drawn a pixel outside a test.
7. **The audit's yield falls, and that is the signal to stop.** Round by
   round the code-defect share went 83 -> 50 -> 63 -> 52 -> 5 percent.
   The last round found one wrong string and eighteen unproven or
   misstated claims. That is what the end of a campaign looks like from
   the inside: not zero findings, but findings that are all about the
   record of the work rather than the work.
