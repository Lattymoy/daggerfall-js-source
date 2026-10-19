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
cast, a bow, a crossbow, a thrown weapon and the long gun's hold; the left arm for a lit torch. **The upper body is
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
two-hander's sneak put its blade in the ground, and every run asked the forearm to turn 120 to 145 degrees.

| Class | When | At rest | At a run |
|---|---|---|---|
| free | nothing in the hand, or sheathed | arms hanging, palms in | the gait's pump: elbows near 90, the swing |
| one | a one-hander (short or long blade, blunt, axe) | Mac's: held down and away from the side, the blade forward, down and out | "the same format": the arm low and out, the blade trailing behind and down; the free arm pumps |
| two | a two-hander (long blade, warhammer, war axe) | a low guard in both hands, the blade forward and down, the left hand toward the pommel; the stance's feet split, the hips turned | Mac's: at the hip in the right hand, the blade trailing behind and down; the left lets go and pumps |
| wide | a staff | both hands, the staff across the body, its head up and left | at the hip, trailing; the left pumps |
| spear | a spear | both hands on the haft (AUDIT CARRY-2), the point forward and up | at the hip, the point forward and down; the left pumps |
| dual | a pair (TWO-HANDS) | Mac's: both held down and away from the sides, mirror images | Mac's: both swept behind the body, the blades trailing; the trunk leans in (`runLean`) |
| fists | bare hands drawn - a weapon type of none in the hand (AUDIT MELEE-3) - or both fists up (TWO-HANDS) | a guard, both fists up before the chest, the left leading; the feet split | the gait's pump |
| clip | a bow, a crossbow, a thrown weapon, a readied spell | the clip's own arms | the clip's own arms |

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
`SLOPE`) is one frozen row to move there.

## Pins

- `test/characters/bodyMotion/bodymotion_gait.test.js` (10): the body measured; Alexander's stride and its cap, the duty
  factor; a planted foot standing still in the world through the flat of its stance, walking and running, and each foot
  striking once a stride of ground; the hips riding the legs and never asking a standing foot past its reach, through
  a reversal and new keys too; the steer and the backpedal; the feet anchored while the body turns and the turn's side
  stepping first; the families' and the races' terms; the rockers; the solve on retail's bones and every rotation it
  writes kept a rotation; the solve's ease.
- `test/characters/bodyMotion/bodymotion_carry.test.js` (14): every weapon type and hands mode to its class and the haft's
  grip; the arm by its angles; the one-hander held down and away and its run; the two-hander's guard with both hands and
  its hip carry at a run; the pair mirrored at rest and swept behind at a run; the clip keeping the bow, the draw and
  the torch's arm; the blow's clock; the slash with the whole body and its edge leading; the chop, the thrust and the
  backhand; a pair's left blade's blow the right's mirror and a two-hander's left hand on the haft through a blow; the
  legs walking under a blow; switched back on with the heading moved (no step, no bank); the rig's word; the wiring by
  source.
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
  `tools/mutants/wb9h.json` WB9h-the-pose-copied-for-its-yaw (the peer's camera now carries its travel).
- The row's own (CI found them on the pull request): the registry's counts and order (`test/systems/features.test.js`
  FT0 and FT15's note budget, +208; `test/systems/ft18_features.test.js` 106; `test/systems/ft8_combatvisuals.test.js`
  56) and, PIN MOVED, the Morrowind section's items (`test/formats/morrowind/mwnpc_mainmerge.test.js`), with
  `tools/mutants/mwnpcmerge.json` MWNPCMERGE-row-off-settings re-aimed by content.
