# FIELD BUGS 2026-10-26c - the Morrowind body in third person, one #feature-feedback thread

One thread from the Discord's #feature-feedback, handed over by the owner as phone screenshots: patriot_505, "Morrowind
models + weapon animations need a little tweaking" ("Beside that, third person + morrowind models is a really awesome
experience"). Read on main's `d5a4c9c6a`. No Morrowind data is in this container (it is not freeware, and ARENA2 plays
no part here), so every pose below was measured on the vendored retail biped (`test/fixtures/mw/retailRig.mjs`, the
skeleton `vendor/weapon-sheathing` ships) through `tools/bodyMotionSheet.mjs`'s contact sheets and the pins' own
measures. The pins are named under each fix; the mutants are `tools/mutants/fb1026c.json` (52, all dead), and two
records of BODY-MOTION's were re-aimed by content (`bodymotion.json` BODY-MOTION-one-run-blade, `bodymotion_audit.json`
AUDIT-BODY-MOTION-run-supinated). The fifth row is the owner's "Continue" on what THRUST-CHAMBER saw in passing.

| | Report | What it was | Done |
|---|---|---|---|
| 1 | "Two-handed sword (claymore) forward pierce attack animation causes character's hands to clip through his back." | Proven. Daggerfall's StrikeUp is Morrowind's thrust (`mwFirstPerson.js` DF_STRIKE_TO_MW_ATTACK), and in third person the body motion's two-hander thrust (`characters/bodyMotion/melee.js` MELEE.two.thrust) wound up with the grip drawn back beside the hip, 0.2 of an arm behind the shoulders. The left hand closes on the hilt toward the pommel (`carry.js` TWO_HAND_GRIP, -0.4), so it stood 0.31 to 0.38 of an arm behind the shoulders' plane - 11 to 13 units, past the back - and the left arm crossed behind it. | THRUST-CHAMBER |
| 2 | "Running and sprinting with one-handed weapon looks off, because hand is in twisted position pointing weapon to the side unnaturally (I guess it uses the same animation as two-handed variant but with only one hand)." | Proven, and the guess is close: the one-hander's run row (`carry.js` CARRY.one.run) trailed the blade behind, down and out to the right - the two-hander's trailing carry in one hand. Holding it there turned the forearm 64 to 74 degrees off its elbow's hinge (the walk's: within 9); the blade pointed 0.54 out to the side. | ONE-RUN |
| 3 | "Bow, while being drawn, is pointed upwards too much." | A reference law never ported. OpenMW pitches the third-person upper body with the look while a ranged weapon is in use - two RotateControllers, on `bip01 spine1` and `bip01 spine2`, half the pitch each (Morrowind-Rules.md [C], "The ranged aim pitch is TWO RotateControllers"). The port had none, so the drawn bow kept the clip's own angle whatever the aim: looking down at a target from behind the body, it pointed over it. Porting it found a second fault, in the law the first-person neck already used. | BOW-AIM, ROOT-TURN |
| 4 | "Please, add an option to move camera a bit to the side (like in the "eye of the beholder" mod) for morrowind 3rd person models (that mod doesn't adjust camera position with those models enabled), because crosshair is located on top of character's head and it is inconvenient to target something with ranged attacks." | A feature. The Morrowind body's camera (`player/mwCamera.js`) is vanilla's, centred behind the actor, so the crosshair's ray passes through the head. Eye Of The Beholder's offsets are its own sprite camera's (`eyeOfTheBeholder/eotbCamera.js`), not this one's. | MW-SHOULDER |
| 5 | (the owner, on the chop's and the slash's left arm seen behind the back in passing: "Continue") | Proven, and wider than seen. Measured against the audit's own trunk (`bodymotion_audit.test.js` MELEE-1: 9 units about the pelvis-to-neck line, under 3 in) with BOTH arms - the audit read the striking arm's alone, CARRY-1 the weapon's - the hand on the haft went into the trunk in the two-hander's guard (4.5 to 6.3 units at rest, walking and sneaking) and through every blow of a two-hander's, a staff's and a spear's (5.8 to 8.5). One-handers, pairs and fists stood clear (2.5 at most). | TWO-CLEAR |

## THRUST-CHAMBER (1) - `src/characters/bodyMotion/melee.js`

