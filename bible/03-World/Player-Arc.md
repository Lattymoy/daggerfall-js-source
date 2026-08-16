# Player-Arc (COMPLETE)

## Post-arc fixes (Mac playtest, 2026-07-06)

3. **Exit crash (production stack via the crash overlay).** frame()'s
   E-handling ran tryExit, which destroys interiorCtx and flips the
   mode - then the SAME frame fell into the interior render and read
   `.lights` of null, killing the loop ("game crashed on leaving
   exterior"). Dungeon exits shared the flaw. The __exit shot probes
   call tryExit OUTSIDE the frame loop, so P3/P8 verification never
   exercised the in-frame path. Fix: a successful exit ends the modal
   frame (`if (mode === 'exterior') return true`); the host resumes
   next frame. Minified-stack workflow pinned: rebuild the deployed
   commit locally, slice the bundle at line:col.
4. **Drop-in on entry.** DFU ends every transition with FixStanding's
   instant raycast floor snap; the port spawned at the raw landing
   (door-centre height / marker + 1.08) and let gravity floor it - a
   visible ~1u drop. floorLanding() (enterExit.js) is the verbatim
   counterpart: cast down from landing + 0.2, snap feet to the hit,
   landing unchanged on no hit (gravity fallback). Applied to
   interior entry AND the dungeon spawn; ladder teleports keep their
   verified gravity-floor (thin-board tunneling note stands).

Two root causes from the first production playtest:

1. **A/D inverted (all scenes + motor).** lookAt's camera-right is
   up x back = (-cos yaw, 0, sin yaw); the motor's strafe basis and
   all four fly-cam right vectors used the NEGATION (+cos, -sin), so
   D moved screen-left since P1. Fixed at the basis (motor.js +
   dungeon/exterior/interior/world fly branches); billboard camRight
   untouched (render convention, coupled to the shader, pixel-
   verified). Test pins strafe fully along camera-right at 4 yaws.
2. **Wall-laddering / ceiling escape ("teleport inside").** The
   collider's step-up retry accepted jitter-gained raised positions
   (`retrySq > movedSq`) every frame against a flat wall - pressing
   into any facade climbed it (headless repro: walk into a 3-high
   wall, maxY reached 3.0; jump+press escaped through a 2.2 ceiling
   into the shell) - the doorjamb form of the same ladder is the
   "walking through doors bugs out" report. Fix: the raised path must
   be GENUINELY clear (`retrySq >= wantedSq * 0.25`, the same blocked
   threshold the plain move failed) - a real step clears the raised
   sweep outright, a wall blocks it at +0.5 exactly as at 0. Step
   test unchanged; wall-ladder regression test added (900 frames of
   run+jump pressure, height capped at stepOffset).


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

P8 audit: the exit's closest-door check now compares DFU's
transform.position VERBATIM - the controller STANDING at floor +
height * 0.65 (+1.17, the same FixStanding constant P6 established),
not the feet; the WALLAA02 four-door proof reproduces exactly (sibling
error 0.000 / far door 8.27). The composition gap in the P8 proof is
closed: an in-mode interior frame at world coordinates was captured
and eyeballed (MAGEAA08:0, 54 draws / 11 lights - geometry, flats,
and point lights all present; billboard batches confirmed safe at
world coords via the renderer's ZERO_ORIGIN default over world-baked
centers). Import scan and block-local drift sweep clean; no stray
probes in the tree.

## Milestone P8 - interiors parented in the building world frame (SHIPPED)

Verbatim PlayerEnterExit.TransitionInterior: the interior is positioned
at ownerPosition + buildingMatrix - in our terms the entered building
model's WORLD matrix, which is exactly what every door registry entry
already carries. buildInteriorContext takes an optional origin and
parents EVERYTHING through it (placement/action-door/ladder/static-door
matrices, marker/flat/light positions, the collider); standalone
callers omit it (identity - the MAGEAA00 shot stays byte-identical).
With one coordinate frame, the landing math becomes what DFU's
comments promise: interiorLanding checks the exterior door's world
position against world markers/doors, and the exit is verbatim
BuildingTransitionExteriorLogic - FindClosestDoor(player.position)
among the siblings, landing at normal * radius*3. In-engine proof on
BOTH hosts (?world and the exterior scene), WALLAA02.RMB:0 (4 sibling
doors): exit beside sibling B lands at B + 1.05 with error 0.000
(door A 8.27 away - true world proximity), and entering is
coordinate-SEAMLESS (2.41 world units traversed through the plane, no
cross-frame teleport). Queue 8 closed - the arc queue is empty.

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
8. DONE - interiors parented at the building world matrix; landings
   in one frame (P8).
9. DONE (P7) - the mode machines extracted to scenes/worldModes.js
   and the lazy texture/mesh caches to scenes/dataPipeline.js;
   world.js is 531 lines against the 900 ceiling (P7 audit).

---

## P9 (live-play hardening): SHIPPED

The deployed build finally got PLAYED (against real ARENA2 on Mac's
machine, which the container cannot reach). A run of live bugs
surfaced that the unit gate is structurally blind to - scene loops
over build parameters, unbound identifiers vite emits as globals,
browser pointer-lock semantics, and the collision behaviour of real
dungeon geometry. All are fixed and rooted; the durable record:

### Boot / build crashes (were silent black screens)
- **S2 blocks binding** (b50101f): the treasure loop iterated the
  raw BlocksFile READER parameter, not `dungeon.blocks`. Field names
  matched the wrong shape so every gate passed; it black-screened
  only WITH data. Fixed to `dungeon.blocks`. (Recorded in full in
  Systems-Arc S2.)
- **Phantom identifiers** (3c9120f): `trs` was called unimported in
  characterSprite.js since C8 E3d - vite emitted it as a presumed
  global, so node --check / build / tests all passed while the FIRST
  real viewmodel frame threw. CLASS CLOSED: eslint flat config with
  `no-undef` now runs FIRST in `npm run check`. Swept + rooted trs,
  FLASH_TYPE_KEY (unexported), and quadInto (phantom for the file's
  life). One live-tested module (draped.js) was misread as an orphan
  and git-rm'd; the suite caught it same run and it was restored.
- **Unguarded foe build** (1fefb89): the entire `?foes` block in
  buildDungeonContext (dynamic imports, BODY00I0 fetch, the per-foe
  CLASS-enemy loop) was unguarded on the awaited build path, so one
  bad enemy (missing CLASS*.CFG, a rig/equipment error) rejected the
  WHOLE build and the dungeon never rendered - and it armed ONLY
  with `?foes`. Now the per-foe build is wrapped (one enemy fails ->
  logged + skipped) and the foe-subsystem init is wrapped (degrade
  to a playable foe-less dungeon), both loud.

### Spawn placement (were "stuck in a hole")
- **Eye-at-marker** (466690d): the standalone `?dungeon` host set
  cam.pos to the RAW start marker (a floor point), so the eye was at
  the floor and the feet ~1.5 below it, wedged. `ctx.startSpawn()`
  now owns the verbatim MovePlayerToMarker placement (marker + up *
  height*0.6 = +1.08, then floorLanding) ONCE; both hosts consume
  it, the worldModes inline copy died.
- **Movement under the overlay** (823605b): both hosts ran live
  movement while the chargen overlay captured typing, so a name with
  w/a/s/d walked the player off the start ledge during creation.
  Overlays now HOLD the world everywhere (the standalone gates
  actions.update + both movement branches on uiOverlayActive; the
  world/exterior shells gate on modes.dungeonCtx.uiOverlayActive).
- **Wrong marker** (1266f6a): startSpawn used StartMarker (RDB flat
  record 10) unconditionally, but DFU StartDungeonInterior with
  preferEnterMarker=true uses the EnterMarker (record 8, the
  entrance vestibule). Now prefers enterMarker with startMarker
  fallback, verbatim.
- **Single-ray floorLanding** (ed26d1f): floorLanding cast ONE
  downward ray from the marker's exact x,z; over a floor seam / grate
  / tile-edge it MISSED and returned the raw airborne position, so
  the player free-fell and wedged on a lower ledge. Now samples the
  capsule FOOTPRINT (centre + a ring at ~half radius) and takes the
  highest floor any sample hits - matched to PlayerEnterExit
  SetStanding (PEE.cs 1240-54, snap to a down-ray hit). A genuine
  void still returns raw for gravity.

### Look / input
- **Bare requestPointerLock** (64f0268): `canvas.requestPointerLock()`
  was called bare in all four hosts. Modern Chrome returns a Promise
  that REJECTS (unfocused, pending, or the post-Escape cooldown); the
  unhandled rejection surfaced as a crash overlay (`sh/<` =
  bootDungeon) AND left look disengaged (lock:N, mouse events
  arriving, yaw frozen) - one cause, both symptoms. A single
  src/player/pointerLock.js `requestLook` helper swallows the
  rejection, tolerates the void API, survives a sync throw, and binds
  one pointerlockerror log; all four hosts route through it. Pinned
  (3 tests) never to throw. The CLICK TO LOOK centre-screen hint
  (e5f5278) covers a dropped lock so the player is never stranded.

### Collision
- **g:0 knife-edge** (66fc16d): feet placed dead on the floor put the
  lower sphere centre at exactly floor+radius, on the boundary of the
  `d2 >= radius*radius` reject, so grounding flickered off at rest.
  Contact detection now reaches radius+SKIN (0.37) while the push-out
  still fires only within radius - a resting floor a hair away holds
  the player up, the body never sinks. Regression pinned.
- **SKIN-shell phantom flags** (b9fb8d6): the g:0 change let
  ceiling/pushedDown be set for NON-TOUCHING triangles in the
  radius..radius+SKIN shell. Those are movement-gate flags (step-up
  and ground-snap reject when pushedDown is set), so a tread/riser
  edge merely NEAR the capsule phantom-blocked the step-up on stairs
  and the player fell through going up. GROUNDING may use the shell
  (the g:0 fix preserved); ceiling/pushedDown now fire ONLY on real
  contact (d < radius). Rule: a tolerance shell must never feed a
  logic gate that assumes real contact - separate "am I resting on
  something" from "am I blocked/pushed".

### The FP viewmodel (the "hole" itself)
- **Camera inside the body** (f7492f5, d7843d2): the ACTUAL cause of
  the persistent "stuck in a hole". The FP viewmodel renders the
  player's OWN full-body rig; the mini-camera sat at eye height 1.7,
  INSIDE the 1.8-tall body, and tracked world pitch - so pitching up
  looked into the torso from beneath and the full-screen overlay
  filled with the body's black underside (Mac identified it: "maybe
  the voxel character is what I am stuck inside of"). Now the camera
  does NOT apply world pitch (per the anims.js FP law "the camera
  rides the head - lean pitches the EYE") and the rig is pushed back
  along the view dir so the head/torso clear the lens and only the
  raised forearm/weapon of the fpMelee1H pose reaches into the lower
  frame. Framing constants (back 0.45, downcast -0.12) are reasoned
  from the geometry but tuned without ARENA2 - open to nudging.

### Diagnostics shipped (kept in the code)
- **F8 debug HUD** (4fe1ec1, e5f5278, fe215d5): an on-screen readout
  (classic font, top-left) toggled by F8 - build tag, feet, enter +
  start markers, overlay/chargenDone, pointer-lock state, career,
  hp/mp, motor (grounded/velY/yaw), raw mouse (dx/dy/lock), and raw
  input (active keys, live pitch). This is the instrument that
  finally cracked the real bugs; it stays.
- **Per-commit build tag**: scripts/buildTag.mjs stamps
  `git rev-parse --short HEAD` into src/buildTag.js on prebuild, so a
  screenshot self-identifies its bundle and stale-cache ambiguity
  dies.
- **`[spawn]` console line**: marker -> feet on every dungeon boot.

### Systems live-path hardening (post-arc audit)
Applying the session's lesson to the shipped systems S1-S12 before
extending. Audit finding: 9 of 10 systems are PURE COMPUTATION over
frozen tables (loot, inventory, containers, chargen, advancement,
skills, effects, spellcast, spellcost) - they cannot crash the
awaited build the way the foe path did (which failed on fetches +
rig construction). The treasure loop's generateItems call, though on
the build path, is safe: unknown loot keys fall back to '-' and the
roll never dereferences undefined. The one I/O system, save.js, had
the real gap: writeQuicksave's localStorage.setItem was UNGUARDED and
throws on real browsers (QuotaExceededError when full, SecurityError
in private mode) - the same unguarded-browser-API class as the bare
requestPointerLock crash, and it would kill the frame on F9. Now
guarded (returns false), the F9 handler reports "save failed" instead
of going silent or crashing, and the throwing-storage case is pinned.
A sweep of the scene/input paths found no other unguarded throwing
browser API (indexedDB.open uses the async onerror pattern correctly;
pointer lock was already fixed). Systems are live-path-safe.

### Systems hardening pass (post-arc audit)
Applying the live-path lesson to the shipped systems S1-S12 BEFORE
extending. Findings, honestly categorized:
- **9 of 10 systems are pure computation** (loot, inventory,
  containers, chargen, advancement, skills, effects, spellcast,
  spellcost) - no fetch, no DOM, no construction - so they CANNOT
  crash the build the way the foe path did. generateItems in
  particular was checked at its build-loop call site (the S2 treasure
  loop): unknown loot key falls back to '-', and the roll walks only
  frozen ITEM_GROUPS, so it does not throw on real data. The crash
  risk is specific to I/O-or-construction, not computation.
- **save.js was the one I/O system, and had the gap**:
  writeQuicksave's `setItem` was UNGUARDED. localStorage.setItem
  throws on real browsers (QuotaExceededError when full, SecurityError
  under private-browsing) - the same unguarded-browser-API class as
  the bare requestPointerLock crash, and it would propagate through
  the F9 handler and kill the frame. readQuicksave already modeled
  the right try/catch; writeQuicksave now matches, returns false on
  failure, and the F9 handler reports "Save failed (storage full or
  disabled)" instead of silently doing nothing. Pinned (a throwing
  storage stub must not throw and must return false).
