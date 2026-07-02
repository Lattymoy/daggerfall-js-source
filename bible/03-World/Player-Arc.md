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

Queue (items 1-3 shipped):
1. DONE - grounded movement + gravity + collision (P1).
2. DONE - activation ray + dungeon action doors/chains (P2).
3. DONE - building interior transitions in ?world (P3).
4. Exterior scene mirrors the P3 machine (needs a lazy mesh loader);
   dungeon exitDoors transitions; ladders.
5. Parent interiors in the building world frame - multi-door exit
   selection picks by true world proximity and coordinates go
   seamless; the standalone interior scene folds onto interiorContext.
