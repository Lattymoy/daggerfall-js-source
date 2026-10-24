# Body Motion - the Morrowind body's own walk, carry and blows in third person (BODY-MOTION, 2026-10-18)

Mac: *"I want to build improved animations for the morrowind rig (3rd person)
1. Improved running/walking for all races
2. Weapon specific walking/running animations
For example (running with a 2 hander by the hip)
(1 hand idle animation, holding down away from side. Running with it using the same format)
(Duelhand idle away from sides, running with them behind you)
Improved melee 3rd person attack animations
I want to be as detailed as possible. No band aids"*

The port's own (SCOPE1, `01-Overview/Port-Doctrine.md`): the body is OpenMW's character controller playing Morrowind's
own clips (`02-Formats/Morrowind-Rules.md`, MW-D24/MW-D26); this page is the layer laid over them in third person, and
every place it leaves them is named below. Daggerfall Unity draws no third-person body of its own (its people are
billboards), so for this layer it is no reference: the reference is the clips. The ledger row is Port-Ledger A
(BODY-MOTION).

**AUDIT BODY-MOTION (2026-10-19, Mac: "Audit this")** - five cold lanes on the frozen slice, every finding reproduced,
fixed or decided, and pinned: `01-Overview/audits/Audit-Body-Motion.md`. The sections below are the layer as it now
stands; where the audit changed a law or a claim, the change is marked AUDIT with its finding.