- **Browser-API sweep of the game path**: pointer lock (fixed) and
  save (fixed) were the only two unguarded throwing APIs. indexedDB
  in dataSource uses the correct onerror/onsuccess async pattern;
  paintOverlay's localStorage is a dev tool off the game path.
The systems are otherwise structurally sound for live play; what
remains is EMPIRICAL - the behaviours (loot feel, casting, save/load
round-trips in a real dungeon) need actual playtesting, which only
Mac can do (no ARENA2 in the container). The F8 HUD is the instrument
for that.

### Process lesson (recorded permanently)
~14 fixes shipped across this session with ZERO playtesting, unit-
green repeatedly called "verified" while the game black-screened or
trapped the camera. Several "root fixes" were real bugs but NOT the
reported one; the FP-viewmodel cause was visible in the very first
"hole" screenshot (a black shape filling the view, world rendering
fine at the edges) and was missed for a dozen commits because the
black shape was never questioned. TWO STANDING RULES: (1) unit-green
is not playable-green - the gate needs a real-boot smoke path, and a
change to live-executed code is unverified until it is played; (2)
read what is actually on the screen before theorizing about what is
behind it. Mac diagnosed the decisive bug from one look; the F8
instrument exists so that evidence, not theory, drives the next fix.

## P10 (teleporters + door locks - the routed action rows): SHIPPED