No DFU member: Daggerfall Unity draws no third-person body. The body motion is the port's own layer over Morrowind's
clips (`04-Characters/Body-Motion.md`, Port-Ledger A BODY-MOTION).

THE CHANGE. The thrust's wind-up key (u 0.3) chambers the hilt BEFORE the right hip, the point raised at the target -
grip [0.3, 0.5, -0.4] in arm lengths off the shoulders' middle in the body's frame, blade [-0.2, 0.96, 0.2] (TWO-CLEAR
moved it 0.07 further out and right, [0.37, 0.57, -0.4], and its follow's key 0.12 further out) - and the
draw is the trunk's coil (the chest turned 24 degrees right, the hips 12, the weight back), not the hands'. The release
and the follow are unchanged. Through the whole blow, standing and walking, both wrists now stand in front of the
shoulders' plane in the chest's frame (the left at 0.056 of an arm at its least standing, the guard's own, and 0.15
walking), and no point of either arm passes behind the back. Before and after are `node tools/bodyMotionSheet.mjs <dir> two-thrust`.

PINS: `test/characters/bodyMotion/fb1026c_mwbody.test.js` THRUST-CHAMBER - every frame of the blow, standing and
walking, each wrist ahead of the shoulders' plane; the wind-up still coils the chest past 15 degrees; the release still
drives the grip 0.75 of an arm ahead. Mutants THRUST-CHAMBER-drawn-behind (the old key), THRUST-CHAMBER-chest-square.

SEEN IN PASSING: the two-hander's chop and slash put the left arm behind the back for two or three frames mid-release
(up to 15.6 units in the chop, 13.6 in the slash, measured on the same biped at the audit machine's pace), where the
spline carries the hilt from over the shoulder to the front. Not what the report named; put to the owner, who said
"Continue" - TWO-CLEAR (5).

## ONE-RUN (2) - `src/characters/bodyMotion/carry.js`

No DFU member (as THRUST-CHAMBER). Mac's own direction for the carry stands: "1 hand idle animation, holding down away
from side. Running with it using the same format" (`04-Characters/Body-Motion.md`).

THE CHANGE. The run row is the stand's format at a run: the arm low and out, nearly straight (the elbow 16 degrees),
swinging 0.35 of the stride, the blade forward and a little down, out by a fifth (`row(8, 21, 16, -4, 0.35, ...)`). The
carry holds a blade's way still in the chest's frame while the arm swings, so the wrist takes the swing - and with a
bent elbow and the blade still forward and down the wrist would have to bend 40 to 95 degrees toward the little finger
(a bent elbow carries the blade up, not down). So the arm stays near straight, and the wrist runs 2 to 33 degrees.
Measured at 8.1 and 5.5 m/s: the forearm within 21 degrees of its hinge (it was 64 to 74), the blade 0.93 along the
facing, 0.2 out and 0.32 down, its tip 33 units over the ground at its lowest.

And the class's `via` is gone: it carried the blade's way between a stand and a run back and up round the body, which
the trailing blade needed. With the run's blade forward like the stand's, it swung the blade 11 degrees a frame through
that detour; without it, 1.

PINS: `fb1026c_mwbody.test.js` ONE-RUN (the run's blade, its forearm, the arm low and out; the way between a stand and a
run); `bodymotion_carry.test.js`'s one-hander pin moved to the forward blade (Port-Doctrine: a deliberate change edits
its pin). Mutants ONE-RUN-the-old-row, ONE-RUN-out-to-the-side, ONE-RUN-twisted, ONE-RUN-via-back.

## BOW-AIM (3) - `src/combat/spineAim.js`

The reference is OpenMW's, as for every law of the Morrowind body (`02-Formats/Morrowind-Rules.md`): no departure.

THE LAW, PORTED WHOLE. `spinePitchFactor` is setPitchFactor (character.cpp:1868-1895): 0 unless a Ranged or Thrown
weapon is in its wind-up, release or follow (or a cast - the state above WeaponEquipped); eased in from "<type> start" to
"<type> min attack" (unless the group is a random attack), whole through the release, eased out over the follow - a
crossbow's in its first tenth. `applySpineAim` is configureControllers (weaponanimation.cpp:175-211): half of the
actor's pitch times the factor, about -X in the actor root's frame, on spine1 and then on spine2 - so the chest, the arms
and the bow carry the whole pitch, curved through two joints. The pitch is rot[0], + down; the port's look counts up, so
the body's pose hands it negated, as the first-person neck has it (`fpArm.js:"aim: cam?.pitch && upper > UPPER_BODY.WeaponEquipped ? spineAimSlot(-cam.pitch * spinePitchFactor({"` -
asked only while the look pitches and the upper body is past WeaponEquipped, so a peer's body at pitch 0 costs nothing).
poseAssembly runs the slot after the clip and the neck and before the body motion (`mwFirstPerson.js:"  assembly.aimFit = aim ? aim(skeleton, pose, GRAPH_ROOT, fns.skelMats) : null;"`),
which keeps the clip's chest while the clip has a bow's arms (Body-Motion.md, "The upper body is whoever has the arms"),
so the pitched chest is the one drawn. The first-person arm takes none (VM_FirstPerson attaches no spine controllers).

ROOT-TURN - THE CONJUGATION WAS OSG's LETTERS. RotateController's line, `worldOrient * mRotate * worldOrientInverse *
matrix.getRotate()` (rotatecontroller.cpp:41-60), is OSG's, and OSG multiplies row vectors: its matrices and its
quaternion product are the transposes of this port's (`mwNifMesh.js` composeTransform: a world is `parent * local`, a
point `M v`). The port had copied the letters - `W * R * W^T * local` - which turns the bone's world by R conjugated by
the bone's world twice over, not by R in the root's frame. In this port's convention the line is `local * W^T * R * W`
(`mwFirstPerson.js` rootSpaceTurn), and the world becomes `R * world`. Measured on the retail biped: a "look down" of 0.3
by the letters' copy tipped the chest BACK, about an axis up to 3 degrees off the root's X (the head drifting up to 0.74
units sideways); by the corrected line, exactly 0.3 forward about the root's X, the head 6.2 forward and 1.2 down.

