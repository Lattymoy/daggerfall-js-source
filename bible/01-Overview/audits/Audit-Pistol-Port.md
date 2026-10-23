# AUDIT PISTOL-PORT (2026-10-22) - the pistol lab in the game, audited

The owner, of PISTOL-PORT (`05-Combat/Dwarven-Pistolet.md` "PISTOL-PORT"; branch `ccr-a6d650c5-oyn0eb` at 0931b2d6e, the
slice's commit 2ff2f0ce7 merged with main's 1d748b7f9): **"Audit this"**. This page is the findings, each with its
verdict. What the audit changed is written into the record's sections as they now stand, each marked AUDIT PISTOL-PORT
and its id.

## How it was run

Four lanes, each a cold adversarial reader of a FROZEN snapshot (a worktree at 0931b2d6e - `Home.md`'s DO NOT FIX WHILE
THE VERIFIER IS READING), each told to prove a finding - a repro against the real code, or the code quoted with a trace
from a real caller - and none handed the author's conclusions. Then the author's own pass (M). Every finding was
reproduced on the working tree before it was acted on, and every fix's pin was run against the code WITHOUT the fix and
seen to fail.

| Lane | Over | How |
|---|---|---|
| A - the machines and the law | `playerWeapon.js`'s pistols, `pistolPair.js`, `gunMachine.js`, and every reader of the player weapon's events for a gun: the four hosts' ranged arms, Pellets, the skill tally, the off hand's terms at impact, techniques, the Morrowind arm | probes on the real `PlayerWeapon` and the real rig with a host stand-in doing what the four hosts do on a ranged 'hit', at the snapshot and at the tree before the slice |
| B - the screen, the sound, the prototype match | `weaponRig.js`'s pistol paths, `pistolLane.js`, `pistolViewmodel.js`, the page, the probe, the harness | the real rig in Node and the page in Chromium on one clock, past the one case the slice's pins held (1280x800, Speed 50, a forward walk, no look) |
| C - what shares the code | the Thunderlock's whole path, the gun lab page, melee, bows, techniques, claws, the draw ladder, the hosts, saves, the net | the same probe at the snapshot and before - every quad, sound, kick, flash and muzzle diffed - and 252 test files naming the changed modules |
| D - the record and the pins | every sentence the slice wrote, the commit's claims, the pins' titles, a mutation campaign of its own (62 records), the 33 retired records' laws | quotes against the code; the before tree measured; mutants against 15 suites |
| M - the author | the slice's push, CI's view, the record of the fixes | the whole suite; the mutant record run whole after the fixes |

**What reached a player: nothing** - PISTOL-PORT was pushed to its branch and never merged or deployed. On the branch:
- under the Morrowind arm a pair of Pistolets lost half its shots, and the shots that landed wore the off hand's terms (A1);
- two pistols' hits in one frame - a flurry pulled a frame apart, one hitched frame - were both the second pistol's: its
  weapon, its off-hand blow, its barrel, one time in ten (A2, D5);
- one Pistolet moved between the hands skipped its reload: a pair's rate of fire at full damage (A3);
- one frame with a Pistolet in hand erased the Thunderlock's reload - the quickslot key fired the rifle three times as
  fast (C1);
- nothing pinned the gun machine itself: every shot after a pistol's first could have stopped landing and every suite
  stayed green (D1).

37 findings, 34 distinct (lanes cross-reported three). Every one is fixed or recorded below.

## Findings

### Lane A - the machines and the law