The Ledger C "Teleport, Activate, LockDoor, UnlockDoor" row, verbatim
from DFU DaggerfallAction delegates + DaggerfallActionDoor +
PlayerActivate.LookAtInteriorLock + RDBLayout's lock table:

- **Door locks**: the RDB starting lock (the 16-entry LOCK_VALUES
  table indexed by TriggerFlag_StartingLock >> 4, already decoded in
  rdbLayout) now reaches the runtime door. CurrentLockValue > 0 =
  locked, >= 20 = magically held. A locked closed door REFUSES the
  player's toggle and shows the verbatim LookAtInteriorLock text
  (all five tiers: magicLock at >= 20; chance = clamp(5*(level -
  lockValue) + LIVE lockpicking, 5, 95) picks lockpickChance1/2/3 or
  the 10-entry array). Opening clears the lock (Open() tail). Locks
  persist in the S12 world snapshot. RESIDUAL (honest): lockpicking
  (steal-mode activation) and bashing (attack trigger, chance
  20 - lockValue) pend the interaction-mode UI; routed in Ledger C.
- **The delegates**: Teleport (0x0e) - player position/rotation = the
  NEXT object's transform (destinations resolve through a per-block
  position index because they are usually ACTIONLESS editor flats;
  the chain cascade no-ops into them, exactly DFU's null
  GetComponent). The scene warp reuses PlayerMotor.spawn (velY
  zeroed, re-grounds on the destination floor; DFU's FreezeMotor
  0.5s carry-suppression is inert here - velocity is per-frame
  input). LockDoor (0x10) - 16 when not already locked ("don't know
  what setting Daggerfall uses here"). UnlockDoor (0x11) - 0.
  OpenDoor (0x12) - unlock + open. CloseDoor (0x14) - close +
  RESTORE StartingLockValue. Activate (0x1e) - the verbatim DFU
  no-op. All six ride the door's OWN action record (DFU
  GetDoor(thisAction.gameObject)); a door without an action stays
  unreachable by chains, verbatim.
