# Player-Arc (ACTIVE)

First-person play inside the assembled world: walk, collide, activate.

## Milestone P1 - grounded movement + collision (SHIPPED)

`src/player/motor.js`: verbatim PlayerSpeedChanger / AcrobatMotor /
PlayerAdvanced values - classicToUnitySpeedUnitRatio 39.5, dfWalkBase
150, dfCrouchBase 50; Walk = (SPD + 150) / 39.5, Run = walk * (1.35 +
Running / 200), Crouch and Sneak formulas; jump 4.5, gravity 20;
capsule 1.8 x 0.35, stepOffset 0.5, slopeLimit 70. EYE_HEIGHT 1.7 is a
documented presentation choice (prefab camera hierarchy ambiguous).
Stats default SPD 50 / Running 30 until Characters supplies the entity.
`src/player/collider.js` (engine-side, ours like the renderer):
triangle soup in an 8-unit grid per bucket, capsule as two spheres,
Ericson closest-point, slide + step-up retry + ground snap, buckets
carry a live translation provider so the streaming world registers
PIXEL-LOCAL triangles under the floating origin; heightAt callback is
the floor beneath everything. Two resolver defects were found by
numeric tracing and fixed: a stale local-point snapshot compounded
pushes 18x into a +5.4 launch (live recompute + per-query dedupe), and
the ground-snap probe tunneled under step tops (down-push contacts now
reject the snap and the step retry).
Scenes: walking is the DEFAULT in exterior and ?world (?fly restores
the fly cam; ?play forces walking under ?shot). Exterior registers all
placed models (Daggerfall city: 64,937 triangles) over the flat ground;
world buckets per pixel with bilinear heightAt over the stored samples,
unloads with the pixel, freezes the motor until the start pixel's
collider exists, and shifts the player with every recenter.
window.__player {pos, warp} joins the shot probes. Proofs: street
settle at y = -5e-8 on mesh geometry; three cross-pixel warps grounded
on live terrain (city flatten vs wilderness heights) while incidentally
exercising BOTH recenter axes (+819.2 shifts tracked); eye-level street
and wilderness shots. test/player.test.js pins formulas, ground/slide/
step, and gravity/jump integration.

Inputs already shipped for this arc:
- `src/world/staticDoors.js` - trigger volumes from MeshReader's
  ModelDoor extraction (runs on every model), openRotation helper.
- Dungeon action records (`rdbLayout.js`) - doors, levers, platforms with
  verbatim axes/magnitudes, waiting for an activation system.
- Streaming world camera (`?world`) - the fly camera to be replaced by a
  grounded controller.

## Milestone P2 - activation + dungeon action doors and chains (SHIPPED)

`src/player/activate.js`: verbatim PlayerActivate reach - RayDistance
3072 * GlobalScale (76.8, classic's farthest view distance), per-target
activation distance 128 * GlobalScale (3.2, Default/Door verbatim).
Picking is ours: world-AABB slab test per activatable, nearest in-reach
wins, occlusion rejected via a new grid-DDA collider.raycast
(Moller-Trumbore, both faces).
`src/world/actionSystem.js`, verbatim DaggerfallAction /
DaggerfallActionDoor: Move actions tween LINEARLY over duration / 20
seconds - self-space rotation (degrees; trs takes degrees, caught by
the unit pin when a double conversion slipped in) plus world
translation; End reverses on the next activation; Receive gates on
IsPlaying down the WHOLE chain while Play cascades to the linked object
FIRST; doors swing (0, -90, 0) over 1.5 s, ToggleDoor is a no-op while
moving. Collision lifecycle (ours): a door's bucket vanishes the moment
opening starts and returns only at close-COMPLETE (DFU's MakeTrigger
call sites); moving action objects rebuild their bucket every frame -
standing collision is correct at every instant, platform RIDING
(velocity inheritance) is a later milestone. Non-movement action flags
(CastSpell, Hurt, Teleport, text, locks) route to their arcs via the
flag table; the dungeon runtime executes the movement family.
Dungeon scene: walking + E-activation (KeyE edge), 62 activatables in
Privateer's Hold over an 8406-triangle collider; dynamic draws compose
base x tween each frame. In-engine cycle proof: closed door rayed at
2.15, activate -> passage clear DURING the swing (trigger-at-open-start
verbatim), state end, re-activate -> reverse; tween timing pinned
deterministically in test/action.test.js (headless SwiftShader runs
~7 fps - see Testing.md).

## Milestone P3 - building interior transitions (SHIPPED)

Walk up to any building door in ?world, press E, and you are inside;
E on an interior door puts you back on the street. Verbatim
PlayerEnterExit landings (`src/player/enterExit.js`): entering checks
the exterior door's world position, snaps to the closest interior
ENTER marker, and lands at the closest INTERIOR static door + its
normal * (radius + 0.4) = 0.75, with the marker + up * (height * 0.6)
= 1.08 fallback; exiting lands at the closest exterior sibling door +
normal * (radius * 3) = 1.05. Static-door geometry rides the mesh
convention end to end - meshReader stores door plane verts scaled and
Y-negated, so world position/normal are the placement matrix alone.
`src/scenes/interiorContext.js` builds one interior against a HOST
scene's caches (layout, climate swaps with the missing-record prune,
flat batches, verbatim 210-flat lights, a fresh record-local Collider,
enter markers + interior doors) and returns a destroyable context -
the standalone interior scene folds onto it in a later pass.
World scene: building placements register their static doors
pixel-local (rmbLayout now carries the building recordIndex); E picks
via the activation ray with live floating-origin translations; the
frame pipeline swaps whole - interior ambient/fog/point lights and the
interior collider - and the early return freezes streaming so the
interior-local player position never feeds the recenter. Exit uses the
HIT interior door against all sibling exterior doors. In-engine proof:
enter lands at the interior door (6 draws / 4 doors / 3 lights pinned
in the console), the return trip lands exactly 1.05 from a sibling
door. test/enterexit.test.js pins the offsets, transforms, and
landing selection.

