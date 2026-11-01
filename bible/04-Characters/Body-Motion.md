# Body Motion

A layer over Morrowind's own clips that gives the third-person Morrowind body its own walk and run, a carry per
weapon class, and full-body melee blows. The player sees it on their own body, other players' and every person
standing in a Morrowind body. It is a Settings row, Morrowind Body Motion, under Combat > With Morrowind data, on by
default.

## How it works

- **One instance per rig** (`createBodyMotion`, `src/characters/bodyMotion/bodyMotion.js`): the player's, each
  peer's, each NPC's. Each frame `step` reads the rig's word (`motionWord`: movement, view, skeleton family, weapon,
  hands mode, torch, spell, blow section) and `apply` poses through the `motion` slot of `poseAssembly`
  (`src/formats/morrowind/mwFirstPerson.js`), after the clip's sample and under the run, climb, seat and saddle.
- **The body, measured** (`bodyOf`, `src/characters/bodyMotion/bodyKit.js`): each skeleton is read once off its rest
  pose (bone lengths, hip and shoulder widths, ankle height, foot axes). Every request is a share of the body's own
  leg or arm, so male, female, beast and every race scale take the same request. `bodyKindOf` names the family from
  the skeleton path; anything else (a werewolf, a creature) is left to its clips.
- **The gait** (`src/characters/bodyMotion/gait.js`): stride length by Alexander's relation (`strideLength`), duty
  factor falling with speed (`dutyFactor`), a foot set down in the world and held where it struck, hips planned from
  the stance, a chest that counter-turns and banks into a turn. The legs walk the ground the body actually crossed
  (the motor's `travelAt` for the player, the drawn feet for a peer), never the keys' speed.
- **The carry** (`src/characters/bodyMotion/carry.js`): `carryClassOf` maps the hand's state to a class; `CARRY`
  holds each arm's row for idle, walk, run and sneak, blended by gait share and followed by a damped spring. Rows are
  anatomical (shoulder flexion, abduction, twist, elbow bend) and kept inside the arm's ranges and out of the trunk.
  Two-handed weapons put the left hand on the haft (`TWO_HAND_GRIP`, `TWO_HAND_HAFT`).
- **The blows** (`src/characters/bodyMotion/melee.js`): the clip machine's three blow sections (wind-up, release,
  follow-through) drive a choreography clock (`blowU`, `U`), so the blade meets the target on the frame Daggerfall
  deals damage. The blow's strength scales the body's wind (`windFor`). `MELEE` holds each family's keys.
- **The solve** (`solveBody`, `src/characters/bodyMotion/bodySolve.js`): legs and arms reach their requests; ankles
  stay inside `ANKLE`.

## Rules

- The clips still decide every animation group. The layer steps aside, easing out and in (`MOTION_EASE`), for death,
  recoil, climb, seat, saddle, jump, water and levitation (whole body); for a draw, sheathe, spell, bow, crossbow,
  thrown weapon or long gun (arms); and for a torch or a shield on the left arm.
- Whoever has the arms has the upper body: while the clip holds both arms, the chest, neck and collarbones are the
  clip's too. The fingers are always the clip's.
- Every table (`GAIT_STYLES`, `BODY_STYLES`, `STAND`, `STEER`, `TURN`, `CARRY`, `MELEE`, `BLOW_TRUNK`, `TRUNK_CLEAR`,
  `ANKLE`, `SLOPE`) is one frozen row, tuned against the retail biped.
- As detailed as possible, no band-aids: running and walking for all races, a gait per weapon class, and improved
  third-person blows (Mac).
- The switch (`mwBodyMotion`, `mw-body-motion` in `src/systems/features.js`) is the viewer's: it changes how this
  machine draws a body, never the wire. Off, the body plays Morrowind's clips exactly.

## Daggerfall Unity

DFU has no third-person body (its people are billboards), so the reference is Morrowind's clips and OpenMW's
character controller. Departures from them, with the switch on and a `base_anim` skeleton:

- Legs, trunk, carry and a blow's body are the layer's, not the clips'.
- The layer eases between states, where the clips switch outright.
- The legs keep walking under a blow (Morrowind plays the attack clip on the whole skeleton).
- The legs walk the ground crossed, not the clip's cadence: Daggerfall's walk is far faster than Morrowind's walk
  clip, which slides its feet when played fast.

## Code and tests

- `src/characters/bodyMotion/` - `bodyMotion.js`, `bodyKit.js`, `gait.js`, `carry.js`, `melee.js`, `bodySolve.js`
- `src/combat/fpArm.js` - the rig that hosts the layer
- `test/characters/bodyMotion/` - gait, run, carry, steadiness, claims, audit
- `test/fixtures/mw/retailRig.mjs` - the retail biped the poses are tuned on
- `tools/bodyMotionSheet.mjs` - contact sheets of the skeleton from five sides

## Open

- Tuned on our own biped (`tools/ownBiped.mjs`) only, never on the female or beast rest, a skinned body or the retail
  clips: how it reads on Morrowind's own bodies waits for Mac's eye on his data.
- The solve turns each arm bone by the least rotation, so a forearm's roll stays the clip's and the wrist takes the
  turn, which a skinned wrist shows (the two-hander's haft hand at a run turns past the forearm's range). The fix is to
  share the turn along the forearm; it moves every arm and waits for a skinned check.
