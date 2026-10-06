# AUDIT SHIPS - PR #634 audited, 2026-10-06

Mac, of PR #634 (SAIL-FREE and SERPENT3 on one branch - `03-World/Come-Sail-Away.md` SAIL-FREE and
`11-Multiplayer/Sea-Serpent.md` section 15): *"Audit everything"*. Four lenses read the branch at 59a5b24f, and each one
checked its own findings with a node probe before reporting them:

- **A, the sailing** - SAIL-FREE on Come Sail Away's real runtime and every seam its new way reaches: the serpent, the
  Overworld journey, the heave-to, the oars, the other hulls, the trim, another player's boat, the storm;
- **B, the serpent's brain and the relay** - SERPENT3's legs, dashes, closing, sleeps and words, over whole fights;
- **C, the client and the pair's share** - the count behind the share, the reload gate, every hurt path, the wake;
- **D, the tests, the mutants and the docs** - every pin the branch wrote or moved, every mutant record, every figure.

A fifth, **E**, read the survivors of the branch's wide mutation sweep: of 923 records aimed at the sailing and serpent
code it touches, 915 died, one is equivalent as recorded, and seven survived - the same seven survive on main, so they
were there before the branch.

Thirty-nine findings. Five are the same finding seen twice (B2 = C1, B8 = D5, D1 = A6, D6 = A5, D9 = C3), so 34 are
distinct. Every one was reproduced here before any line changed. Each fix carries an `AUDIT SHIPS <ID>` comment. They
are pinned in `test/auditships.test.js` (20, the serpent's) and `test/auditships_sail.test.js` (9, the sailing's), plus
the pins they moved (`PIN MOVED` where each stands) and the seven pins lens E strengthened. They are mutated in
`tools/mutants/auditships.json` and `tools/mutants/auditships_sail.json`: **97 mutants, 97 dead.**

## Mac's calls, open

Each is put to Mac with its options. Nothing here was decided for Mac:

