# AUDIT BODY-MOTION (2026-10-19) - the Morrowind body's own walk, carry and blows, audited

Mac, of the branch that brought BODY-MOTION (`04-Characters/Body-Motion.md` - "I want to build improved animations for
the morrowind rig (3rd person) ... I want to be as detailed as possible. No band aids"): **"Audit this"**. This page is
the findings, each with its verdict. What the audit changed is written into Body-Motion.md's sections as they now stand,
each change marked AUDIT with its finding.

## How it was run

Five cold lanes on the frozen slice (e2eee4b09, the pull request's head when it was green), each an adversarial reader
told to prove a finding by running it before reporting it; then every finding reproduced again by the author before it
was acted on, and the author's own pass, which found six more (GAIT-20 to GAIT-25) in the fixes' own measurements:

| Lane | Over | How |
|---|---|---|
| GAIT | `gait.js` - the stride, its clock, the feet, the hips, the steer, standing | the gait stepped at 30, 60, 144 and 240 Hz through key changes, starts, stops, turns, reversals, slopes and a wall, the hips' and the feet's every frame |
| RIG | the rig's wiring (`fpArm.js`), the peers (`peerBodies.js`), the hip lantern, the cost | the real rig and the peers' cameras; a street of rigs timed and its allocations counted |
| MELEE | `melee.js` and the blow's body in `bodyMotion.js` | every family's blows frame by frame through the machine's own sections, the hand's frame, the trunk, the feet |
| CARRY | `carry.js` | every class and gait held and in transition, the wrists against their ranges, the blade against the ground and the body, a search over each row (`p9_search`) |
| DOC | the record, the pins, the mutants, the locales, the notes | 37 scratch mutants of the record's claims against the suite; the locales; every number the record gives |

Severity: **HIGH** a body that visibly breaks for everyone (a pop, a slide, a limb through the body); **MED** a wrong
pose many will meet, or a claim the record makes that is false or unpinned; **LOW** a corner or a cost; **NIT** a word.

## Findings

| # | Sev | Finding | Verdict |
|---|---|---|---|
| GAIT-1 | HIGH | S never backpedalled: the way was eased as a vector, so forward to back stayed forward | FIXED: the way eased by its angle and snapped round on a reversal - S turns the legs about in the frame it is pressed |
| GAIT-2 | HIGH | The push-off popped the hips 7.8 to 14 cm and the strike 2.9: the stride's ends read the rocked ankle and rocked it again | FIXED: the hips' plan from each end's own rocked ankle (`hipPlan`); a steady walk's and run's worst frame 1.8 and 1.6 units (7.3 and 6.2) |
| GAIT-3 | HIGH | The hips dropped 9.8 to 13.7 cm in the frame of the heel strike (15.6 to 25.9 on a tall, slight race): the landing foot was in no reach limit, and out of reach late in its swing | FIXED: a foot in the air held by its leg as it comes down, from the print it left to the foothold it lands on; the stride capped by the rig's own leg |
| GAIT-4 | HIGH | A run's swing drew the toes up 83 degrees toward the shin: the swing's pitch was absolute to the ground | FIXED: a foot in the air within `ANKLE` (25 up, 50 down) of the shin the reach gives it - at most 28 |
| GAIT-5 | HIGH | Sneaking still stood bolt upright, over Morrowind's own idlesneak crouch | FIXED: a standing sneak's row - it crouches 9 units |
| GAIT-6 | HIGH | A start or a stop from a stand skated 0.35 to 1.0 m | FIXED with GAIT-8: each foot stands in the world; 0.1 units in the flat of a stance |
| GAIT-7 | HIGH | A strafe and a diagonal slid 20 to 29 cm a step: the lane was measured across the hips' right, not the travel | FIXED: each foot's lane across the travel, continuous through a steer |
| GAIT-8 | HIGH | A standing foot was a function of the phase, never in the world: it slid turning, on a key change, through the backpedal's band and from a walk to a run (6.7 to 67 cm) | FIXED: set down in the world where it struck and carried back by the body's own travel and turn |
| GAIT-9 | HIGH | The gait read the motor's speed before the collision, so the legs strode in place into a wall | FIXED: the body's own travel (`motor.js` `travelAt`): into a wall the legs stand |
| GAIT-10 | HIGH | A draw or a sheathe threw the feet 15 cm and the pelvis 18 degrees; a blow's step was a glide | FIXED with CARRY-5 and MELEE-4: the stance stepped into; the step lifted |
| GAIT-11 | MED | Turning on the spot past 100 degrees a second twisted the feet to 177 degrees, across the midline | FIXED: each foot steps by its own twist and place, the turn's side first; a cut re-plants both |
| GAIT-12 | MED | Entering the backpedal flipped the arms' swing 54 to 88 degrees in a frame | FIXED: its share eased over - 7 degrees a frame on a diagonal into it (46) |
| GAIT-13 | MED | The ground was z = 0: a slope sank the feet 21 to 40 cm and floated them 15 to 23 | FIXED: the ground's slope from the body's own travel; every planted contact on it (with GAIT-20) |
| GAIT-14 | MED | The record's claims were false: "never slides", the steer for S, "leaves and lands at ground speed", standing "never spins", a power walk's cadence | FIXED: the record restated from the law as it stands and its measurements |
| GAIT-15 | LOW | The phase hung on the frame rate under a change of speed (30 Hz: 7.3 cm) | FIXED where it shows: the feet keep the ground at every rate and the hips step no further for the time at 30 Hz than at 60 (1.7 against 1.8 units a sixtieth). LEFT, said: at 30 Hz a stance can end a frame past its place, where the ground lifts it and sets the stride's clock to it, so its cadence runs behind the 60 Hz walk's - a timing, never a slide or a pop |
| GAIT-16 | LOW | A NaN or an Infinity in a frame poisoned the state for good | FIXED: such a frame is no frame; the gait whole through a NaN, an Infinity and a 5 s frame |
| GAIT-17 | LOW | After a climb the word's yaw was not the yaw the body is drawn at | FIXED: the drawn yaw (`bodyYawFor`'s) |
| GAIT-18 | LOW | A peer's word was always forward | FIXED with RIG-3 |
| GAIT-19 | NIT | The header's sprint 0.28 (0.30), a werewolf style no body walks | FIXED: the header's numbers; no werewolf style |
| GAIT-20 | MED | (the author's) On a slope the walk dipped deeper than on the level, the run's trailing foot held the hips down after its toe-off (15 units), and the ground under a leaving foot ran on down the slope behind it | FIXED: the stride shortened and the stance moved up the grade (`SLOPE`), the down-slope end keeping the level's pitch; a leaving foot reached where it is |
| GAIT-21 | HIGH | (the author's) A running turn's landing foot flew the straight chord inside the hips, past the leg's reach, and dropped them 14 units as it came within it | FIXED: the flight bowed along the body's arc; a foot coming back into reach takes the hips in by degrees |
| GAIT-22 | HIGH | (the author's) Two feet a reversal put in the air together kept landing a fifth of a stride apart for good | FIXED: every flight kept to the stride's clock by a quarter of the ground's pace at the most; the stride's clock the ground crossed, never set by a strike (set by each, an early one threw the other flight's pace and its foothold - with GAIT-24) |
| GAIT-23 | HIGH | (the author's) A backpedal's foot was the walk's turned over (its push 34 degrees toes-up, the ankle 45 degrees toward the shin); a new key's foot out beside the travel held the hips to their floor; the forward share flipped every foot's pitch in a frame | FIXED: a backpedal's foot the walk's played backward; a foot lifted once its leg no longer reaches it at the hips' plan; a leaving foot asks no more reach than it did as it left; the forward share eased |
| GAIT-24 | HIGH | (the author's) A flight landing the frame the way reversed was set down where the old way had it, 58 units from its hip past the leg's reach - the hips to their floor, 14.6 units in the frame; re-based in the air, its lift and pitch were read again from mid-swing (the foot thrown 8 units in a frame) | FIXED: the foothold read again before the flight may land, a leap of it re-basing the flight from where the foot is, its pitch and lift carried. LEFT: a walk broken into a run the other way still drops the hips about 10 units in its worst frame |
| GAIT-25 | MED | (the author's) A standing foot read its stance off the stride's clock, so the other foot's early strike threw it toward its push - 28 degrees in a frame | FIXED: each standing foot keeps its own stance's clock, begun at its strike |
| RIG-1 | MED | 0.23 ms a posed body, unbudgeted | LEFT, measured and said in the record: over 13 bodies posed each frame, 4.62 ms against 1.36 - a quarter of a millisecond a body; its clocks 10 to 39 microseconds |
| RIG-2 | MED | 368 KiB allocated a posed body a frame | LEFT with RIG-1: 0.3 ms a frame more of collection over 13 bodies |
| RIG-3 | MED | Peers sent forward 1, so a strafing or backpedalling peer's legs slid 41 to 59 cm | FIXED: a peer's camera carries its drawn feet's own travel; a jump is a placement |
| RIG-4 | MED | Under the clip's arms (a bow, a spell, a draw) the layer owned the trunk and the collarbones: a bow's hand 18.6 units and 38 degrees off | FIXED: the upper body is whoever has the arms - 2.4 units and 0.1 degrees |
| RIG-5 | LOW | `motion.reset` was never called: a spare rig handed on, a switch-on, a return from far came back in the walk, the bank and the feet they had left; a snap read as a turn banked 8 degrees | FIXED: begun afresh as it is switched on; a snap no turn |
| RIG-6 | LOW | A turning deck read as turning on the spot: 10 steps in 19 s, the feet 17 degrees against the deck | FIXED: the deck's turns carried (`carriedYaw`) |
| RIG-7 | LOW | The hip lantern did not turn with the hips (60 degrees off strafing) | FIXED: the way read in the hips' frame |
| RIG-8 | MED | The record's frame cost and peers' slide misstated | FIXED: the record restated from the measurements |
| RIG-9 | NIT | The status card stayed stale once the body was the clip's | FIXED: it says off |
| RIG-10 | NIT | The wiring packed into one line of 412 characters | FIXED: a line for each of what the word says |
| MELEE-1 | HIGH | The blade and the hand flipped 100 to 150 degrees in a frame: their ways splined as vectors and normalised; a run's carry blended into the blow by vectors | FIXED: the hand's frame splined as a rotation, begun and ended on the carry's own hand - 53 degrees a frame at the most at the machine's 0.4 s pace (89 at 0.2 s, the release's own), a run's ease-in 4 to 15 (139) |
| MELEE-2 | HIGH | The striking arm passed through the chest (a one-hander's and a two-hander's backhand, 7 to 8 units deep; a two-hander's chop and slash) | FIXED: the backhands wind round the outside; a two-hander's chop's wrist brushes 0.45 units, accepted |
| MELEE-3 | HIGH | Bare-handed blows vanished for peers, people, and a fist with a shield or a light | FIXED: a weapon type of none in the hand is the fists |
| MELEE-4 | HIGH | The blow's step slid the lead foot 12 to 23 units, never lifted | FIXED: a step, lifted 4.9 units and down within 0.12 s of the hit (`TURN.quick`) |
| MELEE-5 | HIGH | A recoil during a blow dropped the layer to the raw attack clip, the legs frozen | FIXED: the word's `hit` is a recoil only while no action plays |
| MELEE-6 | MED | A blow dropped part-way popped (0.9 to 1.3 arm lengths, the chest 20 to 36 degrees) | FIXED: let go over the layer's ease where it stood (0.2 to 0.33 arm lengths); one cut by the next begins where it stood (1.43, now 0) |
| MELEE-7 | MED | A one-hander held in the left hand alone swung the empty hand and flung the sword arm back | FIXED: a weapon held alone strikes with its own (right) hand |
| MELEE-8 | MED | Strafing while striking twisted the trunk 80 to 92 degrees off the hips | FIXED: the blow takes back part of the steer and twists no more than 50 (`BLOW_TRUNK`) - which bounds a plain strafe's chest too (75) |
| MELEE-9 | MED | A staff's and a spear's left hand left the haft (0.2 to 0.54 arm lengths short) | FIXED: it slides along the haft to where its arm reaches - 0.09 at the most, standing and walking. At a run a two-handed blow eases the left hand from the free arm onto the haft, by design |
| MELEE-10 | MED | "Fastest at contact" was false: the hit came at 50 to 70 per cent of the stroke's top speed | FIXED: the hit key keeps the stroke's tangent - 85 to 95 per cent |
| MELEE-11 | MED | The pair's guard dip was erased by the pair's carry | FIXED: the guard in the word, laid on the carry |
| MELEE-12 | LOW | The strength's wind was dead on retail and popped 9.5 to 14 degrees where it lived; the "held wind-up" unreachable | FIXED: the wind followed, never stepped to (1.6 degrees); the record says what the machine does |
| MELEE-13 | NIT | "The thrust drawn back to the hip": it is at the lower ribs | FIXED in the record |
| MELEE-14 | NIT | A left fist's step moved the rear foot | NO CHANGE: a guard's lead is its left for either fist, and the left steps |
| CARRY-1 | HIGH | The two-hander's guard ran the hilt up the right forearm and the left fist sat inside it; the wrist 78 to 88 degrees ulnar (its range 35) | FIXED: its rows searched again (the left two fifths of an arm toward the pommel); every row inside the arm's ranges |
| CARRY-2 | HIGH | The spear's left hand never reached its haft | FIXED: the spear's rows - its left on the haft |
| CARRY-3 | HIGH | Sneaking with a two-hander put the blade in the ground and through the right thigh | FIXED: the sneak's row levelled and searched - above the ground, out of the thighs |
| CARRY-4 | HIGH | The haft hand switched at half the blend: the left hand leapt 30 to 35 units | FIXED: on and off the haft by the grip's own share - 3.8 units a frame at the most |
| CARRY-5 | HIGH | A class's stance (the feet, the hips' turn) and its run's lean switched on the frame the class changed: the feet thrown 10.6 units | FIXED: eased from the old class's, the feet stepped into it - 1.2 units a frame at the most |
| CARRY-6 | HIGH | Between gaits the blade swung through the ground or the trunk, 20 to 41 degrees a frame: unit vectors summed and normalised | FIXED: the shares by a critically damped spring, the blade along a great circle through its class's way round the outside - 15.7 degrees a frame at the most, above the ground. LEFT: a two-hander walked into a run brushes the thigh 5.4 units |
| CARRY-7 | MED | Every run's carry asked the forearm to turn 120 to 145 degrees (its range 85 to 90) | FIXED: the run rows searched again |
| CARRY-8 | MED | Wrists past their range: the one-hander's idle 47 degrees ulnar (its sneak 70 to 75), the pair's 49 (67 to 71) | FIXED: the rows searched again |
| CARRY-9 | MED | The spear's and the staff's butt through the right thigh | FIXED: with CARRY-2's rows and the staff's sneak |
| CARRY-10 | MED | The long gun, the bow and the crossbow rode the chest's counter-turn and lean: the barrel 9 to 14 degrees off | FIXED with RIG-4 - 0.1 degrees |
| CARRY-11 | MED | False claims: the spear in both hands, the class change easing, titles, "every pose drawn" | FIXED: true now (CARRY-2, CARRY-5), the titles narrowed, the record says what the sheets do not draw |
| CARRY-12 | LOW | A one-hander's blade cleared the ground by only 82 units at a run | FIXED: with CARRY-7's rows |
| CARRY-13 | LOW | A class changed back mid-blend began the blend afresh (3.9 units) | FIXED: turned about where it stands |
| CARRY-NIT | NIT | "The left on the haft below the right" is false: above | FIXED: the title says toward the pommel |
| DOC-1 | HIGH | The bank leaned OUT of a turn | FIXED: the sign, and a pin of it |
| DOC-2 | HIGH | The notes said "a heavier attack winds up further": melee is never held, and its strength is read at the release | FIXED: the notes and the record say what the machine does |
| DOC-3 | MED | The collarbones and the neck reset to rest under the clip's arms | FIXED with RIG-4 |
| DOC-4 | MED | The record said "in every language that has a table": 12 of 25 had none | FIXED: drafted in all 25 |
| DOC-5 to DOC-9 | MED | 36 of the record's 37 claims of the gait, the carry, the blows, the solve and the stepping aside survived a mutant | FIXED: each pinned, all 37 mutants dead (`bodymotion_claims.json`) - the beast's bob is a run's (a walk's dip is its legs' reach), and a taller race's cadence falls 3.7 per cent, not with its leg (the walk at its longest stride) |
| DOC-10, DOC-11 | MED, LOW | Titles that claimed more than their assertions made | FIXED: each narrowed to what it asserts, or the assertion added |
| DOC-12 | LOW | "Argonians and Khajiit each have their own": it is one beast style, a female beast's too | FIXED in the notes and the record |
| DOC-13 | LOW | "Strides lengthen with speed": the walk is always at its longest stride | FIXED in the record |
| DOC-14 | LOW | The cost named neither the watch's lane nor the peers | FIXED: the record names every lane |
| DOC-15 | LOW | id's "Jika mati" read "when dead"; de's "Aus spielt ... ab" | FIXED: redrafted |
| DOC-16 | NIT | "two to three times" (1.7 to 2.9); "three lines"; 1,999 the function's, not the file's; the Ledger row in two cells with no DFU position; Two-Hands.md's switch off; `melee.js`'s families; the sheet's "four views" (five); bg's, cs's, ro's words | FIXED, each |

### Measured, then and now

On the retail biped, the frozen slice against the head:

- **The hips' worst frame** (rig units) over 60 random 8 s sessions of key changes and turns: median 8.92, p90 9.97,
  worst 10.92 then; 5.53, 7.29 and 9.11 now. Over every key change of a walk or a run into another, at twenty points of
  the stride (640): 8.80, 10.07 and 13.71 then; 3.69, 5.97 and 10.32 now.
- **A planted foot** in the flat of its stance: 32 to 76 units of slide then; 0.1 now, from a stand, to a stop,
  strafing and on a diagonal.
- **A foot in the air**: its height's worst change in a frame 8.0 units then, 5.6 now; its pitch's 22 degrees, 17.
- **On a slope**: every planted contact within 0.04 units of it; the walk dips 4.7 units up 20 degrees and 9.4 down
  (10.6 on the level).

### Left, and said

- GAIT-24's residual: a walk broken into a run the other way drops the hips about 10 units in its worst frame - a
  reversal the motor makes in one frame, which no stride can. Designs tried and measured against it (the strike's
  clock reset kept, the flight's pace slewed, the holds read off the stride's progress) each traded it for a worse
  median or a worse random session.
- GAIT-15's timing at 30 Hz (above), CARRY-6's thigh brush, MELEE-9's run, and RIG-1/RIG-2's cost.
- The backhand winds up faster than it strikes (9 m/s against 4.8): the choreography's own, for Mac's eye.
- A sneak's planted ankle stands 41 degrees toward the shin - inside a weight-bearing ankle's range.

### Not this arc's

Run beside the slice's own, the mutants of every module it touched found two survivors in `player/motor.js` that the
pull request never changed - `CLIMB2-under-a-sill-no-seek` and `AUDIT-TURN-the-hold-turned-unasked` survive on main's
own head too. Named here for their own arcs.

## Pinned

`test/characters/bodyMotion/bodymotion_audit.test.js` (17) - every FIXED finding of the GAIT, RIG, MELEE and CARRY lanes
and the author's, as its lane measured it; `test/characters/bodyMotion/bodymotion_claims.test.js` (9) - DOC-5 to DOC-9,
every claim of the record no other pin could fail; and the slice's own `bodymotion_gait.test.js` and
`bodymotion_carry.test.js`, their titles narrowed (DOC-10/11) and three pins added for the survivors of the slice's own
mutants (the clock paced by time, the legs' hold, a stale heading). Mutants: `tools/mutants/bodymotion_audit.json` (48:
46 dead, two recorded equivalent with why), `tools/mutants/bodymotion_claims.json` (37, all dead) and the slice's
`tools/mutants/bodymotion.json` (55, all dead); every record of the modules the slice touched re-run beside them, and
the one its change moved re-aimed by content (`tools/mutants/wb9h.json`).