**THE RUN (2026-10-19, Mac after the merge: "Uhh the greatsword running doesnt use both hands. The running animation
with the legs needs to be stiffer. The hands are way too close together when running both in third and first
person.")** - three changes, each measured on the retail biped against the merged layer and pinned
(`test/characters/bodyMotion/bodymotion_run.test.js`, the two-hander's in `bodymotion_carry.test.js`, the first
person's in `test/combat/twohands_mw.test.js`; `tools/mutants/bodymotion_run.json`, 17, all dead), marked TWO-RUN,
RUN-STIFF and RUN-WIDE where they changed a row below. Then, on the same pull request, Mac on the two-hander: "The 2
hander should be held lower at the hio, but not attached to the hip" (TWO-RUN's row again); and the Discord through
Mac, a player: "sprinting with my mace and shield out just makes me look incredibly stupid lol" (SHIELD-RUN).

**STEADY AND LOOSER (2026-10-20, Mac: "When wielding 2 daggers and running, the character is super stiff and wobbles
side to side. Might as well check the other animations also. I think we went way too stiff")** - every class's gait
measured on the retail biped against the merged layer (each hand's sway, each blade's tips, the elbows, the wrists and
the forearms, the knees and the hips), and three changes, each pinned (`test/characters/bodyMotion/
bodymotion_steady.test.js`, RUN-EASE in `bodymotion_run.test.js`; `tools/mutants/held_steady.json`), marked where they
changed a row below: HELD-STEADY (the wobble - every held weapon's tips swung side to side with the chest's stride
counter-turn, the pair's 50 units together, the staff's 45, the two-hander's 44, the spear's 40, the one-hander's 29);
DUAL-RUN (the pair's run - both arms locked straight behind, swinging a tenth of the gait's swing, each forearm turned
128 degrees off its elbow's hinge, past the 85 to 90 AUDIT CARRY-7 holds every run's to); and RUN-EASE (RUN-STIFF's legs
halfway back). The lantern at the waist, on the same report, is Handheld-Torches.md HT-WAIST-SIZE.

## What the clips did - the reference, and why it was not enough

- **One clip per frame, every bone.** The rig's winner ladder (`src/combat/fpArm.js` update: death, the weapon action,
  the recoil, movement, the jump, the idle) poses the WHOLE skeleton from one group, the torch's left arm aside. Rule
  26's per-bone-group priority is the recorded gap (Morrowind-Rules.md, MW-D26 "Gaps" and MW-D52): so a blow while
  walking played the attack clip on the legs, which stopped mid-stride and slid under a body that kept moving.
- **A walk played past its cadence.** Morrowind's walk clip travels 154 units a second (2.2 m/s); Daggerfall walks
  at 3.7 to 6.3 m/s (`src/player/motor.js` walkSpeed, PlayerSpeedChanger.GetWalkSpeed) and runs at 6 to 12. MW-D26
  plays the clip at the actor's speed over the clip's (capped at 10), so the walk ran 1.7 to 2.9 times its own cadence
  (AUDIT DOC-16: it said "two to three") and every foot slid; the run likewise at a sprint.
- **One pose per weapon group.** `idle1h`, `walkforward2c` and the rest are one authored pose a group, bobbed by the
  walk; nothing carries a two-hander differently at a run, or a pair, or holds a one-hander down and away.
- **No cross-fade** (Morrowind-Rules.md [C] "DO NOT IMPLEMENT smooth animation transitions"): a group's first frame
  replaces the last outright.

## The layer - `src/characters/bodyMotion/`

One instance per rig (`createBodyMotion`, `src/characters/bodyMotion/bodyMotion.js`): the player's, each peer's, each
person's in a Morrowind body - they are all `createFpArm` rigs (`src/net/peer/peerBodies.js`). Each frame:

1. **The clocks** (`step`), after the clip machine has stepped, on the rig's own word (`motionWord`): the camera's bag
   (`cam.move` - the input axes, running, grounded, and the ground the body's own steps crossed, `travel`; `cam.yaw`,
   `cam.sneaking`, the climb, the seat, the saddle), the view, the skeleton's family, the race's scale, the weapon type
   and whether it is in the hand, the hands' mode (TWO-HANDS), the torch, a spell, a draw or a sheathe, the long gun's
   hold, a blow's section and progress, and the pair's guard. A frame that does not pose still walks (PEER-CADENCE).
2. **The pose** (`apply`), on the frames that pose, through `poseAssembly`'s `motion` slot
   (`src/formats/morrowind/mwFirstPerson.js`): after the clip's sample, the TWO-HANDS mirror and the neck, and UNDER the
   run, the climb, the seat, the saddle and the long gun's hold - which still win the bones they ask for.

**The ground the body crossed, never the keys' speed** (AUDIT GAIT-9, RIG-3, RIG-6): the gait walks the body's own
travel - the player's from `player/motor.js` `travelAt` (where the collision left it: into a wall the legs stand), a
peer's from its drawn feet (`peerBodies.js`: a strafing or backpedalling peer's legs walk its own way; a jump is a
placement, never a stride), a deck's turns carried with it (`carriedYaw`). A frame with no travel (a contact sheet,
a pin) walks the keys' pace instead.

**What the clip still owns.** The clip machine runs every group as before and decides everything a group decides; the
layer steps aside for each, easing out and back in (`MOTION_EASE`): the whole body for a death, a recoil, a climb, a
seat or a saddle, the air (the jump), the water and levitation; the arms for a draw or a sheathe, a readied spell or a
cast, a bow, a crossbow, a thrown weapon and the long gun's hold; the left arm for a lit torch, and for a shield on it
while a one-hander is drawn or the weapon sheathed (SHIELD-RUN: the layer's free arm pumped at a run, and its forearm -
the Shield Bone's - rose to 104 units, ten under the head's bone, the shield over the head from behind; Morrowind's own
groups carry a shield, and drawn fists or a two-hander hide it, so those keep the layer's arms - the word reads the
shield off the pieces the body wears, the composer's `shield (<record>)` slot). **The upper body is
whoever has the arms** (AUDIT RIG-4, DOC-3, CARRY-10): while the clip has both arms the chest, the neck and the
collarbones are the clip's too (the layer had turned them under the clip's arms - a bow's hand 18.6 units off, the long
gun's barrel 27 degrees), and a torch's left collarbone is the clip's. **The fingers are always the clip's**: the
stance's own group already shapes the hand (closed on its grip in `walkforward1h` and the two-handers' groups, fists in
hand-to-hand's, the pair's left the TWO-HANDS mirror of the right), and a curl laid on top would be added to it
(`climbRig.js` poseArm's curl is relative).

**The switch** is `systems/features.js` 'mw-body-motion' (Morrowind Body Motion, on by default): the viewer's, as the
Steel Helm is - how this machine draws a body, never the wire. Off, the body is Morrowind's clips exactly as before.
On ORG2's one Settings screen it stands in Combat > With Morrowind data, beside the Morrowind Spell Effects
(`ui/settings/settingsMap.js`); its title and note are routed (`features.mwBodyMotion.*`, L10N4), drafted in-session in
all 25 languages (`tools/l10nInSession.mjs` - AUDIT DOC-4: 12 had none; DOC-15/16: five drafts reworded).

## The body, measured - `src/characters/bodyMotion/bodyKit.js`

`bodyOf` reads each skeleton ONCE off its rest pose, never a bone axis (the climb's law, CLIMB6): each leg's and arm's
bone lengths, the hips' and shoulders' widths, the ankle's height over the sole and the shin's rest angle to the foot
(`ankleRest`), the foot's own axes (`footAxes`), the bone that carries the thighs (retail's thighs hang from `Bip01
Spine`, not the pelvis - so the pelvis and the spine turn together as the hips), the trunk's bones above it, the rest's
own rotations of the trunk and head, and the turn that squares the rest's hips and shoulders to the body's right
(keeping their forward tilt, the build's own). The sole has no toe bone to read, so its two contact points are shares
of the leg (`FOOT`: the ball 0.14 ahead of the ankle, the heel 0.055 behind). Every length the laws ask for is a share
of this body's own leg or arm, so the male skeleton, the female, the beast and every race's scale take the same request
to the same place. `bodyKindOf` names the family from the skeleton's path (`base_anim`, `base_anim_female`,
`base_animkna`); anything else - a werewolf's body, a creature's own model - is none, and the layer leaves it to its
clips.

## The gait - `src/characters/bodyMotion/gait.js`

| Term | The law | Why |
|---|---|---|
| Stride | `strideLength`: Alexander's relation, lambda = 2.3 h (v^2/gh)^0.3 (R. McN. Alexander, Nature 261, 1976), capped at the style's `strideMax` and at what the rig's own leg reaches (AUDIT GAIT-3) | the stride a legged body takes at a pace, scaled by its own leg in metres (the race's height on it) |
| The clock | the stride's clock is the ground crossed over the stride; every foot in the air keeps to it, and each foot on the ground keeps its own stance's clock, begun at its strike as far on as the frame ran past it (AUDIT GAIT-15, GAIT-22, GAIT-25) | a strike never moves the other foot's stance, and nothing jumps the clock under a flight |
| Duty factor | `dutyFactor`: the share of a stride a foot stands, falling with the Froude number | a walk keeps both feet down between steps; a run flies |
| A foot down | set down in the WORLD where it struck and held there - carried back under the body by the body's own travel and turn (AUDIT GAIT-6/7/8: it was a function of the phase, and slid 32 to 76 units); `footPlace` + `stancePitch`: the heel rocker, the flat foot, the forefoot rocker, the ankle placed by turning the foot about whichever point touches; on a slope it stands on the slope (AUDIT GAIT-13, GAIT-20); a backpedal's is the walk's played backward - it lands on its toes and leaves on its heel (AUDIT GAIT-23) | the heel or the ball stays where it touched |
| A foot up | it flies by the ground the body crosses, kept to the stride's clock by a quarter of the ground's pace at the most, to its foothold - where the body will be when it lands, along the body's arc in a turn, the foot's path bowed with it (AUDIT GAIT-21); a foothold that leaps (a reversal, a new key) re-bases the flight from where the foot is, its pitch and lift carried (AUDIT GAIT-24); the lift early (`liftProfile`), the toes up for the swing (`swingPitch`), the ankle within its own range of the shin (`ANKLE`, AUDIT GAIT-4) | the foot follows through and reaches, never a straight slide forward |
| A lift | as the stance's share ends on its own clock - or the ground lifts it: past its stance's end along the travel, behind its middle out of the leg's reach at the hips' plan, or beyond what its leg reaches at the hips' lowest (AUDIT GAIT-1/GAIT-8, GAIT-23) | a reversal's or a new key's foot never stands on until the hips sink to it |
| The hips | `hipPlan` + `gaitPose`: the plan's height from each stride end's own rocked ankle (the walk dips as deep as its ends need; a run sinks by its spring, `bob`, and rises in the flight), held by the legs - never higher than a standing leg reaches, a soft minimum; a landing foot taken in by degrees as it comes within reach, a leaving foot asking no more reach than it did as it left (AUDIT GAIT-3, GAIT-20, GAIT-23); the sway over the standing foot; the turn with the stride; the drop on the swinging side; the forward tilt | the body rides its legs |
| The chest | the counter-turn against the hips, the counter-drop, the lean with the pace and a quickening, the bank INTO a turn (AUDIT DOC-1: it leaned out - the yaw grows to the right, a + roll drops the right side); at rest the breath | the trunk carries the arms' swing |
| The steer | `STEER`: the body always faces the camera, so a strafe turns the HIPS toward the travel (0.68 of its angle, at most 60 degrees) and the chest back; past 105 degrees off the facing (12 of hysteresis) a backpedal, the hips turned the other way (at most 40); the way snapped round on a reversal (AUDIT GAIT-1: eased as a vector, S never backpedalled), the forward share and the arms' swing eased over (AUDIT GAIT-12, GAIT-23) | a strafe runs, it does not shuffle sideways; each foot kept on its own side, its lane across the travel (AUDIT GAIT-7) |
| Standing | each foot anchored where it stands while the body turns over it; past `TURN.step` (26 degrees) or off its place the foot on the turn's side steps back under the body, then the other; a turn faster than `TURN.rate` or past `TURN.snap` in a frame (a cut, a teleport) re-plants both; a carry's stance (`CARRY[class].stand`) is stepped into (AUDIT GAIT-10, CARRY-5); sneaking still, it crouches (AUDIT GAIT-5) | the feet never spin under a body turning on the spot |
| The head | level, looking ahead, however the trunk sways | the camera's eye, and a fighter's |

`GAIT_STYLES` holds one row per style (walk, run, sneak), blended by the frame's shares; `BODY_STYLES` scales them per
skeleton family: the female's track 0.72 as wide, her pelvis turning 1.3 and dropping 1.35 as much, her arms held
nearer; the beast's - one style for an Argonian and a Khajiit alike, and for a female of either (AUDIT DOC-12) - its
swing lifted higher (1.15) and its run's spring the deeper (1.25: 1.18 measured), a little lower (0.985), a little over
the ball of its foot (`footBias` -6 degrees). At Daggerfall's walk paces the walk is always at its longest stride
(`strideMax` 2.15 legs - AUDIT DOC-13: "strides lengthen with speed" is a run's): a long, brisk stride at a quicker
cadence, which is what 4.4 m/s is on a human leg; the run is Alexander's to its cap. A race's height lengthens the leg
in metres while the rig's own leg caps the stride: a race 1.2 times as tall strides 3.7 per cent slower at a walk.

**Measured, against the frozen slice** (the hips' worst frame-to-frame drop, rig units; the scripts are the audit's):
60 random 8 s sessions of key changes and turns, the worst frame of each - median 8.92, p90 9.97, worst 10.92 then;
5.53, 7.29 and 9.11 now. Every key change of a walk or a run into another, at twenty points of the stride (640) -
8.80, 10.07, 13.71 then; 3.69, 5.97, 10.32 now. A planted foot in the flat of its stance slides 0.1 units at the most,
from a stand, to a stop, strafing and on a diagonal. What is left is named in the audit (a walk broken into a run the
other way, about 10 units in its worst frame).

**RUN-STIFF** (2026-10-19, Mac: "The running animation with the legs needs to be stiffer"): the run rides higher on a
straighter standing leg (`height` 0.95 of the leg, 0.93 at its fast end - it was 0.9 and 0.87), lifts its foot less
behind it (`lift` 0.12 of the leg, 0.18 fast - 0.24 and 0.4: the heel kicked up to the seat), springs less (`bob`
0.028 - 0.042), turns, drops and tilts its pelvis less (`hipYaw` 8, `hipList` 4, `hipTilt` 8 degrees and its wave
2 - 11, 6, 10 and 3), and swings its arms a little less (42 degrees, the elbow 96 at the front - 44 and 98). On the retail biped the knee folds at most 58.6 degrees past the standing leg's at 8.1 m/s and
49.9 at 5.5 (it folded 97.7 and 86.8), and the hips ride no lower than 0.935 and 0.945 of their standing height (0.866
and 0.881). Riding higher, the leg has less give: a back run turned fast into a strafe (2 to 4 radians a second, then
2 back) dropped the hips 12 to 13.5 units in a frame (the merged layer's 7.9 to 9.5), so a landing foot now takes the
hips in over the last fifth of a leg before its reach, not a tenth (AUDIT GAIT-21's fade): 5.5 to 8. The measures
above, after THE RUN: the random sessions 4.99, 6.75 and 9.01; every key change 3.61, 5.92 and 10.31.

**RUN-EASE** (2026-10-20, Mac: "I think we went way too stiff"): RUN-STIFF's knee, folding 58.6 degrees at a run, was a
stiff-legged lope, and the first run's 97.7 kicked the heel to the seat - so each term RUN-STIFF moved stands halfway
between the two: the run rides at 0.925 of the leg (0.9 at its fast end), lifts its foot 0.18 (0.29), springs 0.035, and
turns, drops and tilts its pelvis 9.5, 5 and 9 degrees (its wave 2.5). On the retail biped the knee now folds 79.9
degrees past the standing leg's at 8.1 m/s and 70.3 at 5.5, and the hips ride no lower than 0.902 and 0.913 of their
standing height; the pin holds both between the two runs before (`bodymotion_run.test.js`).

## The carry - `src/characters/bodyMotion/carry.js`

`carryClassOf` maps the hand's state to a class, and `CARRY[class][gait]` holds each arm's row for idle, walk, run and
sneak, blended by the gait's shares (`gaitShares`) - followed by a critically damped spring (AUDIT CARRY-6: the gait's
first-order eases started a change at full speed). A row is anatomical: the shoulder's flexion, abduction and inward
twist and the elbow's bend (`armByAngles` builds the arm by forward kinematics off the shoulder on the chest's own
frame, with the arm's own bone lengths), how much of the gait's own swing it takes, and - for a weapon hand - the
blade's way and its true edge's in the chest's frame. Every row is the right arm's; the left is its mirror. AUDIT
CARRY-1/2/3/7/8/9/12: every row was searched again against the arm's own ranges (the wrist's ulnar deviation under 35
degrees, its extension under 60, the forearm's supination under 85), the ground (a 110-unit blade over it) and the
thighs and trunk (the weapon out of them), and a two-handed class's left hand on its haft - the two-hander's guard had
run the hilt up the forearm (the wrist 78 to 88 degrees ulnar), the spear's left hand never reached its haft, a
two-hander's sneak put its blade in the ground, and every run asked the forearm to turn 120 to 145 degrees. (DUAL-RUN,
2026-10-20: the pair's run row was not among them - measured against the elbow's hinge, its forearms stood turned 128
degrees; searched again, with the shoulder turned out to carry its share.)

| Class | When | At rest | At a run |
|---|---|---|---|
| free | nothing in the hand, or sheathed | arms hanging, palms in | the gait's pump: elbows near 90, the swing; each hand on its own side of the body, as far apart at their nearest as the walk's (RUN-WIDE: the forearm turned in 22 degrees and the arm held out 10 - the hands crossed the middle, 4.3 units apart against the walk's 22.1; turned out 4 and held out 18, they stand 22.8 apart) |
| one | a one-hander (short or long blade, blunt, axe) | Mac's: held down and away from the side, the blade forward, down and out | "the same format": the arm low and out, the blade trailing behind and down; the free arm pumps - with a shield on it, the clip's arm carries the shield (SHIELD-RUN) |
| two | a two-hander (long blade, warhammer, war axe) | a low guard in both hands, the blade forward and down, the left hand toward the pommel; the stance's feet split, the hips turned | Mac's: at the hip, in BOTH hands (TWO-RUN - the left let go and pumped: "the greatsword running doesnt use both hands"; then "held lower at the hio, but not attached to the hip"): the grip low before the right hip and clear of it, the arms hanging nearly straight, the left hand on the hilt toward the pommel, the blade trailing behind, down and out past the right leg; the chest turned 32 degrees toward it and leaning 10 more (`runTurn`, `runLean`), and the arms not swinging - a hand on each end of one weapon |
| wide | a staff | both hands, the staff across the body, its head up and left | at the hip, trailing; the left pumps |
| spear | a spear | both hands on the haft (AUDIT CARRY-2), the point forward and up | at the hip, the point forward and down; the left pumps |
| dual | a pair (TWO-HANDS) | Mac's: both held down and away from the sides, mirror images | Mac's: both swept behind the body, the blades trailing; the trunk leans in (`runLean`); pumping (DUAL-RUN: 0.4 of the gait's swing and a fifth of its elbow - the elbows 21 to 26 degrees - each hand 18.7 units fore and aft behind the hips, the shoulder turned out 60 so the forearm turns 52 to 66 off its hinge; it stood locked straight, swinging a tenth - 8.5 units - the forearm turned 128) |
| fists | bare hands drawn - a weapon type of none in the hand (AUDIT MELEE-3) - or both fists up (TWO-HANDS) | a guard, both fists up before the chest, the left leading; the feet split | the gait's pump, as wide as the free run's (RUN-WIDE: 3.5 units apart, now 22.5) |
| clip | a bow, a crossbow, a thrown weapon, a readied spell | the clip's own arms | the clip's own arms |

**The two-hander's run in both hands** (TWO-RUN): the retail biped's arm is 35 units from the shoulder to the wrist,
and a grip at the right hip stands 40 to 44 from the left shoulder - the left arm reached its full length and fell
short. So the class turns the chest toward the weapon at a run (`CARRY.two.runTurn`, by the run's share, laid as
`runLean` is - a body carrying a long blade low on its right turns its shoulders to it), and the row was searched again
within the arm's ranges with the left hand on the hilt, the blade's tip clear of the ground and out of the right thigh.
The row takes none of the gait's arm swing: with 0.12 of it, the right hand ran past what its arm reaches at one end of
the stride and the left, closed on the right's request, stood 2 units off the hilt.

The first row held the grip by the hip, the elbows bent (turned 25 degrees): 0.02 to 0.06 of a leg under the hip joint,
5 units off the thigh, and beside the hip as the chest turned with the stride - "attached". Searched again for a grip
lower, clear of the thigh and ahead of the hip: the arms hang nearly straight, held forward, and the chest turns 32
degrees and leans 10 more (`runLean`) - the grip 0.07 to 0.10 of a leg under the hip joint, 8.4 units off the thigh and
6.6 to 18 ahead of the hip. It goes no lower with both hands on it: with the arms straight, the deepest of every search
(the chest leaning 18 degrees more) stood 0.12 under, and a lower grip held forward of the hip is a straight arm's
height lost to its angle.

**HELD-STEADY** (2026-10-20, "wobbles side to side"): the gait turns the chest against the hips once a stride and
drops it the other way (`GAIT_STYLES` `chestYaw`, `chestRoll` - 14 and 3 degrees at a run), and the carry built every arm
on the chest as it stood - so every weapon held still in the hand swung with it: the pair's two blades together, their
tips 50 units side to side at a run. A runner's chest turns against the hips because the swinging arms ride it; a hand
that holds a blade holds the blade's way still against it. So the gait hands the stride's own share of the chest's turn
apart (`gaitPose`'s `chest.wave`), and the carry lays each arm on the chest as far as that arm rides it (`carry.js`
`rideOf`): an empty arm by its row's swing share (all of a run's pump, a little of a guard's), a hand that holds a blade
none - it pumps by its row's swing about the steadied frame. Each arm's request is turned back about its shoulder by
what the chest carries past its share (`carryHands`, `turnAbout`, the turn `bodyMotion.js` makes from the chest as laid
to the chest without the wave). A weapon in both hands binds the chest: as far as the left hand closes on the right's
haft, the chest takes none of the stride's turn (`strideRide` - held steady while its shoulder rode the chest, the
two-hander's left hand fell 3.2 units off its hilt at a run and the staff's 2.4 off its haft at a walk). Measured at a
run, the held tips' side to side, then and now: the pair 50.5 and 5.5 (pumping, DUAL-RUN), the staff 45.1 and 2.7, the
two-hander 43.5 and 5.3, the spear 39.6 and 2.6, the one-hander 28.9 and 3.4; the empty arms' and the fists' pump
unchanged (their hands carried 14 to 15 units across with the chest, the chest turning 27 degrees across a stride). The
two-hander's chest, and a staff's and a spear's at a walk, now turn with the hips alone.

**Between gaits and classes** (AUDIT CARRY-4/5/6/13): the blade turns along a great circle through its class's own way
round the outside of the body (`via` - summed and normalised, it swung 20 to 41 degrees a frame and a claymore's tip 28
units into the ground); a two-handed class's left hand comes off and onto its haft by the grip's own share (switched at
half, it leapt 30 units); a class changed eases its hands and its stance's feet from the old class's (switched at once,
the feet were thrown 11 units), and one changed back mid-blend turns the blend about where it stands.

**A weapon is turned by its own bone.** Morrowind's Weapon Bone runs its +Y out of the fist's thumb side (the blade) and
its +X down the hand toward the fingers (the true edge - `characters/ownModels/ownWeaponModels.js`, RIFLE-STANCE's
reading). `gripRequest` (`src/characters/bodyMotion/bodySolve.js`) stands the bone where a row or a blow asks - its
grip, its blade, its edge - by reading the bone's relation to the hand off the skeleton each frame and asking the hand
for the frame that carries it there: no number about any hand or any weapon is held. A pair's left blade rides the
pair's Weapon Bone Left, the mirror of the right's (`combat/twoHands/mirrorRig.js` offWeaponBoneAddon), so the left
hand is solved as the right's request mirrored across the chest's middle (`mirrorRequest`). A two-hander's left hand
closes on the haft (`hafHand`): the right hand's own request reflected across the blade's plane (the left closes from
the other side of it) and moved along the blade by `TWO_HAND_GRIP` (a two-hander two fifths of an arm toward the
pommel - AUDIT CARRY-1: a fifth stood it inside the right forearm); a staff's and a spear's slides along its haft
within `TWO_HAND_HAFT` to where its arm reaches (AUDIT MELEE-9: held at one place it fell 0.2 to 0.54 arm lengths
short through a thrust).

## The blows - `src/characters/bodyMotion/melee.js`

**Timed by the machine.** The clip machine already runs a blow through three sections - the wind-up to "max attack",
the release ending ON "<type> hit" (fitted to Daggerfall's own hit by MW-PACE1), the follow-through - and `blowU` reads
each section's own progress onto the choreography's clock: the wind-up spans u 0 to `U.windup` (0.3, eased), the release
u 0.3 to `U.hit` (0.5, accelerating into the target), the follow u 0.5 to 1 (decelerating). So the blade meets the
target on the frame Daggerfall deals the damage. A melee wind-up is never held: the machine runs it at strength 1 and
reads the blow's strength as the release begins (`combat/fpArm.js` windUpStrength - AUDIT DOC-2: the record said a held
wind-up held its key, and the notes that a heavier attack wound up further). That strength scales the body's wind
(`windFor`, between 0.65 and 1), followed over the layer's ease, never stepped to (AUDIT MELEE-12: read at once, it
turned the chest up to 14 degrees in the release's first frame).

**A choreography** (`MELEE`) is keys over u: the grip in arm lengths off the middle of the shoulders in the BODY's frame
(the facing - so the trunk's wind is the body's and the path is the blade's), the blade's way and its true edge's (a cut
leads with its edge), the chest's turn, the hips' lead, the weight's shift forward and drop, the lead foot's step and
the free arm's counterweight. The grip and every scalar are joined by Catmull-Rom splines; the hand's frame - the
blade and the edge, a fist's fingers and palm - by a spline of rotations, so it never flips (AUDIT MELEE-1: splined as
vectors and normalised, it turned 100 to 150 degrees in a frame). Each blow begins on the striking hand's carry as it
stands and ends back on it (`fromCarry` - a run's blow turned 139 degrees in its ease-in); its hit key keeps the
stroke's own tangent, so the grip meets the target at 85 to 95 per cent of its top speed (AUDIT MELEE-10: at half of
it); the backhands wind round the outside of the trunk (AUDIT MELEE-2: through it, 7 to 8 units deep). Families: 'one'
(a one-hander, and each blade of a pair), 'two' (a two-hander, the staff and the spear - the left hand on the haft
throughout), 'fists' (the straight, the hook, the overhand and - for Daggerfall's backhand - the uppercut). Blows: chop
(wound up by the head, its blade up, down through the front), slash (the forehand: wound up right and behind, through
the front, out to the left), back (Daggerfall's StrikeRight, MS1's reversed slash: wound up across to the left, out to
the right) and thrust (drawn back to the lower ribs - AUDIT MELEE-13: "to the hip" - and driven straight out with a
lunge). A pair's left blade's blow and a left fist's are the right's mirror; a weapon held alone strikes with its own
right hand whichever hand the machine leads with (AUDIT MELEE-7: a left lead swung the empty hand).

**The body under it** (AUDIT MELEE-4/6/8/11): the lead foot steps - lifted, quickly enough (`TURN.quick`) to come down
in the follow-through (it slid 12 to 23 units flat); a strafe's blow takes back toward the facing part of the hips'
turn (`BLOW_TRUNK.steer`) and twists the chest no more than `BLOW_TRUNK.twist` (50 degrees) off them (it was 80 to 92 -
the bound holds a plain strafe's chest too); a blow the machine drops part-way (a stagger, an interrupt, a sheathe) is
let go over the layer's ease out where it stood, and one cut by the next begins where it stood (the hand leapt 0.9 to
1.4 arm lengths); the pair's guard lowers the arm whose fellow strikes.

**The legs keep walking.** The blow drives the arms, the chest, the hips' turn and shift; the legs stay the gait's. The
recorded gap of rule 26 - a swing on the legs - is closed in third person for every body the layer walks. A recoil
the clip plays during a blow leaves the layer on (AUDIT MELEE-5: the word's `hit` is a recoil only while no action
plays - read as one, it dropped the layer mid-blow to the raw attack clip, the legs frozen).

## The solve - `src/characters/bodyMotion/bodySolve.js`

`solveBody` lays the whole request on the skeleton in the order a body is built from the ground up, each turn TOWARD the
request by the layer's weight from wherever the clip put the bone: the hips (the pelvis and the thigh-carrying bone
turned together to their body-frame turn) and the body moved so the hips' middle stands where asked; the chest turned to
its own, spread up the spine (`TRUNK_SHARE` - it bends, it does not kink) by the share of the arms the layer has; the
neck and each collarbone put back on the chest as they stand at rest by its own arm's share (an attack clip's own swing
of them would carry the shoulders off the arms' requests - and while the clip has an arm, it keeps its collarbone:
AUDIT RIG-4); the head level; the legs and the arms by the climb's two-bone solve (`combat/climbRig.js` solveReach), the
knee toward the foot's way, the foot to its toe and its sole's up - a foot in the air within `ANKLE`'s range of the shin
the reach gives it (AUDIT GAIT-4: a run's swing drew the toes up 82 degrees toward the shin) - the hand to its fingers'
and palm's ways.

**Built for every body on the street.** The trunk's rotations are decided top down from the pose's own locals and
written as locals, the skeleton composed once; each limb is solved off that composition and its three bones' turns
carried down to each other by hand, written as locals, nothing re-composed (`poseAssembly` composes once after every
slot). AUDIT RIG-1/RIG-2, measured on the retail biped over 13 bodies posed each frame: 4.62 ms a frame with the layer
against 1.36 without - a quarter of a millisecond a posed body, its solve about 0.2 ms, and 0.3 ms a frame more of
collection; the clocks (10 to 39 microseconds a body) run on every body - the player's, each peer's, each person's on
the people's lanes (the watch's too - AUDIT DOC-14) - and the pose only on the frames a body is posed (the people's
under their skin budget, `SKIN_BUDGET`). LEFT, said here: the cost is the layer's, unbudgeted beyond that.

**A rotation kept a rotation** (`combat/climbRig.js` `orthonormal`, now in `turn`) - found by this slice, a fault of
the climb's own. A turn's new local is a product of float32 matrices through a parent frame that already carries every
turn above it; unsquared, the skew compounds about fourfold a level down a chain of turns. The long gun's pin found it
first - its hands 0.05 units off their holds over the layer's first, turn-by-turn solve - and the climb alone carried
it too: a deep request (the body moved and swung, the spine bent, the shoulders drawn, both arms, both legs, the look)
left its rotations 2.65e-3 from orthonormal and its hands up to 3e-3 units off their holds, inside its pins' own
tolerances. Each local is now squared by Gram-Schmidt with its handedness kept (the pair's mirrored Weapon Bone Left
stays mirrored): the skew stays at float32's own rounding however deep the chain, and the climb's, the seat's and the
long gun's hands land within 3e-6 of their holds, over the moving body or the clip.

## The rig's wiring - `src/combat/fpArm.js`

`createFpArm` stood at 1,999 code lines - the function's, not the file's (AUDIT DOC-16) - under HOST-SPLIT's 2,000-line
knot (`test/scenes/hostceiling.test.js`). The wiring is the motion made once per rig, stepped after the clips on
`motionWord` (the word a line for each of what it says - the body, its blow, its hands: AUDIT RIG-10, it was one line of
412 characters), and handed to the third-person `poseAssembly` as its `motion` slot; the hip lantern's rider moved out
to pay for them - the swing and last frame's heading are `createHipLantern` (`src/systems/lanternSwing.js`, beside the
swing's law) - 1,988 code lines after the audit. LEGIBLE 1 (2026-10-19, `01-Overview/Readability-Arc.md`) counts a host
in logical lines, blind to layout, and gives `createFpArm` a ceiling of its own: it stands at 2,854 against 3,252, the
layer's wiring two more than main's without it (2,852). The lantern at the waist swings on the gait's stride while the layer
walks the legs (the walk clip's otherwise, as before - HT-WAIST), in the hips' own frame (AUDIT RIG-7: read in the
facing, a strafe's swung it across the hips).

THE FOUR HOSTS RULE: no host is touched. The world (`scenes/world.js`), the fixed city (`scenes/exterior.js`), the
interiors (`scenes/worldModes.js`) and the dungeon (`scenes/dungeonContext.js`) all draw the body through the one rig
(`player/mwView.js` -> `fpArm.drawThird`) and its one update (`combat/weapon/weaponRig.js`), so the layer reaches all four
from the rig; peers and people reach it through `net/peer/peerBodies.js`'s own rigs. A peer's camera carries its
drawn feet's own travel (AUDIT RIG-3, GAIT-18: it carried only a forward move, and a strafing peer's legs walked forward
under a body going sideways). The layer is begun afresh whenever it is switched on - a body handed on, third person
again (AUDIT RIG-5).

## Departures (Port-Ledger A, BODY-MOTION)

1. In third person the body's legs, trunk, carry and a blow's body are the layer's, not Morrowind's clips' (on a
   base_anim skeleton, with the switch on); the clips still own every group's decisions, the hands' shapes, and the
   bones above - and the trunk while they have the arms.
2. The layer eases (`MOTION_EASE`, `GAIT_EASE`, the class's carry): the departure from Morrowind-Rules.md [C] "DO NOT
   IMPLEMENT smooth animation transitions" - the clips beneath it still switch as the reference does.
3. Rule 26's gap is closed for third person: the legs keep the gait under a blow.
4. A third-person blow's body is the port's choreography, timed by the clip machine's sections.
5. The hip lantern swings on the gait's stride while the layer walks the legs.
6. The legs walk the ground the body crossed, each foot standing where it struck: never the clip's cadence, never the
   keys' speed.

## Not verified here, said plainly

This container has no Morrowind data. Every pose was tuned and pinned on the vendored retail biped
(`test/fixtures/mw/retailRig.mjs` - retail `base_anim`'s own NiNodes, the male skeleton), drawn as skeletons from five
sides through `tools/bodyMotionSheet.mjs`'s contact sheets (`node tools/bodyMotionSheet.mjs list` names the scenes; they
draw no weapon at a sneak and no change between gaits or classes - AUDIT CARRY-11, those are the pins') - never on the
female's or the beast's own rest, never under a skinned body, and never against the retail clips the layer leans on
for the hands' shapes. The layer measures each skeleton it is handed, so the families take the same requests; but how a
request reads on Morrowind's own bodies is for Mac's eye on his own data, and every table (`GAIT_STYLES`,
`BODY_STYLES`, `STAND`, `STEER`, `TURN`, `CARRY`, `TWO_HAND_GRIP`, `TWO_HAND_HAFT`, `MELEE`, `BLOW_TRUNK`, `ANKLE`,
`SLOPE`) is one frozen row to move there. THE RUN's first-person change (RUN-WIDE, `handsLaw.js` `RUN_3D`) moved the
law's own place on the picture: no retail first-person skeleton is vendored, and the test's fixture arm reaches neither
the old place nor the new (its right wrist stood 0.54 of the half-frame out at the top of the stroke with 0.36 asked,
0.73 with 0.6).

**Found by STEADY AND LOOSER, not fixed here, said plainly.** The solve (`bodySolve.js` reachLimb) turns each arm bone by
the least rotation from where the clip held it, so the roll a forearm carries is the clip's and the hand alone takes the
turn its request asks - a skinned wrist shows all of it. Measured against the elbow's hinge (CARRY-7's measure), the
two-hander's left hand on its hilt at a run (TWO-RUN) turns its forearm 119 degrees, past the 85 to 90 range; the
pair's run did too, and its row now stands inside it. Turning the haft hand's elbow way would move the measure, not the
wrist (the arm stands almost straight, and the bones' roll is still the least rotation's) - the fix is the solve's:
sharing the forearm's turn between the forearm and the hand, as a body does along its forearm. That moves every arm
the layer poses and can be judged only on a skinned body, so it waits for Mac's eye on his own data. The one-hander's,
the staff's and the spear's runs stand inside the range (64 to 74, 68 to 70, 30 to 42).

## Pins

- `test/characters/bodyMotion/bodymotion_gait.test.js` (10): the body measured; Alexander's stride and its cap, the duty
  factor; a planted foot standing still in the world through the flat of its stance, walking and running, and each foot
  striking once a stride of ground; the hips riding the legs and never asking a standing foot past its reach, through
  a reversal and new keys too; the steer and the backpedal; the feet anchored while the body turns and the turn's side
  stepping first; the families' and the races' terms; the rockers; the solve on retail's bones and every rotation it
  writes kept a rotation; the solve's ease.
- `test/characters/bodyMotion/bodymotion_carry.test.js` (14): every weapon type and hands mode to its class and the haft's
  grip; the arm by its angles; the one-hander held down and away and its run; the two-hander's guard with both hands and
  its hip carry in both hands at a run, low, clear of the hip and the chest turned to it (TWO-RUN); the clip keeping a
  shield's arm, and the rig's word reading a shield off the body's pieces (SHIELD-RUN); the pair mirrored at rest and swept behind at a run; the clip keeping the bow, the draw and
  the torch's arm; the blow's clock; the slash with the whole body and its edge leading; the chop, the thrust and the
  backhand; a pair's left blade's blow the right's mirror and a two-hander's left hand on the haft through a blow; the
  legs walking under a blow; switched back on with the heading moved (no step, no bank); the rig's word; the wiring by
  source.
- `test/characters/bodyMotion/bodymotion_run.test.js` (2): the run's legs - the knee's fold and the hips' height
  (RUN-STIFF, then RUN-EASE: between the two) - and the running hands on their own sides, as far apart as the walk's (RUN-WIDE); the first person's
  running fists before their own shoulders in `test/combat/twohands_mw.test.js` (RUN-WIDE THE FIRST PERSON'S RUNNING
  FISTS); `tools/mutants/bodymotion_run.json` (17, all dead). The earlier sets, re-run on THE RUN, found two survivors -
  AUDIT-BODY-MOTION-reach-taken-at-once (the stiffer run flung no foot out of reach where GAIT-21 looked) and
  AUDIT-BODY-MOTION-strike-sets-the-clock (its hips no longer showed a clock set at a strike) - each killed by a pin
  added to the audit's: a back run turned fast into a strafe (GAIT-21), and the clock after a reversal (GAIT-22).
- `test/characters/bodyMotion/bodymotion_steady.test.js` (3, STEADY AND LOOSER): every held weapon's tips steady at a
  run and a jog while the empty arms and the fists still ride the chest (HELD-STEADY); a weapon in both hands binding
  the chest, its left hand on the haft; the pair's run behind the hips, pumping, its elbows bent and bending, its
  forearms under 75 degrees off their hinges (DUAL-RUN); RUN-EASE's legs in `bodymotion_run.test.js`, between RUN-STIFF's
  and the first run's. `tools/mutants/held_steady.json` (20, with HT-WAIST-SIZE's - Handheld-Torches.md). Re-aimed by
  content, the records this change moved: `tools/mutants/bodymotion_run.json` RUN-STIFF-the-swing-kicks,
  RUN-STIFF-the-run-sinks and TWO-RUN-the-turn-never-laid; `tools/mutants/bodymotion.json`
  BODY-MOTION-pair-left-unmirrored, BODY-MOTION-pair-run-forward and BODY-MOTION-blow-chest-unturned. PIN MOVED, the
  earlier sets re-run on this change: RUN-WIDE THE RUNNING HANDS APART held the run's hands no nearer each other than
  the walk's less a tenth, and with RUN-EASE's lower hips RUN-WIDE-the-arm-held-in (the arm held in 8 degrees) came
  through by 0.008 units - the tolerance is a twentieth now (the run's hands stand 22.6 to 22.9 apart at their nearest,
  the walk's 22.1, the mutant's 19.9 to 20.1).
- `test/characters/bodyMotion/bodymotion_audit.test.js` (17) and `test/characters/bodyMotion/bodymotion_claims.test.js`
  (9): the audit's - every finding fixed, as its lane measured it, and every claim this page makes that no other pin
  could fail (`01-Overview/audits/Audit-Body-Motion.md`).
- `tools/mutants/bodymotion.json`: 55 mutants, all dead (the first run's two survivors - the walk's own height over
  the standing foot, which the legs' reach had hidden; and `turn`'s squaring, which the layer's own solve no longer
  reached - each killed by a pin added for it: the walk's height at mid-stance, and the deep climb; the audit's three -
  the clock paced by time, the legs' hold, a stale heading - each by a pin added for it). `tools/mutants/bodymotion_audit.json`
  (48: 46 dead, two recorded equivalent with why) and `tools/mutants/bodymotion_claims.json` (37, all dead).
- PIN MOVED, each with its note: `test/combat/twohands_mw.test.js` and `test/player/climb/climb6.test.js` (the
  `poseAssembly` order: the `motion` slot between the neck and the run); `test/player/ww2_idlebob.test.js` (the bag's
  travel and drawn yaw, AUDIT GAIT-9/GAIT-17/RIG-6). Mutant records whose anchors this slice moved, re-aimed by content:
  `tools/mutants/htwaist.json` HT-WAIST-the-body-never-swings-it and HT-WAIST-the-portrait-swings;
  `tools/mutants/wb9h.json` WB9h-the-pose-copied-for-its-yaw (the peer's camera now carries its travel); and THE RUN's,
  `tools/mutants/bodymotion.json` BODY-MOTION-two-run-at-the-chest (the two-hander's run row searched again, TWO-RUN)
  and BODY-MOTION-blow-chest-unturned (the chest's yaw now carries the class's `runTurn`); SHIELD-RUN's,
  BODY-MOTION-torch-arm-taken (the left arm's line now gives it to the clip for a shield too).
- The row's own (CI found them on the pull request): the registry's counts and order (`test/systems/features.test.js`
  FT0 and FT15's note budget, +208; `test/systems/ft18_features.test.js` 106; `test/systems/ft8_combatvisuals.test.js`
  56) and, PIN MOVED, the Morrowind section's items (`test/formats/morrowind/mwnpc_mainmerge.test.js`), with
  `tools/mutants/mwnpcmerge.json` MWNPCMERGE-row-off-settings re-aimed by content.