The first-person neck (rule 30, MW-D10) used the same line, so it turns through the same helper now. Its pins were
written to the letters: MW-D20's fixture (a file root turned Rz90) expected the neck's local `W * Rx(-t) * W^T` = Ry(-t),
whose world is Rx(+t) * W - the look's pitch the other way about the root; the pin now holds the local Ry(t) and the
world Rx(-t) * W, worked by hand in its comment, and MW-D10's text pin names the corrected line. Players meet the neck's
law only with the first-person follow camera off (IG4: the shipped default hands the neck no pitch), where a look down
moved the eye back over retail's turned neck; IG6c's note that the law path "was STILL moving on Mac's retail data" is
consistent with it. That is recorded here, not claimed fixed in play: no retail data was in hand to see it.

NOT CHECKED HERE: the clip's own angle. The fix makes the bow follow the look; what angle Morrowind's BowAndArrow clip
holds the bow at for a level look needs Morrowind's own files, which are not in this container. A peer's body and a
townsperson's stand at pitch 0 (`net/peer/peerBodies.js`: the wire carries no look), so their drawn bows keep the clip's
own angle.

PINS: `test/combat/fb1026c_bowaim.test.js` - the factor's law case by case; the spine's turn on the retail biped (spine1
half, spine2 and everything above it the whole, exactly about the root's X, + down); the conjugation for four bones of
four frames; the slot's order and the body motion keeping the pitched chest; the wiring. `fparm.test.js` MW-D10 and
MW-D20, corrected. Mutants BOW-AIM-*.

## MW-SHOULDER (4) - `src/player/mwCamera.js`, `src/player/mwView.js`, `systems/features.js` 'mw-shoulder-camera'

The reference is OpenMW's viewOverShoulder (settings.lua:44, off by default), read in this session from OpenMW's own
tree (`files/data/scripts/omw/camera/third_person.lua`, `settings.lua`, `apps/openmw/mwrender/camera.cpp` - the same
revision mwCamera.js already cited: settings.lua:43 is maxDistance, third_person.lua:135-137 the flat distance).

THE OPTION. Over the Shoulder, in Settings' Camera section beside Eye Of The Beholder: Off (the default, vanilla's
centred camera, to the bit), Right or Left. The viewer's (how this machine frames its own body), never the wire. Its
words are routed (`features.mwShoulder.*`) and drafted in-session in every language (`tools/l10nInSession.mjs`).

