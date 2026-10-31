# Enhanced Climbing

A parkour-like climbing system after Assassin's Creed and Dying Light: catch a ledge and mantle, clamber over thin tops,
vault low ones, hang and shimmy, free-climb sheer walls on grip, drop from roofs into a hang, and leap from ledge to
ledge. The player meets it on the enhanced lane anywhere there is a wall: town roofs, city walls, dungeons.

## How it works

- **The ledge sensor and moves** (`src/player/parkour.js`). The motor consults it only when its host hands `parkour`
  deps whose switch answers yes (`src/scenes/shared.js` `parkourSwitchOn`). A lip within reach of the hands is
  mantled (Jump pressed on the ground, Jump held in the air, or the classic climb arriving under one), ending standing on
  the top, in the middle of a narrow one, or crouched where only a crouch fits. A top too thin to stand on (a parapet,
  a rail, a fence) is clambered over. A lip at waist height or lower whose top ends within a stride is vaulted while
  moving forward.
- **The hang.** A catch becomes a hang: shimmy along the lip and round its corners, drop with Crouch, climb up with
  Forward. Grip costs Fatigue; encumbrance cuts the reach.
- **Free climb.** A wall with no ledge in reach stays climbable on grip, draining Fatigue instead of the classic roll;
  the climb tops out in a mantle.
- **The way down.** Over a parapet into a hang, or crouched off an edge into a hang.
- **Leaps.** From a hang: up, sideways and back off the wall; a wall run-up; a running jump off an edge caught at the
  far side. Leaps have their own longer, flatter arc scaled by Jumping. The plain jump is unchanged.
- **The feel** (`src/player/climb/climbFeel.js`, `climbSounds.js`, `climbPose.js`). The camera's dip, sway and rhythm,
  the sounds, and the hands off the weapon onto the wall, on the wall in the world and not stuck to the screen. One
  pair of arms is drawn when a spell is readied.
- **Seen by others.** The climb rides the wire; peers face the wall and are heard climbing; the player's own third-person
  body faces the wall, the Morrowind body included.
- **Real geometry.** The sensor handles Daggerfall's eaves and roof pitches, dungeon jambs, seams and cracks, and the
  city wall's knife-edge coping, so a city wall can be climbed over.
- **Cost.** A capsule resolve that moved nothing stops early.

## Rules

- A proper, detailed climbing system: latch, mantle, jump from one ledge to another (Mac). Mac's four calls:
  - Jump is the grab: Jump near a ledge catches or mantles, Jump held keeps catching in the air, Forward climbs up,
    Crouch drops. No new key.
  - Skill scales it: Climbing and Jumping set reach, speed, grip time and whether a hard catch holds; no move is gated.
  - Sheer walls free-climb on grip.
  - Parkour leaps, scaled by Jumping.
- Enhanced lane only, behind the Features row `enhanced-climbing`, on by default and on for everyone online, so nobody
  crosses a rooftop a way another cannot. The classic climb is untouched.
- Players must never get stuck on roof tops (Mac).
- Tamriel: the sensor reads geometry, never a place, so it climbs every province's walls and roofs.

## Daggerfall Unity

`src/player/climbing.js` is DFU's `ClimbingMotor` classic path, ported whole: hold Forward against a wall, pass a
skill roll, crawl up, re-roll or slip. It has no idea what a ledge is. DFU's `AdvancedClimbing` (hang, rappel, corner
wraps) is not ported. Enhanced climbing is the port's own departure (ENHANCED CLIMBING).

## Code and tests

- `src/player/parkour.js` - sensor, mantle, clamber, vault, hang, leaps
- `src/player/climbing.js` - DFU's classic climb
- `src/player/climb/` - feel, sounds and pose
- `test/player/climbing.test.js`, `test/player/climb2.test.js`, `test/player/climb3.test.js`,
  `test/player/climb4.test.js` - the moves, leaps and feel
- `test/player/climbdown.test.js`, `test/player/climbfield.test.js`, `test/player/climbcrest.test.js`,
  `test/player/climb_top.test.js` - the way down, real roofs, city walls
- `test/player/climb/climb6.test.js`, `test/player/climb/climbhands.test.js` - the Morrowind body and the hands
- `test/player/climbperf.test.js` - the resolve's early stop

## Open

- The real-geometry suite (`test/world/climbreal.test.js`) has not been run end to end, and the climb has not been looked
  at in a browser on a real town or on the Morrowind body.
