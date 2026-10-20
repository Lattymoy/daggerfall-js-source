# AUDIT WB14 (2026-10-20) - the Breach's Portents, read cold

The owner, of WB14a-g (`11-Multiplayer/Breach-Portents.md` - the Vanguard, the Sundering, the Captive, the Dire Breach,
the Tithe-Imp, the Warden's new arsenal and what a portent night pays): **"Please audit this and ensure perfection"**.
This page is the audit: the relay's brain, the balance, the wire and the account, the screen, the words in fourteen
languages, and the record - its pages, pins and mutants. Each finding has its verdict here. What it changed is written
into the pages it touched (Breach-Portents.md section by section, World-Bosses.md section 25), marked `AUDIT WB14` with the
finding's id, and in the code beside the fix.

## How it was run

Six lanes, each a cold adversarial reader of a FROZEN head (5c3a69498, a detached worktree - Home.md's DO NOT FIX WHILE THE
VERIFIER IS READING), told to reproduce a finding before reporting it and to end on what it checked and found sound. ARENA2
was fetched (`tools/fetch-data.sh`); the gate suites ran with it, 611 of 611. Every lane's scripts imported the frozen
modules by path; after the fixes the brain's, the wire's and the record's own repro scripts were run again against the
working tree, and each finding was gone.

| Lane | Over | How |
|---|---|---|
| LAW | the relay's brain: the portents' laws, the halves, the Vanguard, the Captive, the Tithe-Imp, the arsenal's choice | 11 findings; a deterministic court of 1-256 fighters, about 2,000 checkpoint forks byte-compared, invariants after every beat, the Wrath at eight moments a night, the CPU per beat |
| PLAY | the balance by simulation | 9 findings; bots that strike at their reference and dodge each telegraph by its shape with a 400 ms reaction, every night at 1-30 fighters and levels 10/30/60 (756 fights), the pair law at every offset, every new wind-up from its worst spot |
| WIRE | the relay's Room, the wire, the fold, the account service | 9 findings; 159 whole fights through JSON and `validGateOut` field by field, 14,482 hostile frames, the real Room over the fake Durable Object, a checkpoint and a wake at every beat |
| SCREEN | the client's court, its ground, its bodies and its words on the screen | 14 findings; every new shape through the real WebGL2 pass (Chromium), the shader's wedges against the JS field point for point (65,536 of 65,536), every sprite against ARENA2 |
| TEXT | the arc's 79 new rows in English and thirteen languages, the patch notes | 16 English findings, 71 translation rows, 10 patch-note lines; every row rendered through the text core with each catalog patched in |
| RECORD | the pages, the tests, the mutants | 13 findings and nits; every slice's mutant list run (all dead), 48 claims of the tests' titles written as records and run, 775 older gate records over the arc's sources |

Every finding was verified against the code before anything was fixed. The lanes overlapped where they should: the
Tithe-Imp over the fire (LAW-2, RECORD-1), its tithe unpaid at the kill (LAW-5, WIRE-4), the stun on the Flame (LAW-1,
PLAY-2), the night built by the day (WIRE-1, SCREEN-8), the Sundering's numbers (RECORD-4, PLAY-8), the tithe's line
(TEXT-1, RECORD-10).

## What it found, and what was done

### LAW - the relay's brain

| Id | Finding | Verdict |
|---|---|---|
| LAW-1 MAJOR | While the Blade knelt every blow on the Flame landed 1.5x: the kneel is written into his own stun, and `applyHit` weighed every blow by it | FIXED: the Reckoning's stun weighs a blow on him whole alone (`applyHit`, `!H`) |
| LAW-2 MAJOR | The Tithe-Imp followed "his court" beat to beat: risen in a bound's flight or before the Sundering, it ran over the open fire to his new court, struck from no floor | FIXED: it keeps the court it rose in (`tt`'s `ct`), dives into the fire the beat he lands in another, and never rises while he is in the air |
| LAW-3 MAJOR | Sundered with every share out of the fight (`max` 0 - a watcher's socket keeps the beat): the pools mended into nothing, the court come back found his health under its pools and drained him to a fall with no Rejoining; a blow then made the pools NaN and the fight dead | FIXED: a pool's credit is kept in what he stands at (`credit`, `f.idle`); no blow lands at no whole; he never falls sundered - that guard recorded equivalent (the credit and the pool's cap keep him at SUNDER_LAST at least) |
| LAW-4 MINOR | A Blade kneeling in the Wrath's wind-up dropped the Wrath: it was said again and landed after midnight | FIXED: a kneel keeps Dagon's Wrath |
| LAW-5 MINOR | A Tithe-Imp caught in the last beat before the kill (or the Wrath's first wind-up beat) was never paid - the beat that paid it never came | FIXED: paid AT THE CATCH by the relay's dice (`applyHostHit`'s `rng`, `payTithe`); one owed without the dice is paid first thing the next beat, before the kill's or the Wrath's return |
| LAW-6 MINOR | A half could never use one attack twice running: the kit was filtered after the run's law, whose fresh list held the other half's | FIXED: `attacksFor`'s `kit`, before the run's law (`kitOf`) |
| LAW-7 MINOR | Echoing never echoed his patience's meteors | FIXED: each falls again a breath on, on the one it fell for on the platforms, else where the first fell |
| LAW-8 MINOR | The gaolers were sized at his wake - eight seconds after the first `in`, for the first few: twelve who came later fought two of 140 where four of 840 were owed; an empty wake raised two of 20 | FIXED: they rise as the first living challenger stands in the Pen, sized for the fight's living challengers then (the walkway and the knight still at his wake) |
| LAW-9 NIT | `newFight` built the Vanguard and the Captive from the raw portents and kept the validated ones | FIXED |
| LAW-10 NIT | Under Colossal the Chains could be begun at a fighter already past their hold from his centre | FIXED: never at `gap + bossR >= CHAIN_HOLD_M` |
| LAW-11 NIT | The Unmaking's echo stamped its cooldown again | FIXED: the first cast's alone |

### PLAY - the balance

| Id | Finding | Verdict |
|---|---|---|
| PLAY-1 MAJOR (a blocker once LAW-1 was fixed) | A half rose with 30% of its pool whatever the other held - more than one side deals in the window - so sides out of step knelt and rose for ever: with LAW-1's accidental 1.5x gone, even rates 24-28 s apart never rejoined | FIXED: it rises LEVEL WITH THE OTHER - SUNDER_RISE at most, the other's pool at least SUNDER_RISE_MIN (5%). Every offset from 0 to 80 s rejoins with two risings at most, within 190 s at the reference and 286 s at half (the lane's `sunderlaw.mjs`, run again) |
| PLAY-2 MINOR | = LAW-1 | FIXED |
| PLAY-3 MAJOR | Shared Torment between two was 43% of each one's health (48% at level 10), unanswerable: a duo died most - 1.61 deaths a fighter, three Reckoning wipes in nine | FIXED: it asks three (`nMin` 3); a duo's deaths 0.39, no other size moved |
| PLAY-4 MAJOR | A lone fighter at half the reference could not reliably beat a Vanguard (4 of 6) or a Dire Breach (3 of 6) before the Wrath: his health was a plain night's and the Vanguard cost 188 s | FIXED: on a Vanguard night his health is less its Vanguard's (VG_TEAM_S 61 of BOSS_TTK_S 240 - `VG_SHARE_X`): 6 of 6 and 6 of 6, the last at 1,025 s |
| PLAY-5 MINOR | In phase three the Chains' 2.4 s could not always be outrun with a reaction's 400 ms (72 of 5,048 spots) | FIXED: the Chains keep their wind-up in phase three (`windupOf`): 3.0 s, no failing spot |
| PLAY-6 MINOR | The Tithe-Imp was a formality - caught 5 s into its 22 by a lone chaser | FIXED: TITHE_S 10, 6.8 m/s - a lone chase about 12 s, four chasers' 5, every chase still caught |
| PLAY-7 MINOR | A portent's piece skipped every pass the others had - never socketed, no Legendary ever Exalted | FIXED: the four passes over the portent's pieces alone, after them (14.2% socketed against the rest's 13.4%) |
| PLAY-8 NIT | = RECORD-4 | FIXED |
| PLAY-9 NIT | The patch notes' "when most of the last is down" | FIXED (the notes: "when a quarter or fewer still stand") |
| context | With a reaction's 400 ms the old phase-three Cleave misses its escape by 0.58 m and the Crushing Leap by 0.27 m | OPEN, named: not this arc's (WB9's wind-ups); NOTHING GETS FASTER keeps them where they are |

### WIRE - the relay, the wire, the account

| Id | Finding | Verdict |
|---|---|---|
| WIRE-1 BLOCKER | A screen builds a portent night by its DAY; a relay from before the arc admits the new client and fights the night plain, and a new relay waking a fight it checkpointed before the deploy fights it plain too - the screen arrives on the Bridgehead, a floor never laid a walkway from, held there till midnight | FIXED: the gate's door refuses a portent night on a relay older than GATE_PORTENTS_RELAY_MIN (`relaySupportsPortents`, the session's `portentsOk`, `gateRefusal`), pinned to the version that says WB14b; the relay lets go unfallen a fight with no `pt` it wakes on a portent night (`_gateFightOf`) |
| WIRE-2 MAJOR | A tithe could be paid twice: fanned before the fight was kept, so an eviction within the checkpoint's span woke an Imp standing again, and caught again it paid a fresh seed | FIXED: `_gateFanKept` - a frame with `to` is kept before it is said (AUDIT WB A10's law) |
| WIRE-3 MAJOR | The Rejoining's ward never reached a screen that heard every word: `rj` carried no ward and forced no state; both halves were drawn unwarded for up to 4.5 s | FIXED: `rejoin` says the state in its beat |
| WIRE-4 MINOR | = LAW-5 | FIXED |
| WIRE-5 MINOR | A half's mending was carried only in the whole state - unsaid up to 4.75 s | FIXED: a change of it forces the state |
| WIRE-6 MINOR | The wealth budget filled a portent receipt as a plain one, though it pays up to three pieces more | FIXED: SPOILS_GRANT_PIECE (10,000) for each portent (`portentPieces`), the claim carrying its portents to the fill and never in its answer - acct160, before it shipped. The tithe KEPT off the fill, named: 60 gold a level and one gem, inside the grant's room past the mean and an hour's rate |
| WIRE-7 NIT | The fold's `sd.fl.ct` and `cp.w` go stale between states | KEPT: nothing reads `ct`; every reader of `w` asks `wardTakes`, which needs that attack's number |
| WIRE-8 NIT | A striker not connected at the catch's word loses the tithe | KEPT, as designed: a moment's prize said once to whoever struck it and stands there - never on a ledger, never said again at an `in` (section 9) |
| WIRE-9 NIT | The RELAY_VERSION note named neither the Captive nor its host kind | FIXED (at the merges that renumbered it - world229 now - and the audit's own line) |

### SCREEN - the client

| Id | Finding | Verdict |
|---|---|---|
| SCREEN-1 BLOCKER | Sundered, a Tithe-Imp risen in the Blade's court could not be struck: the court offered the Flame alone | FIXED: the Flame and the host on my floor together (`hostTargets`) |
| SCREEN-2 BLOCKER | A court's first frame judged a Wheel's (and a Charge's) whole sweep since its landing: a fighter stepping in was struck by a blade 16 m away the relay never counted | FIXED: a court I step into is judged from my first frame (`judge`) |
| SCREEN-3 MAJOR | The host's ground drew 8 of the Vanguard's 12 blows in body order - a Smash on me could go undrawn | FIXED: nearest my feet first (`hostShapes`'s `mine`) |
| SCREEN-4 MAJOR | After a Captive night his destroyed batch and his light were handed to the host's pass every frame | FIXED: `reset` empties his lists |
| SCREEN-5 MINOR | A watcher was blinded by the Gaze and told to look away | FIXED: the arsenal's `watching` |
| SCREEN-6 MINOR | The Wheel struck up to 0.68 m past its drawn tip, and under Colossal a ring at his feet never drawn (the relay's judge the same) | FIXED: the capsule it draws (`wheelSlack`), no body disc past its roots |
| SCREEN-7 MINOR | The callout on my feet vanished for the Wheel's 6 s turn | FIXED: a spot a blade sweeps within WHEEL_PERIL_MS |
| SCREEN-8 MINOR | = WIRE-1 | FIXED |
| SCREEN-9 MINOR | The arsenal told attacks apart by number alone (AUDIT WB B4's law: number and moment) | FIXED |
| SCREEN-10 MINOR | New objects every frame: the chains, my feet's copies | FIXED: the chains' slots, one pair for my feet (the court, the Flame, the host) |
| SCREEN-11 NIT | On a Vanguard night the arrival had no clearing - a brazier 1.8 m behind the way in | FIXED: the night's root keeps the bridge's clearing; the page's "fewer spires" corrected |
| SCREEN-12 NIT | The Sundering and the Rejoining quaked and burst but shook nothing | FIXED: the bound's own shake (`SHAKE_AS`), not two kinds more - SD16 holds the Hour to more kinds of shake than his court |
| SCREEN-13 NIT | The Unmaking's fill reached the rim 96-120 ms early | FIXED: to the rim it is seen at (shader and field) |
| SCREEN-14 NIT | A hidden HUD hid the Gaze's blinding | FIXED: the white is the eye's |

### TEXT - the words

| Id | Finding | Verdict |
|---|---|---|
| TEXT-1 MAJOR | *"You take its tithe of 594 gold and Ruby."* | FIXED: `{gold, number}` and the gem's article (*a Ruby*, *an Emerald*) |
| TEXT-2 MAJOR | The Captive's tip said "his ward" - half the knights are Dames | FIXED (the tip rewritten - TEXT-10) |
| TEXT-3 MINOR | "chained in his pen" (five languages read the knight's own) | FIXED: *the Pen* |
| TEXT-4 MINOR | "The Markynaz falls" was said at the last Brute's death | FIXED: *The Vanguard is broken.* |
| TEXT-5 MINOR | "Split up" was false under four | FIXED |
| TEXT-6 MINOR | The Tithe-Imp "with his tithe" | FIXED: *its tithe* |
| TEXT-7 MINOR | *Brand of Dagon* on the bar, *Dagon's Brand* in every order and language | FIXED: *Dagon's Brand* |
| TEXT-8 MINOR | The profile's attack names and the card's portent rows were frozen in the language first read | FIXED: read live (getters) |
| TEXT-9 MINOR | Mixed-language screens: the Sundering's card put an English phase name beside a translated order | FIXED for the card (`PHASE_NAMES`, `courtPhaseOrder` through the text core, five rows more). OPEN, named: the marks' words and the old attacks' names (*Dagon's Reckoning*) are English in every language, as before the arc - a slice of their own |
| TEXT-10 MINOR | The portents' tips broke the tips' law (one order, 60 characters), and WB13b's scan never read them | FIXED: rewritten; the scan and the law read them |
| TEXT-11 NIT | "Its tithe spills" - nothing spills | FIXED: *goes to all who struck it* |
| TEXT-12 NIT | "behind them" | FIXED (TEXT-10) |
| TEXT-13 NIT | "tonight" twice on a Dire night | FIXED: *Dagon's Breach runs deep.* |
| TEXT-14 NIT | Four plural rows never shown | KEPT: every host kind's look is a name and its plural (`hostLookOf`, read by `waveLine` for any kind that rises in waves) |
| TEXT-15 NIT | "wave 1 of 3" before the first wave | FIXED: *The Vanguard - Bridgehead* |
| TEXT-16 NIT | "The Vanguard, The Sundering" | FIXED: *The Vanguard · The Sundering* |
| TEXT-17..86 | Each language's rows (reflexives, genders, Cyrillic names, a meaning, the tips) | FIXED: 227 rows drafted by the lane, each checked by the pipeline's own law (`checkDraft`), merged by `tools/l10nInSession.mjs` |
| TEXT-60 NIT | Korean's 이(가) after a fixed word | FIXED where the subject is fixed; KEPT where it is a name the template cannot know |
| TEXT-87 NIT | A boss name in Latin that cannot decline | KEPT: the name is the code's |
| PN-1..10 | The patch notes: the knight "a different one each night", "if you freed him", the Weir Key on any portent night, "when he falls", the Flame alone of four aspects, "in the court", the tithe's master, "back out" | FIXED in the pull request's description |

### RECORD - the pages, the pins, the mutants

| Id | Finding | Verdict |
|---|---|---|
| RECORD-1 MAJOR | = LAW-2 | FIXED |
| RECORD-2 MAJOR | The pair law's 20 s window was unpinned | FIXED: pinned to the beat |
| RECORD-3 MAJOR | VG_STANDING_MAX was unpinned - broken, 10 of 17 states the wire refused | FIXED: sixteen on the Bridgehead, every state read whole |
| RECORD-4 MAJOR | The page's shares for 17 and 18 were never the code's | FIXED: the page as built, pinned |
| RECORD-5 MAJOR | The arrow's assertion accepted either way | FIXED |
| RECORD-6 MINOR | Test titles claimed mutants with no record | FIXED: the lane's 48 written and run, committed in wb14a-f's lists (`AUDIT-WB14-RECORD-6-*`) - two that survived pinned (the Vanguard's hold, the ward said once), three recorded equivalent with why |
| RECORD-7 MINOR | Six stated laws whose mutants survived | FIXED: a pin each |
| RECORD-8 MINOR | One law pinned only by its source line | FIXED: a behavioural pin |
| RECORD-9 MINOR | His patience's word could be lost | FIXED (`V.said`) |
| RECORD-10 MINOR | = TEXT-1 | FIXED |
| RECORD-11 MINOR | The PR's wb14a count (37) | FIXED: 38 |
| RECORD-12 MINOR | World-Bosses section 25: "every law on this page holds on a plain night" | FIXED: the arsenal and the Tithe-Imp named as every night's |
| RECORD-13 MINOR | A survivor older than the arc, over its sources, missing from the PR's list | FIXED: named (AUDIT-WB9-flown-over-the-collider-alone) |
| nits | Vacuous assertions and fillers; the page header's example path; "a scaled one would be the first"; 152 m and 17 s; "in the court"; two stale comments | FIXED |

### Found fixing

| Id | Finding | Verdict |
|---|---|---|
| FIX-1 | A gaoler Pulsed as it rose - the Ward-Bearer's first-Pulse delay was keyed to the Ward-Bearer alone | FIXED: staggered as theirs |

## After

Tests: `test/net/gate/audit_wb14.test.js` (21) and `audit_wb14_screen.test.js` (12), and the older pins the fixes moved
(each a PIN MOVED note - WB3b, WB9b, WB11, WB13b, WB14a-f, AUDIT WB). Mutants: `tools/mutants/audit_wb14.json` (66 - 65
dead, one recorded equivalent), the RECORD lane's 35 records of the titles' claims in wb14a-f's lists (32 dead, 3
recorded equivalent), and 34 older records re-aimed by content at the text the fixes moved (all dead with their lists).
The relay's law moved (RELAY_VERSION world229's LAW hash - renumbered past GAUNTLET-SLAIN's world225, LORD-SHARES's world226, PLAIN-SWEEP's world227, then QL12's world228 at the merges, GATE_PORTENTS_RELAY_MIN with it - unshipped); the account's acct160 (acct159 before QL12's), unshipped, carries the fill.
Found and not fixed: the three ARENA2 failures the whole suite shows on main too (IT1 `it1_worlddata`, WD1
`wd1_worlddata`, CRATE-FREE `fb1004d_cratefree` - not this arc's), the old phase-three Cleave's and Leap's margins under a
reaction (PLAY context), and the marks' English (TEXT-9).