THE LAW. The focal point - the head the camera turns about - is offset `[x, y]` in MW units, x along the actor's right
(camera.cpp:101-107; this port's right is the strafe's, (cos yaw, 0, -sin yaw), world/mat4.js's handedness law), y up:
- behind the chosen shoulder, [30, -10] (settings.lua:45-46), the left the right's mirror (third_person.lua:39-40);
- while a weapon or a spell is out, or the actor swims, centred and raised, [0, 15] (third_person.lua:27, :89-92). Raised,
  the crosshair stands over the head instead of on it, and a shot still lands where the crosshair says: every host
  looses the player's shot from the head along the look, as the reference's projectile leaves the actor
  (weaponanimation.cpp:111-114), so behind a shoulder its line would pass 30 units to the side of the crosshair's. That
  is the reference's own answer to the ranged aim the report asks about, and why it is kept.
- The offset eases between states (camera.cpp:247-294, verbatim: the carried speed, `dt * (1 + 5 / |delta|) * speed`),
  at 5 into and out of combat and 1 otherwise (third_person.lua:110-116), and lands at once on the frame third person
  begins or the option changes (:41, :153-156).
- A wall at the shoulder: camera.cpp:177-193's guard in full - a sphere of 10 swept from the actor's line, 10 under the
  focal point, to the offset focal point, which is left where the sphere touches. With no offset the vanilla clause is
  untouched.

NOT PORTED, NAMED (Port-Ledger A, MW-SHOULDER): with viewOverShoulder on, the reference also pulls the camera out as the
look rises and as the actor speeds up (third_person.lua:80-84, :152-161, zoomOutWhenMoveCoef 20). Here the option moves
the focal point and the distance stays the wheel's. Nor autoSwitchShoulder (settings.lua:47, off): the shoulder is the
player's. Nor a key to swap shoulders - Eye Of The Beholder's ShoulderSwitch answers only while that mod is on
(`systems/inputActions.js` MOD_ACTIONS).

THE FOUR HOSTS: none is edited. The camera's seam is `player/mwView.js` mwViewFrame, which reads the option and the
arm's stance (`fpArm.js:"    shoulderStance: () => (spellReady || !sheathed ? 'combat' : camera?.()?.move?.swimming ? 'swimming' : null),"`)
once a frame, and every host's frame already calls it with its own clock: `scenes/world.js` (the streaming world),
`scenes/exterior.js` (the fixed city), `scenes/worldModes.js` (interiors) and `scenes/dungeonContext.js` (dungeons, its
frame in `scenes/dungeon.js`). BOW-AIM likewise lives in the one rig every host's body is (`combat/fpArm.js`).

PINS: `test/player/fb1026c_shoulder.test.js` - the reference's numbers; the transition verbatim; the shoulder's state
(the shoulder, combat, the water, at once on entry and on the option's change); the offset in the frame (the strafe's
right, 10 down, the left the mirror, combat 15 over the head); the guard; off is the vanilla camera to the bit; the
wiring. `test/systems/features.test.js` (the row and the notes' budget, 205 chars). Mutants MW-SHOULDER-*.

## TWO-CLEAR (5) - `src/characters/bodyMotion/carry.js`, `melee.js`, `bodyMotion.js`

No DFU member (as THRUST-CHAMBER). The measure is the audit's own trunk (`bodymotion_audit.test.js` MELEE-1: the
pelvis-to-neck segment, 9 units round it, a sample under 3 in clear), read for BOTH arms - each elbow, wrist and the
middles of each upper arm and forearm - where the audit read the striking arm's hand and forearm alone. Before, on the
retail biped: the two-hander's guard 6.3 units in at rest, 4.5 walking, 5.5 sneaking (the left elbow); every two-hander
blow 6.5 to 8.5 standing or walking (the left wrist and forearm); the staff's and the spear's chop, slash and backhand 5.8
to 6.9 (the left upper arm, and the striking right upper arm in the backhand). One-handers, pairs and fists: 2.5 at most,
unchanged.

THE GUARD (`CARRY.two` idle, walk, sneak). Held by the right hip, the left hand - closed a third of an arm down the grip,
behind the right (`TWO_HAND_GRIP`) - reached across the body at the arm's full length, and the arm ran straight through
the chest; no elbow could take it out. The hands now stand before the belly, a little right of the middle (the left
0.26 of an arm before the shoulders; it stood 0.08), and the guard is still the low guard Mac's pin holds - the blade
forward and down (`bodymotion_carry.test.js`). The rows were fitted on the biped against CARRY-1's own limits: the wrists
34 to 38 degrees ulnar (under 40), the weapon over the ground and out of the thighs and the trunk, the left hand on its
haft. The left arm stands 0.2 to 0.4 units into the trunk's 9 - the upper arm against the ribs.

THE HAFT HAND'S ELBOW points out and forward of the chest, in the carry and in a blow (`carry.js` carryHands,
`bodyMotion.js` blowHands): it pointed back a fifth, and the blow's was a fixed way in the rig's frame that the chest's
turn left behind.