## Milestone P4 - interior swing doors (SHIPPED)

The audit's sealed-rooms finding closed: blockDoorRecords now run on
the P2 ActionSystem inside interiorContext (verbatim -90 / 1.5 s
toggle, trigger-at-open-start, solid-at-close-complete), drawn live
with the interior's texRemap. The interior E ray targets exit doors
and swing doors together - swing doors via their live matrices -
nearest wins. Probes __interiorActions / __interiorActivate /
__interiorRay mirror the dungeon set. In-engine proof (BOOKAL02:0,
4 swing doors): the ray along the door's facing axis reads 1.33
closed, the swing completes to end, and the same ray reads 4.53 -
through the doorway into the next room. Duplicate __exit hook from
the P3 reconciliation removed.

## Milestone P5 - world <-> dungeon transitions (SHIPPED)

E on a DUNGEON_ENTRANCE-type static door drops you into the location's
RDB crawl; E on the dungeon's exit door puts you back outside the
entrance. Verbatim: entering lands at the start marker + up * (height
* 0.6) = 1.08 (MovePlayerToMarker); exiting lands at the LOWEST
dungeon-entrance door + normal * (radius + 0.1) = 0.45 with the camera
facing the door normal (PositionPlayerToDungeonExit +
SetHorizontalFacing) - `dungeonEntranceLanding` in enterExit.js, pinned
in tests. `src/scenes/dungeonContext.js` builds the whole dungeon
against the host's caches: layout with the classic per-dungeon texture
table applied as a DRAW-TIME texRemap (the shared mesh cache serves
exteriors and stays untouched; UVs keep original-archive sizes, pixels
come from the table - the dungeon convention already on record),
movement actions + swing doors on the ActionSystem, RDB lights with
the flicker animator, water quads with the climate ground tile
(uploaded at enter - the exterior tilemap path never routes single
records), flats at raw-pivot centering, a fresh collider, the start
marker and exit doors. World routing keys on the verbatim door type;
the door registry now covers ALL models with doors (dungeon entrances
live on misc models without a building record). In-engine proof at
Privateer's Hold entered FROM the streaming world: 303 draws / 1 exit
door / 71 lights / 8406 tris / 62 action objects (standalone-scene
parity), and the return trip lands with XZ error 0.000 against
entrance + normal * 0.45.

## Milestone P6 - interior ladders (SHIPPED)