| # | Sev | Finding | Verdict |
|---|---|---|---|
| A1 | HIGH | Under the Morrowind arm a pair lost half its shots: `armCannotDraw` gated a ranged pull only on an Idle machine, and the mirror is not Idle while a pistol fires - so the second pistol fired into an arm that refused it, its hit merged into the first's one held hit, and the one shot released wore the off hand's terms (20 s: 11 projectiles from 22 pistol shots, against 21 before) | FIXED: a Pistolet's pull waits for the arm whatever the mirror says (`weaponRig.js armCannotDraw`); pinned (`pistolport_audit.test.js` A1, an arm stubbed to `fpArm.js`'s contract), mutant AP-A1-arm-gate-on-idle-alone |
| A2 | MED | Two hits in one update - `_pistolsStep` set each hand's strike and weapon in turn and handed both 'hit's after; every host reads `playerWeapon.weapon` and `blowWeight` as it handles an event, so both were the second pistol's (9.6% of flurries at 60 Hz with 1 ms jitter) | FIXED: the hits queued in the order the pistols fired and handed out ONE an update, each with its own hand current - the second a frame later; pinned (A2, both leads and through the rig on a 90 ms frame), mutants AP-A2-* |
| A3 | MED | One Pistolet moved to the other hand inside its reload fired at once - the reload was the HAND's machine's and the Pistolet's equip delay is nought (20 s juggling: 21 shots, none off-hand, against 11 before) | FIXED: a pistol moved takes its own machine (`_pistolsFor`, `_pistolHeld`); pinned (A3), mutant AP-A3-reload-stays-with-the-hand |
| A4 | MED | A technique's shot and a plain pull in one frame: both hits in one update, and `claimShot` filtered every 'hit' - the plain pistol banged and reloaded with no shot | FIXED with A2: one hit an update, in the order fired - the technique's pistol fires first in the frame (the rig steps the technique key ahead of the gesture), so its hit is handed out and claimed first, the plain shot's the next update; pinned (A4). A check that `claimShot` take only the lead's hit was written and taken out again: under the trigger law the off hand is never mid-shot while the lead is loaded for a technique, so its mutant could not die |
| A5 | LOW | The last Pellet fired twice: the second pistol pulled inside the first's 83 ms before its hit spent the Pellet - a bang and nothing | FIXED: no Pistolet pull without a Pellet for it, counting the shots still owed one (`weaponRig.js pelletsOwed`, `PlayerWeapon.pistolShotsDue`), at the click door and the gesture door; pinned (A5, both doors), mutants AP-A5-* (AP-A5-queued-hits-owe-nothing equivalent and recorded: a hit is queued only while both pistols fire) |
| A6 | LOW | A pair broken between a pull and its hit fired the stowed pistol's shot as the one left in hand | FIXED: a hit from a pistol no longer drawn fires nothing; pinned (A6), mutant AP-A6-stowed-pistol-fires |
| A7 | LOW | The balance test pulled only on an Idle machine and counted pulls, never the game's hits; and at 30 Hz one Pistolet drops to 31 a minute - the page's machine drops the Firing step's overshoot | FIXED: the test pulls every frame and counts the hits the hosts are handed (32, 64, 28 - the table holds); the 30 Hz drift KEPT, the page's own machine (`gunMachine.js`), mutant AP-A7-balance-off-the-pulls |
| A8 | LOW | Stale comments: `handReloadUntil` "the rig lowers each pistol on it", `update` "the Pistolet's cadence off its own row"; `PISTOLET_TICK_SECONDS`/`PISTOLET_COOLDOWN_SECONDS` read by tests alone | FIXED the comments; the two constants KEPT - the feel's cadence named in seconds, which the tests read |
| A9 | LOW | Swapped to a sword mid-shot, the pistol's shot finished as a sword blow (before the slice too), and - new - the sword waited out the pistol's reload | FIXED: pistols put by release the classic machine (`_pistolsPutBy`); pinned (A9, mid-reload and mid-shot), mutants AP-A9-* |

Checked clean: one Pellet a landed hit in every host; the skill once a shot, weighed by the blow; the hit on frame 1; a
pair's strike ending once; pistols put by reloading on; a technique waiting on the lead; the duel's `off`; the online
counters; cadence independent of Speed, before and after.

### Lane B - the screen, the sound, the prototype match