THE BLOWS (`MELEE.two` - the two-hander's, the staff's and the spear's, one table for three left hands: the pommel's
side for a two-hander, the point's for a staff and a spear). The hands LEAD. Each wind-up gathers the hilt in front first
- the chop raised before the face with its blade upright (keys at u 0.08 and 0.18), the slash swung out to the right
(0.12) and RAISED at the right shoulder (0.3: it was drawn back behind it), the backhand at the left shoulder (0.3: it
reached across behind it) - and each release passes its blade upright or across with the grip out before the face or
the chest (keys at 0.4). The chop, the slash and the backhand land two thirds of an arm out (0.68 to 0.73 along the
facing; 0.55 to 0.58 before, where the left hand on a claymore's grip stood in the chest); the thrust's chamber and
follow sit a little further out. The new keys take the trunk's channels (chest, hips, weight, step) from the old spline
at their u, so the body's wind is the one it was. Kept, each read on the biped: the blade under 48 degrees a frame (the
audit's 60), the grip meeting its target at 85 per cent of its top speed and more (MELEE-10's 75), a slash begun at a run
turning its blade 20 degrees a frame at most in its ease-in (MELEE-1's 25).

THE PAIR HELD BEFORE THE TRUNK. Where a blow's haft hand would close nearer the trunk's line than `TRUNK_CLEAR` (0.29 of
an arm: the audit's 9 units and a forearm), both hands go forward along the chest's way by as much as it takes
(`carry.js` trunkPush). The keys keep it near nothing: by their keys alone (`createBodyMotion({ trunkClear: 0 })`) every
blow of the three, standing and walking, stands under 2.5 units in. It holds what the keys cannot: a claymore blow begun
sneaking or at a run, or cut by the next, closed the left hand 0.2 to 3 units in by its keys alone; held before the trunk
it never enters it.

AFTER, as struck: every blow of the three, standing, walking and strafing, 2.1 units in at most; the guards 0.4 at most
(a spear's sneak 1.8, as it stood). Contact sheets: `node tools/bodyMotionSheet.mjs <dir> two two-chop two-slash
two-back two-thrust`.

NOT FIXED, NAMED. A staff's or a spear's blow begun AT A RUN: the run carries that left arm free (`CARRY.wide.run` and
`CARRY.spear.run`), and the blow's first three or four frames blend it onto the haft along the straight line between,
which passes through the body (the staff's backhand 6.8 units in, its thrust 5.8, the spear's thrust 3.0; 8.5, 6.3 and
3.5 before). The cure is the blend's - the hand carried round the trunk, not through it - and every class's arm takes
that blend. And a claymore's chop begun sneaking: 3.3, its left upper arm passing the throat, where the audit's trunk
is a 9-unit sphere about the neck joint, wider than a neck (8.2 before).

PINS: `test/characters/bodyMotion/fb1026c_mwbody.test.js` TWO-CLEAR - the guard (every class and gait under 3 in; the
two-hander's hands before the belly, its blade forward and down); every blow (each of the four, each class, standing,
walking and strafing, under 3 in - and by its keys alone; the two-hander's landing two thirds of an arm out); the pair
held before the trunk (the claymore's left wrist through every blow at every gait); the push's own law. Mutants
TWO-CLEAR-* (14), and two THRUST-CHAMBER records re-aimed by content to the moved wind-up key.