- **A lone ship with an exceptional crew, or in a storm.** At the measured 38% gunnery a lone galleon never wins at any
  way up to 26.5 m/s, but a Carrack circling at 31.8 m/s in the sea's strongest wind wins two fights in twelve. At 50%
  gunnery a lone ship wins from 21.2 m/s: two in twelve, four at 26.5 and nine at 31.8 (`node tools/serpentFleetSim.mjs
  --grid`). Options: leave it (the fastest hull, a storm and an exceptional crew); bound a ship's way near the serpent
  (lens A's `wayScale` while it is near - a cap the player can feel); or a faster surge.
- **The storm's bound on her way (A8).** The sea's wind is bounded at twice the rated (`seaWind`), so in a thunderstorm
  (4 m/s) a Carrack makes 38.9 m/s on her quarter and 35.0 running where HELM-WAY's raw wind gave her 42.5 and 41.9, and
  a Large Galley 16.2 and 14.6 where it gave 18.0. The galleon is faster than before on every heading. Options: keep the
  bound (declared on the SAIL-FREE row), or take the larger of the bound and the raw wind.
- **The captains' pace** stays SAIL-FREE's own open call (the Bay's ships sail at HELM-WAY's pace).

## Fixed

**A, the sailing** (`src/systems/seaHelm.js`, `src/scenes/world.js`, `src/scenes/navalHost.js`,
`src/systems/comeSailAway.js`, `src/systems/helmWay.js`, `src/scenes/comeSailAwayPeers.js`; A1 in the serpent's brain)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| A1 | high | At SAIL-FREE's speeds a lone ship beat SERPENT3's serpent, against Mac's "one ship alone still can't". Every attack was aimed where its ship stood when it was chosen, and its closing surge was a fixed 20 m/s. One galleon at 38% gunnery won no fight in twelve at 13 m/s, eight at 15 and every one from 15.5. SAIL-FREE gives a ship circling under full sail 0.819 of her best: a galleon 13.3 m/s in the rated wind and 17.7 in a 2 m/s one, a Carrack 15.9 and 21.2. Every SERPENT3 balance figure had been measured at 13 m/s or less. | It leads its marks. Each ship's way and turn are read off her own poses' send times (`serpentWayOf` - the relay hands on each pose's `ts`), and a Maw, a coil, a spit and the tail's sweep are aimed where she will be as they land (`serpentLeadOf`, along the round she sails, at most 9 s ahead). The ram's lane is led to where its run meets her. It closes no slower than `CLOSE_GAIN_V` over her way (`closeV`). A lone galleon at 38% now wins no fight up to 26.5 m/s, and a pair every one from 17.7 (the grid, `Sea-Serpent.md` section 15). |
| A2 | medium | The Overworld journey ran aground on open legs and stopped. The hand looked 150 m ahead and struck sail 120 m out, tuned for 10 m/s or less. At 16 m/s she coasted down at under 1 m/s², and once her bow had turned about 10 degrees the islet left the probe, so the hand raised sail and turned back onto it. A galleon ran aground on 7 legs in 60 and a Carrack on 8; neither ever did under HELM-WAY. | The hand keeps her off land as far ahead as her way needs (`seaHelmReach`: `avoidM`, or what her way runs in 13 s). It keeps the reach it saw land at until she is clear (`seaHelmLook`), looks along her whole beam and the mark's own lane (`TV_SEA_LANE_M`), and holds the heading that cleared an islet while the mark's line still runs onto it. World.js's hand, lifted whole, crosses 72 legs, each with an islet across it, and arrives every time. A fixed 150 m look ran 8 of the 36 storm legs aground. |
| A3 | medium | A heave-to no longer stopped her beside the struck ship. The brake was a fixed 2 m/s². From SAIL-FREE's full way it ran a galleon 50-64 m and a Carrack 73-93 m to BOARD_SPEED, out of BOARD_RANGE (32 m). On her quarter the Carrack took 8.5 s, past HEAVE_TO_S, so the heave-to lapsed while she was still too fast to board. | The brake is sized to the way she heaves to at (`heaveToDecel`): HEAVE_TO_DECEL at the least, or what brings her under BOARD_SPEED within HEAVE_TO_M (20 m). |
| A4 | low | In a fog the journey rowed (1 m/s) where SAIL-FREE's sails would make 4-5 m/s. Its calm read the raw wind, and its sails' way was the mod's formula of the raw wind, not SAIL-FREE's law. | Under `free`, any breath fills her sails. The journey weighs her sails against a crew's oars by the runtime's own word (`sailWayOf`, `oarWayOf`). A Large Galley's crew still rows past her one square sail. |
| A5 | low | SAIL_FREE.gain reached ways that were not "her new way". Every coast took it, so a rowboat's oars at rest stopped her in 2 s where HELM-WAY took 3.3, a galley's oar coast from 8 m/s took 16 s instead of 27, and the journey's autorun oars came on at the gained coast's rate. It was also the galleon's ratio laid on every hull: a Large Boat gathered her way a third quicker and a Large Galley a third slower. | Every rig has its own gain, measured on the real runtime (`SAIL_FREE_GAINS`, `sailFreeGain` - the hull's first rig's for a variant it lacks, 1 for a hull with no sails). A coast takes the gain only for a way her canvas made (`wayBySail`). The autorun's oars come on at the oars' own rate. |
| A6 | low | With the mod's AutoTrimming off, the manual trim did nothing under the Responsive helm (every sail is asked at its crest), but the panel and the pad still offered it. Nothing declared it. | Under the Responsive helm the trim is the helm's own. The booms are trimmed as the mod's assist trims them, to show it; no trim is offered (`helmPanelState`'s `manualTrim`), and the keys move nothing. Declared on the SAIL-FREE row and in `10-UI/Controls.md`. |
| A7 | low | A passenger on another player's ship was put off by a much shorter hitch of the wire. A peer's boat snaps past a fixed 20 m step: at 19.4 m/s a 1.75 s gap snapped her, and a snap carries nobody. | A boat snaps past CSA_PEER_SNAP_M or what her word's way runs in CSA_PEER_SNAP_S (2.5 s), whichever is farther (`peerSnapM`). A teleport still snaps. |
| A8 | low | In a thunderstorm the Carrack and the Large Galley are slower off the wind than under HELM-WAY (above). The record did not say so. | Declared (the SAIL-FREE row, `03-World/Come-Sail-Away.md`); whether a storm may drive her past the sea's bound is Mac's call (above). |

**B, the serpent's brain and the relay** (`src/net/serpentBrain.js`, `src/net/serpentBody.js`, `server/src/index.js`)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| B1 | medium | After a short sleep the head jumped backwards on every screen still drawing the fight. `serpentResume` laid the track again from the last beat and threw away every leg said since. The relay arms its beat only on a serpent word, so a fighter whose socket dropped and came back slept the fight until her next hit. Over 200 such sleeps the snap had a median of 56 m and reached 148 m; the base snapped 0.1 m. | A sleep no longer than `SERPENT_DRAWN_MS` (12 s - every screen keeps a fight it no longer hears that long) stands as it was said. A head that swam out of its waters meanwhile turns home from the moment its word can reach them. A socket's hello beats its fight again. |
| B2 | medium | = C1. | (below) |
| B3 | low | The Maelstrom could form outside its waters. When no turn and straight met the round drawn in, the brain fell back to the round about its head, on 54 of 395 third-phase turns, with its eye up to 437 m out. | It turns on HUNT_TURN_R, to whichever side turns it less, until the round to its left lies in its waters (`maelTurnToFit`). |
| B4 | low | A Rising Maw with a short way burst past its mark. The swim ended early, because the dash is floored at SWIM_MIN_V and the rise always runs at CRUISE_V, so the rise ran on: a ship 8 m ahead was burst 27 m past. | A way its wind-up could swim at a cruise is swum at the one pace that fills the wind-up, rise and all. |
| B5 | low | Its unplanned turns were said at the beat, not ahead: the kill's throes, the sounding's dive, the cry's and the roar's rearing. A client 150 ms behind snapped 3.6 m on a kill mid-dash. | Said SERPENT_SAY_AHEAD_MS on, with everything still to come let go at the beat (`holdNow`). |
| B6 | low | The coil's round ran the wrong way. The brain sent the head round her clockwise, but `coilPoint` lays the body clockwise of its head. The body swept across the ring, over her ship, as the coil wound on and again as it let go. | The head goes round her counter-clockwise, and the coil drawn turns with its head (`coilAngleAt`), held where it lets go. |
| B7 | low | A fight live across the relay's deploy (an older brain's checkpoint read by the new brain) misbehaved once: an old ram's run was never said, an old coil wound 90 m from its head, and an old Maw's pre-said leap was honoured. | The fight is stamped with its law (`bv`). A fight checkpointed by an older law is taken up at once, as one long asleep. |
| B8 | low | = D5: the closing surge had no margin over the new speeds. | (below) |

**C, the client and the pair's share** (`src/net/serpentBrain.js`, `src/systems/serpentStrike.js`,
`src/scenes/serpentHost.js`, `server/src/index.js`)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| C1 | high | The ship count behind the pair's share counted accounts that had once claimed a hull, not ships fighting it. The claim only ever grew, a rowboat counted (it brings no share and deals nothing), and a retired share still counted. A lone galleon with a rowboat by, or with a friend riding her deck who had sighted it from their own ship, was "a pair" and took two thirds of every blow, which is the lone ship eased that Mac's call rules out. A true pair with a rowboat by was three, and lost its share. A rowboat's wreck word was dropped. | The ships fighting it are the shares in its health (`serpentShipsFighting`: a warship's share, afloat, at the fight, her guns heard, her captain aboard her). A hand off her own ship is no ship, and is never targeted as one or coiled (`serpentOnShip` - the hull her latest `in` says). A rowboat's wreck is a wreck. The client says its `in` the moment the ship it stands on changes. |
| C2 | low | The reload gate stopped an `in`, not a fighter. A game told to reload kept firing and being hurt: in the probe it dealt 591 after its refusal and was attacked six more times. | A game told to reload is not heard, and not gone at, until it says an `in` on the law. |
| C3 | low | Crew losses were not eased to two thirds. Each blow's men were rounded on their own, so a one-man spit or roar still took the whole man and a two-man lash took one. | The share is carried blow to blow in whole points, on the ship's own remainder: thirty spits take twenty men. |
| C4 | low | `dashWake` made a whole splash every render frame, holding the particle budget full, so the guns' spray was evicted first (a miss's splash lasted 0.56 s at 144 fps). | A splash at most every WAKE_MS (150 ms) of the fight's clock. The ram's run down its lane is the dash's wake too. |