- **Actioned FLATS join the action graph**: 25 of the corpus's 84
  teleporters (and other effect actions on archives 199/202/206/210/
  211/213/346) ride flats - the pre-P10 runtime registered MODEL
  actions only and dropped every flat action on the floor. Editor
  markers (199) with actions register too; treasure markers stay
  data-only.
- **BUG FOUND AND FIXED - the repeated-block key collision**: action
  keys were block-LOCAL byte offsets (`act:{position}`); 3108 of
  4232 dungeons repeat at least one RDB block, so repeated blocks'
  objects overwrote each other in the runtime map - the earlier
  copy stopped ticking and its collider bucket collided. Every key
  is now namespaced by block INSTANCE (`act:{ns}:{position}`), and
  chains resolve inside their own block. (Old world snapshots' act:*
  rows no longer match and reset to built state; door:N keys are
  unchanged.)
- **BUG FOUND AND FIXED - open doors restored solid**: the S12 world
  restore set door state without settling the matrix or collider
  bucket, so a door saved OPEN restored drawn-closed and solid.
  applyWorld now runs syncRestored (matrix recompute + bucket
  reconcile) for doors and movers.

2 net tests (action.test.js 3 -> 5: the lock model + text tiers +
delegates, teleport + the namespace pin). Suite 308/75, ARENA2 corpus
308/308 green pre-commit.

