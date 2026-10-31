# The Player Body

How the player moves, collides and interacts: the motor, the capsule collider, activation, doors and transitions
between the world, buildings and dungeons, ladders and the classic climb, swimming, levitation, breath, crouch and
stealth, and the guards that keep the body from being trapped. The player meets it every moment of play. Enhanced
climbing is `Parkour-Arc.md`.

## How it works

- **The motor** (`src/player/motor.js`). Speed, gravity, jump and capsule dimensions are DFU's PlayerSpeedChanger,
  AcrobatMotor and PlayerAdvanced controller: 39.5 classic units a unit, walk base 150, crouch base 50. It steps at a
  fixed `FIXED_DT` (1/60 s) whatever the frame rate, so stairs and jumps behave the same at 10 fps as at 60; the camera
  interpolates between steps. Foes step on the same law.
- **The collider** (`src/player/collider.js`). Triangle soup in a uniform grid; the capsule resolved as a chain of
  spheres along its axis, so the waist is sampled. DFU's CharacterController contract: radius 0.35, height 1.8, step
  offset 0.5, slope limit 70. A floor is one-way for the body; stairs are descended, not fallen; a table is a wall; the
  capsule rests on a slope; a resolve that moved nothing stops early.
- **Activation** (`src/player/activate.js`). DFU's PlayerActivate: the ray reaches classic's farthest view distance and
  each target gates on its own activation distance (doors 128 classic units). Targets are world boxes; a moved action
  model's box moves with it; action doors join the collision-trigger pass. An armed Lock beats an armed Open.
- **Transitions** (`src/player/enterExit.js`). Entering a building lands at the interior door nearest the closest enter
  marker, pushed out along the door's normal; leaving reverses it. World to dungeon and back follow DFU's
  PlayerEnterExit; the first dungeon has a door out. Interiors are parented in the building's world frame.
- **Ladders and the classic climb** (`src/player/climbing.js`). Interior ladders, and DFU's ClimbingMotor classic path:
  hold Forward against a wall, pass the Climbing skill roll, crawl up, re-roll or slip.
- **Water and air.** Swimming, levitation and their fatigue drains; breath and drowning with refunds; crouch and its
  timed height change; the exterior swim speed and DFU's water-jump cancel; the Jump spell's mid-air control. A
  paralysed swimmer does not sink from encumbrance. Outdoor water exempts a fall.
- **Stealth.** Sneak (held) and Walk mode (latched, `src/player/walkMode.js`) feed foe detection as DFU's stealth does.
- **Body guards.** Late solids never close on the body: furniture, decor or a rock built after the body stands
  (`src/player/lateSolid.js`); a dungeon mover never closes on it (`src/player/moverBody.js`); the player is clamped out
  of trees, rocks and barrels by their bodies (`src/player/bodyClamp.js`, `src/world/propBodies.js`). A hanging sign
  stops a body only where it stands, a fence rail is no floor where no body stands, and a lift with no room is never
  taken. A body stuck in a mountain's rock is lifted out; a dungeon has a void failsafe.

## Rules

- The motor's constants, activation distances, door landings and the classic climb are DFU's, verbatim.
- One fixed physics step for the player and for foes.
- `CanStand` matches DFU's tolerance.
- Tamriel: the body reads geometry, never a place.

## Daggerfall Unity

The modules port `PlayerMotor`, `PlayerSpeedChanger`, `AcrobatMotor`, `PlayerActivate`, `PlayerEnterExit`,
`DaggerfallStaticDoors` and `ClimbingMotor`. The collider is the port's own engine-side stand-in for Unity's
CharacterController, holding to its contract. Departures: the body guards above, which DFU does not have (its movers
and late objects can trap a body), and Walk mode as a latched Sneak.

## Code and tests

- `src/player/motor.js`, `src/player/collider.js`, `src/player/activate.js`, `src/player/enterExit.js`,
  `src/player/climbing.js` - the core
- `src/player/lateSolid.js`, `src/player/moverBody.js`, `src/player/bodyClamp.js` - the body guards
- `test/player/audit64_motor.test.js`, `test/player/motorStairs.test.js`, `test/player/motorinterp.test.js`,
  `test/player/ph1_physics.test.js` - the motor and its step
- `test/player/activate.test.js`, `test/player/enterexit.test.js` - activation and transitions
- `test/player/climbing.test.js` - the classic climb
- `test/player/propbodies.test.js`, `test/player/unstuckout.test.js`, `test/player/fb1025i_railhang.test.js` - the
  body guards