**D, the tests, the mutants and the docs** (the pins, `tools/`, the bible)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| D1 | medium | = A6: the trim's change was declared nowhere. | (above) |
| D2 | medium | "A client 150 ms late sees no snap" was false, and S2's 2.5 m bound a frame hid it. A closing surge's change of pace was said at the beat, and a lagging screen snapped 0.9-1.4 m. | Every turn of its own is said ahead: a change of pace, every attack's ride, the coil's winding on (the coil frame's `w`) and its letting go (`off`). The pin reads the lagging client's step against the relay's own step that frame, over whole fights - slain, sounded, and with coils held, broken and crushed. A screen within 250 ms (SERPENT_SAY_AHEAD_MS less a beat) sees no snap but its steering's centimetres. |
| D3 | medium | Five new laws that no test could fail: the stun and the head judged at the blow's moment, the whirl's eye to its left, a closing let go when its ship wrecks, and the track the relay keeps for a blow judged back. | Each pinned, and each record dies. |
| D4 | medium | Come-Sail-Away.md gave AUDIT GALLEON T11's HELM-WAY figures as the galleon's current ones (struck to 2.5 m/s in 10.42 s, 40 degrees off the wind's eye in 6.37 s, "the rudder as above"). Under SAIL-FREE they are 12.05 s, 4.83 s, and 9.68 and 10.33 deg/s at 4.5 and 9 m/s. | T11's are marked HELM-WAY's. SAIL-FREE's, measured the same way, stand beside them and are pinned. |
| D5 | medium | "CLOSE_V (20 m/s - the galleon's best is 16)" was true in the rated wind alone. The wind runs 1-2 m/s, x1.5 in rain and x2 in thunder, so a galleon's best is 21.6 m/s at 2 m/s and a Carrack's 25.9. The balance had been simulated with galleons at 8 and 13 m/s only. | `closeV` (A1). The balance grid runs from 8 to 31.8 m/s and is in the tree. The claim is gone from the comment and the record. |
| D6 | low | = A5: "as she did under HELM-WAY" held for the galleon alone. | (above) |
| D7 | low | Assertions that could not fail, or pinned half their title: "never landed later" (an attack's number is always fresh), "bursts where its word says" (the mark was built from the head it was compared with), the crush, grip and grind shares as "less than" (a share squared or halved passed), S4's dash under the sea, S8's clock, and sailfree T8's tack lane. | Each one now asserts what its title says. |
| D8 | low | sailfree's test called `seaWind(2)` "UpdateWind's strongest". The strongest is a thunderstorm's 4 m/s. | A fair day's strongest, and the storm's asserted at its bound. |
| D9 | low | = C3. | (above) |
| D10 | low | Come-Sail-Away.md, helmWay.js and the PR's description pointed to "the Port-Ledger's HELM-WAY row" for SAIL-FREE's declaration. SAIL-FREE's is its own row. | They point to SAIL-FREE's own row. |
| D11 | low | Testing.md kept retired lead clauses and only appended their contradictions: F18's "under Responsive, put the helm over", S2's "a stray surfacing said once", AUDIT SERPENT 2's "a breach begun in a stray surfacing's beat", and SERPENT3's coil "going round her clockwise". | Rewritten to what the pins say now. |
| D12 | low | The leap and balance figures came from scratch simulations that never reached the tree. | `tools/serpentFleetSim.mjs` is the tree's. Every balance figure in section 15 is re-derived from it, the before figures with `--root` on the base (fleets of three or fewer won none of 144, where the scratch copy had found one). The leap counts are labelled as SERPENT3's scratch measurement. |

**E, the wider sweep** - seven pins a later change had blinded, on main before this branch. Each record is unchanged, and
each dies again against a stronger pin:

| ID | Record | Why it survived | The pin now |
|---|---|---|---|
| E1 | CSA-D-late-pause-open | HELM-LADDER (2026-10-04): a bare update pulls no oar, so the paused LateUpdate had no vector to hold. | Her oars pulling, the paused LateUpdate holds her and the unpaused one spends it. `csa_placing`'s placing click also kills it; its record now names that file too. |
| E2 | LOST-BOAT-a-crewed-hull-packed | SHIP-PACK (2026-10-01): PackBoat refuses a crewed ship whose deed is not in the pack, and the harness had no pack. | Her deed in the pack, as a deed ship's is: kept, nothing said, her ground asked. |
| E3 | NAV-C-the-tactic-ignored | SEA-EASE (2026-10-01): seeds 1 and 2 draw wary captains, who cruised; the turns read were their waypoints'. | Two bold captains, engaged: the brig shows her starboard side, the galley her stem. |
| E4 | NAV1-the-tacks-carry-dropped | HELM-WAY (2026-09-29): the brig's steerage in the eye beat the carry, so the carry never acted. | Put about on the least way she tacks with, she goes through the eye at TACK_CARRY of the rate she went in with. |
| E5 | NAV1-no-pay-off | HELM-WAY: her steerage at rest beat the pin's floor. | One step from rest head to wind, her helm over toward PAYOFF_TURN exactly. |
| E6 | NAV1-never-warped | HELM-WAY: the grounded brig kept 2.3 m/s of way, and her steerage there beat the warp. | A ship lying still and boxed in is warped round at PAYOFF_TURN and holds no tack or wear. |
| E7 | NAV1G-no-bear-free | HELM-WAY: at 29 degrees off, BEAR_COST_S alone outweighed the turn, so NO_BEAR_S never decided. | A lay a little past the fire's window (232 degrees), where NO_BEAR_S decides. |

## Found while fixing

| ID | Sev | Finding | Fix |
|---|---|---|---|
| N1 | low | The coil's winding on and its letting go were said at the beat (a crush snapped a screen 150 ms behind 0.8 m on and 0.24 m up). | The coil frame's `w` says when its winding is drawn from, SERPENT_SAY_AHEAD_MS on, and its `off` is said ahead with every word of its letting go. A new field on the wire (`spCoil` checks it), inside `world172`, which is not yet deployed. |
| N2 | low | The ram's lane was led once, by the time to where she stood, and the lead was capped at 6 s, shorter than a ram's word to the end of its run (8.5 s). | Led again by its run's own time to her (RAM_LEAD_STEPS), at most SERPENT_LEAD_MAX_MS (9 s). |
| N3 | low | The ram's wake stopped where the ram struck my ship. It was the judging's wake, and `dashWake` left the ram's run out. | One emitter: the run's wake is its dash's and runs on past a ship it struck. |

## Decided, not changed

- **A helm that turns or slows as the telegraph shows still sails out of a led mark.** The lead holds her way and her
  turn as they are. That is a telegraph's use.
- **PAYOFF_TURN and the warp** act only while a ship lies nearly still, since HELM-WAY's steerage turns her at rest. Both
  are live, so E5 and E6 pin them. Retiring them would be a change of behaviour, not dead code.
- **The player's ram hits about 1.65 times harder at SAIL-FREE's way** (ram damage is linear in speed). That is balance,
  not a bug.

## The mutation sweep

- **The audit's own lists:** `auditships.json` 73 of 73 dead, `auditships_sail.json` 24 of 24 dead.
- **The serpent's lists** (serpent1, serpent1_audit, serpent3 and the rest the serpent fixes touched): 324 dead. One
  record went: `SERPENT3-wake-ram-doubled` mutated an exclusion that C4's single emitter removed, so `serpent3.json` has
  45. Records re-aimed by content, each keeping the fault it was written for: serpent1's relay law and the host's `in`;
  serpent1_audit's ends (the coil let go at the kill and the sounding, the throes said), its ship count, its stray (now
  the resume's short sleep) and its wake; serpent3's coil (dashed, its round's way), the stretch swum, the closing's
  pace and turn, the pair's blow and crush, and the wake on the surface.
- **The sailing's touched records:** every record on a line the sailing fixes changed or naming a test they moved -
  496 records across 25 lists: 488 dead, none survived, and 8 no longer applied, because the fixes had moved their
  source. `mutantdrift` found 7 more of the same. All 15 were re-aimed by content, each keeping the fault it was written
  for (the peers' snap and its threshold, the move's two arms, the oars' rate backing water, the stowed sails, the
  rudder at the gain, the sea fight's share and its flag, the heave-to's press and its brake, the journey's calm, and
  SAIL-FREE's three gains), and re-judged with E1's record: 16 of 16 dead.
- **Lens E's seven,** against the strengthened pins: 7 of 7 dead, and the 288 records naming those five test files all
  dead.

## Not verified here

There is no GPU and no browser in this container. The wake's pacing, the coil drawn turning with its head, and the
trim's absence from the panel were driven through their hosts and the DOM harness, not seen. The relay's hello beat and
its reload gate were driven through fake rooms, not a deployed relay: `world172` is not yet deployed.

## The second round (AUDIT SHIPS 2)

2026-10-06, Mac: "Audit everything" again, of PR #634 with the first round's fixes. Five lenses (A the sailing, B the
serpent's brain and relay, C its client and the pair's share, D the tests and the docs, E the mutation coverage). Mac
then stopped the round ("Can we stop with the probes. This is eating usage and taking far too long") and asked for a
speed indicator and sails that work: what was fixed by then is below, pinned in `test/auditships2.test.js` (15) and
`test/auditships2_sail.test.js` (4), with the moved pins noted on their rows (`09-Testing/Testing.md`). The mutation
records for the serpent's half are `tools/mutants/auditships2.json` (32, with 25 more re-aimed by content and
`AUDIT-SHIPS-D2-hold-dropped` retired - XB2 removed the law it held); the round stopped before they were run.

**Fixed:**

| | What was wrong | Now |
|---|---|---|
| XB1 | Steering turns were said at the beat; the closing surge was steered as it cruises and swung 30 degrees each side of her every 1.25 s. A screen 150 ms late drew the head 0.76 m off, 250 ms late 2.4 m. | Every steering leg is said SERPENT_SAY_AHEAD_MS on; the surge is a planned turn and straight (`closeOn`). Clients at 150, 250 and 450 ms draw the relay's head exactly. |
| XB2 | A kill between beats held the swim from the blow (`holdNow`), unsaying a dash a lagging screen had begun (3.2 m at 250 ms). | Ends are laid from their own moment alone. |
| XC3 / XB5 | `held` moved the coil's centre but not its head's round; an older law's coil kept its old round. The body lurched up to 42 m (102 m across a deploy) unwinding. | `coilRound`: the round laid again about the coil as drawn, out of sight. |
| XB4 | A game told to reload kept its share and its ship in the count for 45 s. | `serpentShareWanted` reads `stale`. |
| XB6 | The relay checkpointed after its words went out; a restart snapped heads up to 106 m. | The fight is kept before a word that lays its track (`serpentSaysTrack`). |
| XB8 | A client could inflate her way unseen by slowing her poses' send clock. | Her clock is held to the relay's (SERPENT_CLOCK_SPAN_MS, SERPENT_CLOCK_SKEW). A visibly forged place stays the game's usual trust. |
| XB9 | A captain on a smaller warship of her own was no ship of the fight. | Her share is taken down to that ship's (AUDIT SERPENT H2's "never shrinks" moved). |
| XB10 | A coil's closing went on at a captain who stepped onto a friend's deck. | It lets a hand go. |
| XB11 | A ship hove to kept her last way for a heartbeat's 20 s. | No new pose past SERPENT_WAY_STALE_MS of the relay's clock: at rest. |
| XC1, XC2, XC4-XC8 | The count reached clients 5 s late; the client fought any older relay; a pair's venom was not two thirds; a wreck stayed coiled; the wake stopped at the word; a ship change said an `in` every frame; the bar mislabelled the count. | Fixed before the stop (the count on the `hp` word, SERPENT_RELAY_MIN 172, the venom shared and carried, the wreck let go, the wake to its turn, IN_CHANGE_MS, "ships fighting it"). |
| XA1 | Under the responsive helm the oars' rate both gathered and shed way: struck and rowed, a galleon took 48 s and 400 m to come down. | A way above the oars' is shed no slower than her coast (12 s, as before A5). |
| XA5 / XD1 | The heave-to asked up to 47 m/s^2 and the runtime gave 20: a storm's Carrack ended out of BOARD_RANGE. | One bound (`CSA_BRAKE_MAX`); offered by where it leaves her (`heaveToRun`). |
| XA6 | The boat wire's way bound was 27 m/s at an open journey's x60; a storm galleon vanished from other screens. | Bound sized from the real ceiling, and the writer holds a way to it. |
| XA7 | The coast's gain followed the arm that drove her last, not who made her way. | It follows her canvas's share of her way (`sailWay`), saved with her way. |
| XD5 / XD6 | The lag pin's metric could not see the closing's snaps; two pins could not fail their titles (CLOSE_GAIN_V, the booms). | The lag pin reads the drawn head against the relay's every 10 ms; both pins read the law's own figures. |

**Open - left by the stop:**

- **Mac's call, the lone ship in a storm (XB3/XD2).** The fleet sim now flies each hull's own body and can give a ship a
  helm that answers telegraphs (`tools/serpentFleetSim.mjs --react`). At 38% gunnery over 24 fights a lone galleon or
  Carrack wins none circling in any wind, none to 4 of 24 with a 300 ms helm in fair weather, and 22-24 of 24 with it in
  a storm (10-22 at 600 ms). "One ship alone still can't" holds in fair weather only.
- **Lens A's journey hand (XA2, XA3, XA4) and XA8, XA9:** the Overworld journey's look grows with her way, not her stop,
  and looks past the mark; its blocked hold commits to one side; under Classic it rows a crewed galleon whose sails read
  aback before they are set; the fallback galleon's gain; a peer's snap trusts its own word's way.
- **Lens E's weak pins (XE1-XE15)** - laws the pins cannot fail, each with a scratch pin that kills it; and lens D's
  XD4 (old figures in section 5), XD7 (the balance pin's slack and its weight in `tools/testTimes.json`) and XD8 nits.