## P11 (swimming + levitation motor + the fatigue drains): SHIPPED

The Ledger C "Swimming + levitation motor" row, verbatim from DFU
LevitateMotor / PlayerSpeedChanger / PlayerEnterExit / PlayerEntity:

- **The motor modes** (PlayerMotor grows the LevitateMotor path):
  swimming/levitating move along the LOOK (camera-transformed input,
  pitch included) with NO gravity (prior fall velocity dies).
  Levitate speed = the 4.0 constant; swim speed = base x
  (LiveSwimming / 200) + base / 4 (GetSwimSpeed); swimming zeroes the
  look's vertical - the float keys drive it (Space/PageUp up,
  PageDown down; DFU's Crouch=C alternative collides with our
  castSpell binding, crouch itself pends) - and rising clamps where
  the controller center + 50*GlobalScale - 0.93 reaches the water
  surface ("he would immediately be pulled back in"). The S8
  waterWalking flag lands its consumer: normal walk/run speed in
  water.
- **The swim toggle** (PlayerEnterExit verbatim): swimming when the
  center + 50*GlobalScale - 0.95 sits below the block's water surface
  (blockWaterLevel via a per-block lookup on the placed layout);
  entering plays the large splash (342).
- **Levitate (14,255)** joins BUFF_KINDS - a classic Levitate spell
  now works END TO END (cast -> incumbent buff rounds -> the motor
  path), the first full loop through effect + consumer since
  slowfall.
- **Fatigue drains** (PlayerEntity per game minute, S15's queue row):
  default 11; running 88; swimming 44 on a FAILED Dice100 roll vs the
  LIVE Swimming skill (success stays default) with the Swimming tally
  every swimming minute; jumping 11 + the Jumping tally once per jump
  (the motor's per-frame jumped flag). RAW fatigue units - the x64 is
  spell-magnitude-only. Athleticism (x0.9/x0.8) pends the career
  advantage flags; the Argonian swim exemption pends race selection;
  breath/drowning (isPlayerSubmerged at +76*GlobalScale) routed to
  Ledger C.
- **PARITY FIX**: PlayerMotor.limitDiagonalSpeed (.7071 when both
  axes are live) had never been ported - the grounded motor moved
  sqrt(2) fast on diagonals. Applied on both paths.

1 net test (player.test.js 7 -> 8). Suite 312/75, ARENA2 corpus
312/312 green pre-commit.

### P10/P11 audit note (2026-08-16c): host parity

The post-merge audit found both slices wired into the STANDALONE
?dungeon scene only - the world-scene dungeon mode (worldModes.frame
owns the modal motor) never installed the teleport warp, the swim
toggle, the levitate/waterWalking consumers, the float keys, or the
fatigue activity feed. A world-mode teleporter no-opped and a
world-mode dungeon sank the player under water at walk speed. Both
hosts now wire the same seams at the same values. STANDING RULE: a
scene-side seam ships in EVERY host that owns a motor (the S8
slowfall wiring was the precedent and the tell - it was already
per-host).