| # | Sev | Finding | Verdict |
|---|---|---|---|
| B1 | HIGH | Strafing and jumping swing the pistols hundreds of px (a strafe at walk speed ~170 px at 1280x800, up to 200; a jump drops them 165) - and the page could make neither motion, so the Inertia the owner tuned (2/2/0, twice the mod's default) had never seen either | FIXED the half that is the port's: the page strafes (A/D) and jumps (J) on the game motor's own `gunMotion` (`pistolJumpClimb`), and the identity pins run a strafe and a jump with the game to the float. The response itself is the mod's Inertia at the owner's tuning: OPEN, the owner's call, now on the page to judge |
| B2 | HIGH | A mouse flick swayed the pistols twice as far in the game - the page turned its stand-in camera at a fixed sensitivity 1.0 where the game's MouseLookSensitivity opens at 2.0 - and on a high-DPI screen the page's canvas of device pixels halved its pixel-sized Bob and Inertia | FIXED: the page turns at the game's own `lookScale` and draws in CSS pixels, as the game's canvas does; the identity pins and the probe turn the head |
| B3 | MED | The character's Speed paces the reload dip and the holster (Speed 20 or 90: 120-170 px from the page's 50 mid-dip) - matching only at Speed 50, all the pins tested | RECORDED: the game's input where the page has its Speed slider (`Dwarven-Pistolet.md`); pinned (D11 speed), mutants AP-D11-*-speed-* |
| B4 | LOW | The room's muzzle light ran a frame behind the sprite's flame (read off last frame's pictures), and in a flurry was thrown from the last pull's side while the first's flame was the bright one | FIXED: the light read off the stepped machines, from the brightest drawn flash (`pistolLane.js glow`, `brightest`); pinned (B4), mutants AP-B4-* |
| B5 | LOW | Under the arm a Pistolet's flash ran on the Thunderlock's tick (= C4) | FIXED with C4 |
| B6 | LOW | The page's crouch walked at the walk's speed (its bob twice the game's) | FIXED: `gunMotion` crouches at the motor's crouch speed; pinned (B1 B6 B8), mutant AP-B6-crouch-at-the-walk |
| B7 | LOW | One pistol in the left hand: the game draws it on the Handedness side (DFU's weapon in use), the page's single mirrors a left lead | RECORDED: a named departure (DFU's rule); pinned (D11 left hand), mutant AP-D11-picture-mirrored-by-hand |
| B8 | LOW | The probe's picture rig had no camera - it bobbed as walking beside a lab standing still (22 px) - and the harness handed the rig a speed ratio and base no host sends | FIXED: a standing host camera; the harness hands the hosts' own `motionBagOf` fields (`speedField`), and `gunMotion`'s ratio is PlayerMotor.Speed's over the walk, standing or not; mutant AP-B8-ratio-of-the-step |

Checked clean: every host clamps dt at 0.1 s as the page does; the panel's magnitudes past Diverse Weapons; the art's
pose and the spring; the sounds' volumes, pitch and timing; Weapon Widget switched on; the holster's slide; NEAREST
sampling.

### Lane C - what shares the code

| # | Sev | Finding | Verdict |
|---|---|---|---|
| C1 | MED | One frame with a Pistolet in hand erased the Thunderlock's reload: the mirror overwrote the classic machine's cooldown and nothing restored it - the quickslot swap (both guns' equip delay nought) fired the rifle at 0.47 s where it owes 2.15 | FIXED: the classic machine's cooldown kept when the pistols take it and restored when they are put by (`_classicCooldown`); pinned (C1), mutants AP-C1-* |
| C2 | LOW | A Thunderlock swapped in during a Pistolet's shot dropped into its reload pose and clacked early (the mirror's cooldown inherited) | FIXED with C1 and A9 |
| C3 | LOW | A swing finished as the new weapon's after a swap mid-shot (before the slice too) | FIXED with A9 |
| C4 | LOW | The classic machine's `tick` stayed the last weapon's while a Pistolet was held - the arm's flash clock reads it (lane C's suspicion; lane B's B5 measured it) | FIXED: the mirror carries the pistols' own frame clock; pinned (C4), mutant AP-C4-the-last-weapons-tick |

Checked clean: the Thunderlock's whole first-person path, 0 differing frames in every scenario before and after; 23
melee, bow, technique and claw scenarios, 0 differing steps; the removed `!this.gunPair` guard unreachable; `pistolsUp`;
both lab pages in Chromium; nothing of the pistols' state in a save, a net message or a clone; no allocation to speak
of; 2,747 tests across 252 files, 0 failures.

### Lane D - the record and the pins

| # | Sev | Finding | Verdict |
|---|---|---|---|
| D1 | HIGH | Nothing pinned the gun machine: a machine whose hit never re-armed (every pistol's second shot a bang and nothing) passed every suite - the identity pins run the same machine on both sides | FIXED: the machine pinned directly - four shots, one hit each, on frame 1, then the reload - and a Pistolet pulled four times landing four; mutants AP-D1-* |
| D2 | HIGH | The draft patch notes announced a fix ("no longer skips or freezes a pistol's reload") for a reload the old code already kept across a swap | FIXED: the notes say it is kept |
| D3 | MED | "Never the orb's colour" held for the sprite alone - the light a Pistolet throws on the room is the orb's (`thunderlockMuzzleLight`) | RECORDED: the claims narrowed to the sprite; the light's colour OPEN, the owner's call |
| D4 | MED | The flurry's light from the wrong side (= B4) | FIXED with B4 |
| D5 | MED | Two hits in one frame both the second pistol's (= A2) | FIXED with A2 |
| D6 | MED | The record said the before-script pulled "a flurry mid-shot" - it pulled 40 frames apart, no frame had both pistols firing; and the probe paired hands by index (a swapped order read as 1,000 px) | FIXED: the probe pulls six frames apart (both firing), strafes, turns and jumps, and matches hands by name; the record says what was measured |
| D7 | MED | The identity pin compared the game against the TEST's transcription of the page; the page itself only the probe saw, which CI does not run | FIXED: the page's wiring - its opening state, its frame call, its rect - is `pistolLab.js`'s (`pistolPageState`, `pistolPageStep`, `pistolPageRect`), the page calls it and the pins run it; mutants AP-D7-*. What stays the page's own: its keys, its mouse and its canvas size, seen by the probe alone |
| D8 | MED | Stale numbers and text: "51 records", "four re-aimed", the old widget path in the record and `gunFeel.js`, the prior audit's `_reload`/RL-/TQ- rows and its 81 records | FIXED, each where it stands |
| D9 | MED | Three of the 33 retired laws were dropped, not re-aimed: the left rig stepped flipped (Two-Hands' sway rules), a loaded pistol up while the other reloads, a pair sliding off whole | FIXED: each pinned (D9) - the mirror read on the screen, a turn lagging both the same way - mutants AP-D9-* |
| D10 | MED | The identity pins' titles claimed mutants they cannot kill - a law inside the frame both sides run | FIXED: the titles say what identity sees, and name the pins that hold the rest |
| D11 | MED | Unpinned: the camera shake, the Offset switch, a left-handed player's rigs, one pistol's picture in the left hand, the look, the Speed, `ranged` (the arm's hold), and the page's wiring | FIXED: each pinned (D11, the identity script's turn, the arm's release), mutants AP-D11-* and AP-D7-* |
| D12 | LOW | `handReloadUntil`'s comment; "six departures" short of the list; the notes' "exactly"; the arm reading `last` after a pair is broken (a pistol no longer held) | FIXED: the comment, the list (`Dwarven-Pistolet.md`), the notes; the arm takes a pistol still held; pinned (D12), mutant AP-D12-arm-off-last-alone |

### Lane M - the author

| # | Sev | Finding | Verdict |
|---|---|---|---|
| M1 | MED | The slice was pushed without its last mutation run whole: 212 of 554 neighbouring records judged when the run was stopped for the audit | FIXED: every record aimed at a file the port or the audit changed - 479, in 62 lists - run on the fixed tree: 477 dead, 0 survived, 2 equivalent as recorded (AP-A5-queued-hits-owe-nothing; TECHFX1-the-hit-twice, which died once under four workers' load and stands as recorded alone and in a workspace) |
| M2 | MED | No pull request, so CI's `verify` never ran on the slice's head | FIXED: the whole suite here on the fixed tree, with ARENA2: 33,068 tests, 33,016 pass, 49 skipped, 3 failing - all three red on main too (Outside the slice, below) |
| M3 | LOW | The pistol lab's twin, `gun-proto.html` (the Thunderlock's), turns at the same fixed sensitivity on the same device-pixel canvas (B2) | OPEN: not this slice's - the Thunderlock's lab, left to its own |
| M4 | MED | The audit's own A5 fix lengthened the rig's swing gate (`&& !pelletsOwed()`), and AUDIT 29's source pin (`test/scenes/audit29_host.test.js`) reads that line by its text - red at the audit's first push: the author's test list took the files that IMPORT the changed code and the ones naming it in the slice's own areas, and missed a pin that reads the rig by path from elsewhere. Found by the final mutation run (AUDIT29-D2 no verdict) | FIXED: PIN MOVED, the record judged again (dead); then every test whose text names a changed file run - 91 more files, 1,020 tests, 0 failing - and the whole suite (M2) |

## Outside the slice

- Three real-data tests fail with ARENA2 present, on main (a61d01901) exactly as on this branch, and skip on CI, which
  has no ARENA2: `test/formats/worldData/it1_worlddata.test.js` and `wd1_worlddata.test.js` (Immersive Travel's
  `WALLAA08.RMB.json` patch no longer rebuilds the author's file sha256 for sha256) and
  `test/systems/quest/fb1004d_cratefree.test.js` (the crate-free markers counted in BLOCKS.BSA). Not this slice's;
  left to their own.

## What stands

- Pins: `test/combat/gun/pistolport.test.js` (16 - the identity script now strafes, turns and jumps, and runs the page's
  own wiring), `test/combat/gun/pistolport_audit.test.js` (26), `test/combat/pistolet_law.test.js` A4 through the
  game's doors, the harness handing the hosts' events and motion bag.
- `tools/mutants/audit_pistolport.json`: 51 records over `playerWeapon.js`, `weaponRig.js`,
  `gunMachine.js`, `pistolViewmodel.js`, `pistolLane.js`, `gunViewmodel.js`, `pistolLab.js` and the balance test.
- `tools/pistolPortProbe.mjs`: the page itself in Chromium against the rig, a pair and one pistol, 490 frames each with
  a mid-shot flurry, a strafe, a turn and a jump - 0 frames differ, worst 2.27e-13 px.

## Still open

- **The Pistolet's response to a strafe and a jump** (B1): the mod's Inertia at the owner's tuning, now on the page.
- **The colour of the light a Pistolet throws on the room** (D3): the orb's, as the Thunderlock's; the sprite's flame is
  as painted.
- **The gun lab's stand-ins** (M3).
