# Enhanced AI: the navmesh

With the Enhanced AI switch on, foes in dungeons and buildings route on a navmesh baked from the level's own collision
triangles, instead of steering straight at their target and sliding along the first wall. The navmesh is Mac's, from
his project-final repository, ported whole. Everything else a foe does (senses, decisions, attacks, sounds) is the
classic motor's or `12-Enhanced-AI/Tactics-Arc.md`'s.

## How it works

**The motor** (`src/ai/enhancedMotor.js` `EnhancedEnemyAI extends EnemyAI`). The classic tick asks
`_getDestination`; the subclass answers with the next corner of a `findPath` route to the classic destination's own
target, and falls back to the classic answer whenever there is no bake, no route, or the classic detour is running.
A corner inside the stop distance is projected along its direction, so a foe never halts at a corner; a stopped foe
on its target faces the target. A route that cannot place its goal asks the host for the nearest mesh point
(`navGoal`) and walks the last leg straight in.

**The bake** (`src/ai/nav/navBake.js`). The collider's buckets hold every triangle the player collides with; the bake
reads them back, so the nav's ground and the game's are one source. `src/ai/triRaster.js` turns triangles into one box
per cell and span, walkable only within the agent's slope; `FLAT_EPS` keeps level floors. A soup bake keeps a 0.25 m
cell and erodes one ring (`SOUP_AGENT`). Unlocked action doors are left out of the soup (a foe opens them); locked
ones are walls. The mesh keeps every region holding an anchor: the player's feet and each foe's, landed within
`ANCHOR_Y_TOLERANCE` (0.6 m). Holes (pillars) are bridged into the outer contour, Recast's way.

**Off the frame** (`src/ai/nav/navWorker.js`, `src/ai/nav/navClient.js`). The worker bakes; the client fingerprints
the soup, asks IndexedDB, else the worker, and hydrates the compact heightfield the motor queries every tick on the
main thread. `NAV_BAKE_VERSION` (4) keys the cache. A worker that dies on a large soup does not fall back to a
main-thread bake; the classic motor stands.

**Dungeons** (`src/scenes/dungeonContext.js`). The host asks once the player's feet are known and hands the bake to
the motor as a thunk (`nav: () => enhancedNav.chf`), with `navGoal`. A foe built before the bake lands is classic
until it does.

**Buildings** (`src/scenes/interiorNav.js` `createInteriorNav`, mounted by `src/scenes/worldModes.js`). Both interior
pools (the building's foes and the watch called in) get the mesh. The bake is asked on need (the first frame a motor
reads it), not cached, and asked again when a door's lock changes or the hunted player stands off every island.
Anchors: the player's arrival, the room's ways in, each watchman's spot, and rings round the player's feet out to
`GOAL_REACH` (4 m).

**No route.** A watchman pursuing a crime whose feet stand on another island than the player's for `CUT_OFF_S` (2 s)
(a locked inner door, a ladder) is stood on the player's island at the nearest spot past what stopped him, never within
a metre of the player, and walks the rest (`EnhancedEnemyAI.standAt`). The building's own monsters route but are never
stood.

## Rules

- A custom navmesh for enemy AI, done exactly, called Enhanced AI, a Features row (Mac).
- The classic motor (`src/characters/enemy/enemyMotor.js`) is a verbatim port of DFU's and is never edited; the
  enhanced motor replaces only how a foe moves toward its target, and falls back to classic.
- Enhanced AI is on by default offline and forced on online (Mac); the classic motor is one switch away.
- `src/ai/nav/navmesh.js` is Mac's file, pinned by digest (`test/ai/nav/enhancedAI.test.js`). A body change is made
  in both repositories and re-recorded deliberately; changes made here first are owed to project-final.
- Triangles become his colliders, not his code: the voxelizer feeds his `addSpan`.

## Daggerfall Unity

DFU's `EnemyMotor` steers straight at the target with an obstacle probe and a detour; it has no navmesh. Departures:
routes on a baked mesh, and the cut-off watchman stood past a locked door (DFU's watch is stopped by the same wall).

## Code and tests

- `src/ai/enhancedMotor.js` - the motor
- `src/ai/nav/navmesh.js`, `src/ai/nav/navBake.js`, `src/ai/triRaster.js` - the mesh and the bake
- `src/ai/nav/navWorker.js`, `src/ai/nav/navClient.js` - worker and cache
- `src/scenes/interiorNav.js` - buildings
- `test/ai/nav/enhancedAI.test.js` - the digest, the voxelizer, holes, the soup bake
- `test/ai/nav/enhancedAI4.test.js` - the motor, the switch's readers
- `test/ai/nav/fb1016b_indoorwatch.test.js` - the watch indoors and no-route standing

## Open

- The streamed world's street pools (`src/scenes/world.js`, `src/scenes/exterior.js`) hand no mesh: the street's watch
  and foes walk the classic motor.
- Other foes as obstacles (`syncNavObstacles`) and RVO avoidance (`avoidHeading`) are ported but not called.
- Debug faces for looking at a bake are not wired.