Verbatim DaggerfallLadder.ClimbLadder (interior-only upstream, model
41409): closest LadderTop / LadderBottom markers (types 22 / 21);
below the top teleports TO the top, else above the bottom teleports to
the bottom - `climbLadder` in enterExit.js, unit-pinned. TWO frame
constants were dug out by numeric measurement of a real tavern loft:
the comparison runs against DFU's STANDING position, floor + height *
0.65 = 1.17 (PlayerMotor.FixStanding repositions to hit + up * 0.65h,
NOT the geometric half-height - at BOOKAL02:3 the loft check reads
2.13 + 1.17 = 3.30 vs marker 3.23, which is the whole ballgame), and
the teleport lands just ABOVE the marker so gravity re-floors it
(FixStanding's contract; landing 0.9 under the marker tunneled through
the loft boards). PICKER FIX benefiting every activatable: an occluder
hit that lies INSIDE the target's own AABB (+0.15 skin) no longer
vetoes the pick - thin/diagonal meshes like ladders sit well inside
their box, so their own surface legitimately lands nearer than the
AABB entry. interiorContext exposes ladder placements; the interior E
ray targets doors, swing doors, and ladders together. In-engine proof
(BOOKAL02:3): ground 0 -> E -> standing ON the ladder head at the top
marker 3.23 -> E from beside the hatch -> bottom marker 0, exact.
Registry probe __doors uncapped; __markers / __ladders /
__pickInterior probes added.

P7 audit: gates green (137/23) and every parity pin re-verified. Four
findings, all fixed at root - a dead lightDir block left in world.js
by the P7a cut (531 lines now), a dead DUNGEON_AMBIENT import in
dungeonContext (hosts own lighting), the interior/dungeon directional
inlined in THREE places (single-sourced as INTERIOR_LIGHT_DIR in
interiorLights.js; interior shot stays byte-identical), and two
Ledger C rows still routing features R6-R8 shipped (interior 210
point lights; dungeon water + lights) - pruned.

## Milestone P7b - exterior scene hosts the transition machine (SHIPPED)

The exterior location scene mirrors ?world: E on a building door
enters its interior, E on a DUNGEON_ENTRANCE door drops into the
location's crawl, exits land verbatim - the same worldModes machine
behind the same host contract. The lazy mesh loader queue 7 called
for is the shared dataPipeline, PREWARMED for the location's models
so boot behavior is unchanged while transitions lazy-load everything
beyond the location's own set; the climate-swap table builds from
gpu.subMeshes exactly as the world's per-pixel pass. Static doors
register at block assembly in the world's registry shape - matrices
already world-space, so entries feed the machine unshifted (group
'loc'). Boot pin and the noon shot are BYTE-IDENTICAL to pre-P7b
(255 textures / 202 meshes / 52 swaps exact; pixel diff 0). In-engine
proof: WALLAA02:0 interior enter/exit and the CUSTAA05 dungeon
entrance round-trip (1011 draws - the same context the world route
builds). Completing the fold surfaced one stale edge: the
flat-archive pass still constructed TextureFile directly after its
imports were removed - now routed through pipeline.getTexture.

## Milestone P7c - standalone scenes fold onto their contexts (SHIPPED)

dungeon.js (340 -> 203) and interior.js (226 -> 133) no longer carry
their own build paths: each loads data, spins the shared dataPipeline,
and calls its context builder - the EXACT build the world/exterior
hosts use for transitions. The dungeon's texture table therefore runs
as a draw-time texRemap here too (the convention on record since P5);
walking + E-activation and every shot probe survive unchanged, and the
scenes keep their own frame loops (fly speeds, far planes, water
draw). Contexts additively expose the pin counts the standalone logs
need (flatCount; blockCount + textureTable). Parity: the interior shot
(MAGEAA00.RMB:0) is byte-identical to pre-fold (pixel diff 0, pin
78/18/18/38/1/7 swaps/17 lights exact); the dungeon pin reproduces the
P5 record exactly - 5 blocks, 303 draws, table [23,22,19,22,20,368],
start (28.375, 38.975, 12.4), 71 lights, 8406 collider tris, 62
activatables. One boot defect caught by the shot gate: interior deps
passed the pipeline WITHOUT the renderer (contexts destructure both).

Queue (items 1-6 shipped):
1. DONE - grounded movement + gravity + collision (P1).
2. DONE - activation ray + dungeon action doors/chains (P2).
3. DONE - building interior transitions in ?world (P3).
4. DONE - interior swing doors on the ActionSystem (P4).
5. DONE - world <-> dungeon transitions (P5).
6. DONE - interior ladders (P6).
7. DONE - exterior hosts the machine over the prewarmed pipeline
   (P7b); standalone dungeon/interior fold onto their contexts (P7c).
8. Parent interiors in the building world frame - multi-door exit
   selection picks by true world proximity and coordinates go
   seamless.
9. DONE (P7) - the mode machines extracted to scenes/worldModes.js
   and the lazy texture/mesh caches to scenes/dataPipeline.js;
   world.js is 531 lines against the 900 ceiling (P7 audit).
