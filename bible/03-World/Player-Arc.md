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
- **S2 blocks binding** (75e3d2d): the treasure loop iterated the
  raw BlocksFile READER parameter, not `dungeon.blocks`. Field names
  matched the wrong shape so every gate passed; it black-screened
  only WITH data. Fixed to `dungeon.blocks`. (Recorded in full in
  Systems-Arc S2.)
- **Phantom identifiers** (090366b): `trs` was called unimported in
  characterSprite.js since C8 E3d - vite emitted it as a presumed
  global, so node --check / build / tests all passed while the FIRST
  real viewmodel frame threw. CLASS CLOSED: eslint flat config with
  `no-undef` now runs FIRST in `npm run check`. Swept + rooted trs,
  FLASH_TYPE_KEY (unexported), and quadInto (phantom for the file's
  life). One live-tested module (draped.js) was misread as an orphan
  and git-rm'd; the suite caught it same run and it was restored.
- **Unguarded foe build** (a1e69c1): the entire `?foes` block in
  buildDungeonContext (dynamic imports, BODY00I0 fetch, the per-foe
  CLASS-enemy loop) was unguarded on the awaited build path, so one
  bad enemy (missing CLASS*.CFG, a rig/equipment error) rejected the
  WHOLE build and the dungeon never rendered - and it armed ONLY
  with `?foes`. Now the per-foe build is wrapped (one enemy fails ->
  logged + skipped) and the foe-subsystem init is wrapped (degrade
  to a playable foe-less dungeon), both loud.

### Spawn placement (were "stuck in a hole")
- **Eye-at-marker** (68afe09): the standalone `?dungeon` host set
  cam.pos to the RAW start marker (a floor point), so the eye was at
  the floor and the feet ~1.5 below it, wedged. `ctx.startSpawn()`
  now owns the verbatim MovePlayerToMarker placement (marker + up *
  height*0.6 = +1.08, then floorLanding) ONCE; both hosts consume
  it, the worldModes inline copy died.
- **Movement under the overlay** (e77f5a5): both hosts ran live
  movement while the chargen overlay captured typing, so a name with
  w/a/s/d walked the player off the start ledge during creation.
  Overlays now HOLD the world everywhere (the standalone gates
  actions.update + both movement branches on uiOverlayActive; the
  world/exterior shells gate on modes.dungeonCtx.uiOverlayActive).
- **Wrong marker** (5f31d1d): startSpawn used StartMarker (RDB flat
  record 10) unconditionally, but DFU StartDungeonInterior with
  preferEnterMarker=true uses the EnterMarker (record 8, the
  entrance vestibule). Now prefers enterMarker with startMarker
  fallback, verbatim.
- **Single-ray floorLanding** (954338d): floorLanding cast ONE
  downward ray from the marker's exact x,z; over a floor seam / grate
  / tile-edge it MISSED and returned the raw airborne position, so
  the player free-fell and wedged on a lower ledge. Now samples the
  capsule FOOTPRINT (centre + a ring at ~half radius) and takes the
  highest floor any sample hits - matched to PlayerEnterExit
  SetStanding (PEE.cs 1240-54, snap to a down-ray hit). A genuine
  void still returns raw for gravity.

### Look / input
- **Bare requestPointerLock** (9bb337a): `canvas.requestPointerLock()`
  was called bare in all four hosts. Modern Chrome returns a Promise
  that REJECTS (unfocused, pending, or the post-Escape cooldown); the
  unhandled rejection surfaced as a crash overlay (`sh/<` =
  bootDungeon) AND left look disengaged (lock:N, mouse events
  arriving, yaw frozen) - one cause, both symptoms. A single
  src/player/pointerLock.js `requestLook` helper swallows the
  rejection, tolerates the void API, survives a sync throw, and binds
  one pointerlockerror log; all four hosts route through it. Pinned
  (3 tests) never to throw. The CLICK TO LOOK centre-screen hint
  (286118b) covers a dropped lock so the player is never stranded.

### Collision
- **g:0 knife-edge** (049854c): feet placed dead on the floor put the
  lower sphere centre at exactly floor+radius, on the boundary of the
  `d2 >= radius*radius` reject, so grounding flickered off at rest.
  Contact detection now reaches radius+SKIN (0.37) while the push-out
  still fires only within radius - a resting floor a hair away holds
  the player up, the body never sinks. Regression pinned.
- **SKIN-shell phantom flags** (9afdc0e): the g:0 change let
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
- **Camera inside the body** (9f6dad8, 33cb4ce): the ACTUAL cause of
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
- **F8 debug HUD** (b415a9a, 286118b, 53f50f3): an on-screen readout
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
  advantage flags; the Argonian swim exemption SHIPPED at P18 (the
  race gate short-circuits before the roll); breath/drowning
  (isPlayerSubmerged at +76*GlobalScale) shipped at P12, its residue
  at P18.
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

## P12 (breath/drowning + crouch): SHIPPED

Verbatim from PlayerEntity.FixedUpdate + PlayerEnterExit +
PlayerHeightChanger/PlayerSpeedChanger + HUDBreathBar:

- **Breath** (statMods.maxBreath + the dungeonContext breathTick):
  MaxBreath = LiveEndurance / 2 (int division, fortify-aware);
  currentBreath is a stored entity field riding the save envelope
  (SerializablePlayer carries it; missing = surfaced on old saves).
  Submerged = the controller CENTER (feet + 0.9) + 76*GlobalScale -
  0.95 below the block water surface (the head-under threshold; the
  P11 swim toggle uses 50). On the CLASSIC UPDATE cadence while
  submerged without WaterBreathing: a fresh dive fills currentBreath
  (DeepBreath - since P18 the real guild fold), every 19th
  classic update drains 1 (breathUpdateTally > 18; the Argonian
  coin-flip refund SHIPPED at P18), and breath 0 is
  SetHealth(0) - drowned. Surfacing zeroes the counter. The tick
  lives in dungeonContext.drawFoes, so BOTH hosts get it (the
  standing host rule - worldModes delegates here).
- **WaterBreathing** (30, 255) joined BUFF_KINDS (it gates the
  drowning tick - IsWaterBreathing) + its spellcost row (20/8
  duration, Alteration).
- **The breath bar** (hud.js, HUDBreathBar verbatim): a SOLID
  VerticalProgress 6 classic px wide, height = LiveEndurance px,
  bottom-anchored fill breath/MaxBreath; yellow (247,239,41),
  short-on-breath dark red (148,12,0) under (LiveEndurance >> 3) + 4;
  right-anchored at classic 306 (14 from the right edge), its bottom
  92 + border above the canvas bottom; drawn only while holding
  breath.
- **Crouch** (motor.js + collider.js): controllerCrouchHeight 0.9
  with the eye at 0.8 (the same 0.1-below-top law as the documented
  1.7 standing eye); toggled on the KeyX edge in BOTH hosts (DFU's
  default Crouch C is this port's castSpell - documented departure);
  crouchSpeed replaces the walk (GetBaseSpeed - and never
  applies while swimming, that branch precedes it); the collider
  grew a per-call capsule height (foes share the instance - a
  mutable field would have resized THEM); standing back up runs the
  CanStand probe (AUDIT 64 F5: DFU's own query, an upward sphere
  sweep of the controller radius over camCrouchToStandDist 0.45 from
  the controller centre - it clears only feet+1.25, the CAMERA's
  rise, not the 1.8 capsule DoStand raises regardless; blocked under
  a low ceiling the player stays crouched, and AUDIT 18 gave the
  blocked request PlayerHeightChanger's own 0.10 s retry window:
  DFU's Update chain falls through to the do-nothing DoDismount,
  which only ticks camTimer and calls timerResetAction at timerMax,
  so the stand-up re-tries every frame for timerFast and is only
  then forgotten); the crouch key is decided on the RENDER frame
  (DecideHeightAction is called from PlayerMotor.Update, never from
  FixedUpdate - AUDIT 18: reading it inside the fixed-step loop
  swallowed every press that landed on a sub-1/60 s frame); the FP
  viewmodel rides the LIVE eye offset so the weapon lowers with the
  camera. RESIDUAL
  (honest): the stealth row shipped in P13 and the standing-height
  half is DISCHARGED by AUDIT 62 F23 (2026-09-07) - `sensesContext`
  carries the LIVE `player.height`, so a crouched player is a 0.9
  capsule to every foe (transform, sight eye, distances - and, since
  the F21 review round of the same date, the missile and arrow AIM
  POINT and the missile CONTACT test in all four hosts); only
  jump-while-crouched stays allowed (DFU's AcrobatMotor has no gate).

2 tests (player.test.js 10). Suite 351/80, ARENA2 corpus 351/351
green pre-commit.

## P13 (stealth in enemy detection): SHIPPED

The oldest open flag in src (enemyMotor "Still PENDING: stealth
checks in detection") closes. Verbatim from EnemySenses.cs +
FormulaHelper.CalculateStealthChance + PlayerMotor.
IsMovingLessThanHalfSpeed:

- **The detection flow** (EnemyAI._senses, per classic update):
  sight, then hearing GATED ON PRIOR DETECTION ("classic stealth
  mechanics would be interfered with by hearing" - the pre-P13
  25-unit proximity auto-detect is gone: a quiet unseen player
  stays hidden), then the illusion gate, then StealthCheck, else
  undetected. hasEncounteredPlayer latches on first detection.
- **StealthCheck**: only for foes that wouldBeSpawnedInClassic
  (the per-classic-update band recompute: 1094-unit hard cap; the
  spawn band XZ 1024 / y 128 units vs the wider despawn band y 384
  - hysteresis; ClassicSpawnDistanceType is NEVER assigned in
  EnemyBasics so every enemy rides row 0) and inside 1024 units.
  One check per classic MINUTE (between minutes the standing
  detection holds); a player moving less than half speed skips ODD
  minutes; a faster player who has been encountered is detected
  outright (no roll); the Stealth skill TALLIES once per minute
  across ALL foes (the scene's sharedStealth minute =
  PlayerEntity.TimeOfLastStealthCheck). chance = 2 x ((classic
  distance x live Stealth) >> 10); Dice100.FailedRoll detects.
  The castle-non-hostile gate is inert (no castle detection, foes
  hostile-on-sight) - documented.
- **The illusion gate** (BlockedByIllusionEffect, per classic
  update): 13 enemies see through everything (extractor-regenerated
  seesThroughInvisibility - Imp/Skeletal Warrior/Ghost/Mummy/Wraith/
  both Daedra/Daedroth/both vampires/Seducer/Daedra Lord/Lich, NOT
  Ancient Lich, verbatim); an invisible target always blocks
  (Invisibility pends - inert); blending (chameleonNormal) gives an
  8% see-through, a shade 4% (Shade pends); NO roll for unconcealed
  targets (sequences match). This RETIRES the S8 half-sight interim
  - which the audit trail shows was DEAD post-merge anyway
  (canSeeTarget.sightScale was never assigned; the third update arg
  was ignored): chameleon concealment now works, verbatim.
- **The motor side**: IsMovingLessThanHalfSpeed (standing true;
  otherwise half the walk speed vs the applied speed - both DFU
  branches collapse to walk/2; with no Sneak input yet the live
  gate is standing still, exactly classic-without-Sneak), reported
  through reportActivity by BOTH dungeon hosts (standing rule).
- **RESIDUAL (honest)**: the Sneak input binding pends (until then
  only a still player is "moving less than half speed"); hearing's
  ray sees closed action doors as blockers (DFU's static-only mask
  lets sound pass them) - documented departure; Invisibility/Shade
  effects pend the library; the castle gate pends castle detection.

4 tests (enemymotor 8) + the motor pin (player.test.js). Suite
361/81, ARENA2 corpus 361/361 green pre-commit.

## P14 (2026-08-16): movement parity audit - jump + inclines SHIPPED

Live report (Mac): "jump isn't working correctly and I can't use
inclines" - the SAME defects Mac's 03cfa1e stairs/jump experiment
fixed and ed3c557 reverted fourteen minutes later to clear the
parallel-lane merge (the fixes never re-landed; the timeline is in
the commit graph). This slice re-derives all of it on the current
tree (which threads the P12 per-call capsule height through every
resolve) and closes the jump-law gaps the audit found against
AcrobatMotor/PlayerMotor/FrictionMotor/PlayerHealth read end to end:

- **Jump died at one frame** (apex 0.069 = one tick of 4.5/60): the
  horizontal-phase resolve grounded the capsule at its pre-jump
  height and the OR-accumulated flags carried into the frame result,
  so the motor's velY clamp zeroed the jump. Grounded/ceiling truth
  now comes from the FINAL vertical state only.
- **Stairs/inclines blocked or jammed**: the step-up was a blind
  +stepOffset teleport needing 2.3 of headroom. Now an ascending
  lift ladder (0.125/0.25/0.375/0.5) takes the smallest clear rung
  with a MONOTONE ceiling sweep, and a resolve never depenetrates
  the body UP into a ceiling (net rise clamps to entry on real head
  contact). slopeLimit 70 is the spec's block criterion (60-deg
  climbs, 78-deg blocks - pinned).
- **The verbatim jump laws** (AcrobatMotor.HandleJumpInput):
  velY = 4.5 x jumpSpeedMultiplier (1 + Jumping x 0.5 / 100 -
  systems/skills owns it; X1 landed all three terms - athleticism
  +0.1, improved athleticism +0.1 and the Jump spell +0.6 - so the
  old "INTERIM 0" note here was stale), gated on
  PlayerMotor.GroundedTime >= 0.1 s (the bunny-hop gate; jump input
  is now HELD in all four hosts - DFU re-fires past the gate,
  intended), crouched jumps x0.8 (crouchingJumpDelta), a MOVING jump
  adds forward x jumpSpeed x 0.05 momentum (DFU's classic-momentum
  hack), slowfall cancels the jump outright - and so does a Cart, and
  so does exterior water (AUDIT 64 F1: AcrobatMotor.cs:64-70 is ONE
  four-clause cancel, `OnExteriorWater == Swimming` included).
- **airControl = false** (AcrobatMotor.cs:21): airborne horizontal
  momentum FREEZES at liftoff - DFU recomputes x/z from input only in
  the grounded branch, so mid-air steering does nothing. AUDIT 64 F2:
  EXCEPT under the Jump spell - CheckAirControl's third disjunct is
  IsEnhancedJumping (:145), which is the classic path and is ported;
  only the rappel disjunct still pends, and that one is Ledger A
  (AdvancedClimbing). HitHead REVERSES a rising velY (not a
  zero-stop).
- **Falling damage** (CheckFallingDamage + PlayerHealth + the
  PlayerFootsteps sounds): falls track from CheckInitFall (a
  non-jump fall begins its y movement at 0); landing past 5 units
  bills trunc(5 x (d - 5)) HP through the one hurtPlayer door with
  SoundClips 91, a 2.5..5 drop plays the 92 hard-fall alert. All
  four motor hosts consume it (standing rule): the dungeon hosts via
  reportActivity, the exterior walk hosts inline on the shared
  entity. Slowfall = the verbatim CONSTANT -105 x dt fall speed with
  fallStart re-anchored each tick (retires the S8 0.15-gravity-scale
  interim; no damage below the expiry point).
- **Teleport/load parity**: spawn() clears all motion state (DFU
  CancelMovement + ClearFallingDamage on teleports and loads); the
  quickload position hook now routes through spawn() in the
  standalone dungeon host.
- **RESIDUAL (honest)**: the outdoor-water landing exemption
  (StreamingWorld.PlayerTileMapIndex == 0) is FLAGGED in both
  exterior walk hosts - no tile-under-player lookup yet; the
  interior mode has no fall-damage seam (single-story shells cannot
  fall 2.5+; joins interiorCtx with its arc); the ShowPlayerDamage
  screen flash pends the HUD arc; the DFU deep-water quirk is
  PRESERVED bug-for-bug (falling into deep water keeps the fall
  live - swimming never grounds - so wading OUT can bill the whole
  drop; nothing in DFU clears it); anti-bump gravity
  (PlayerMoveScanner StepHitDistance) is engine-side N/A - our
  ground snap owns descent adhesion. MAC3 (2026-09-11, "when moving
  down hills, the camera hitches badly"): that snap probed MESHES
  only, and the terrain floor was a floor and nothing more - a walk
  down a 20-degree heightmap slope was 540 of 600 steps airborne with
  59 landings in ten seconds, each a hard stop of the camera. The floor
  takes the snap's STEP_OFFSET reach now, under the same jump gate and
  only where the capsule sits clear of the mesh at the floor, so the
  step-up ladder's lift in front of a riser survives
  (`test/mac3_downhill.test.js`).

test/motorStairs.test.js restores the reverted 7-pin harness and
grows it to 9 (crouch/boost/air-freeze + fall/slowfall traces).
Suite 380/85, ARENA2 corpus green pre-commit, dungeon + exterior
shot probes green.

## P15 (2026-08-16): the Sneak input binding SHIPPED

The P13 residual closes: PlayerSpeedChanger's sneak, verbatim.
AltLeft held (DFU's default LeftAlt; preventDefault on BOTH key edges
in every host or the browser menu steals focus - Firefox activates
it on keyup). The laws (CaptureInputSpeedAdjustment +
ApplyInputSpeedAdjustment): the run/sneak STATES re-latch only while
GROUNDED ("you can't switch running on/off while in mid air" - a
sneaking jump stays sneaking through a mid-air release); running
beats sneaking; sneak speed = the walk/crouch base / 2 - 1/39.5
(the motor's existing sneakSpeed law, now consumed). Swim ignores
both, verbatim - LevitateMotor feeds GetSwimSpeed the RAW base.
The payoff: IsMovingLessThanHalfSpeed goes TRUE while sneak-moving
(the subtracted classic unit is exactly what lands it under the
half line), so the P13 stealth checks now apply to a MOVING player.
Toggle-mode sneak (ToggleSneak) and autorun pend with the input-
options arc. All four motor hosts wired (standing rule).

+1 trace in motorStairs.test.js (10). Suite 384/85, ARENA2 corpus
green pre-commit.

## P16 (2026-08-17): THE FIXED PHYSICS TIMESTEP - live hotfix SHIPPED

Live mobile report: "stuck in the ground after going up the stairs;
jumping has me go in the air but instantly snaps me to the ground."
Root-caused by REAL-MESH numeric traces (Privateer's Hold collider
built headless in Node - 334 scanned stair candidates driven by the
motor at 60 fps AND 10 fps, both code versions):

- At 60 fps the deployed code climbs every real staircase and jumps
  at full apex - the P14 laws are correct AT THE RATE THEY WERE
  DERIVED. At 10 fps (a phone rendering this scene) the SAME code
  fails the same staircase (falls off mid-flight) and the jump apex
  collapses (0.30 at dt 0.1; ~0.1 at dt 0.2): the motor integrated
  with RAW RENDER dt, and the jump's same-frame gravity subtraction
  (velY -= g*dt) scaled with the frame - dt 0.2 stole 4.0 of the 4.5
  takeoff velocity. DFU never sees this: Unity physics runs in
  FixedUpdate at a fixed timestep regardless of render rate. That IS
  the parity law, and the motor was missing it.
- THE FIX: update() is now a fixed-step accumulator - render dt in,
  FIXED_DT (1/60) physics steps out, MAX_FRAME_DT 0.25 clamping jank
  spikes exactly as Unity's maximumDeltaTime (time dilates instead of
  the integrator exploding). 1/60 rather than Unity's 50 Hz default
  keeps every shipped pin and the 60 fps behavior byte-identical -
  documented choice. Per-frame report flags (jumped,
  landedFallDistance) reset per RENDER frame and carry across steps.
- Companions kept from the same investigation (both proven
  behavior-neutral on the real-mesh sweep at 60 fps, both principled):
  the resolve's ceiling entry-clamp now fires only on RESIDUAL head
  penetration (not transient grazes the iterations already fixed),
  and the step ladder CAPS a rung at its resolved height under a low
  ceiling instead of refusing the stair (monotone in RESOLVED height
  - the thin-plane tunnel stays impossible).
- The fixture doctrine note: player.test's P11 block used dt=1
  "time compression" - retired (large dts now clamp, as live jank
  does); one update(1/60) = one step. NEW pin: a 10 fps jump reaches
  the SAME apex as 60 fps.
- RESIDUAL (honest): foe AI still integrates on render dt (no jump
  integrator, low risk - queued); the motor updates at 60 Hz on
  120 Hz displays (DFU has the same shape via FixedUpdate + camera
  smoothing; our camera follows raw - noted).

## P17 (2026-08-17): FOE-AI FIXED STEPPING - the P16 law, foe-side SHIPPED

The P16 residual closes, and it stopped being low-risk the moment
C11 made monsters live by default: every foe's pursuit speed,
gravity, and capsule stepping integrated on RAW RENDER dt - the
exact phone-framerate failure class P16 root-caused for the player,
now multiplied by ~29 foes per dungeon on the deployed mobile build.
DFU's EnemyMotor is a FixedUpdate body; ours wasn't.

- EnemyAI.update() is now the same accumulator as PlayerMotor:
  render dt in, FIXED_DT (1/60) steps of the WHOLE body out
  (senses/decision cadence + physics), MAX_FRAME_DT 0.25 jank clamp.
  The inner classic-update timer (0.0625s) drains identically - it
  only ever sees 1/60 chunks now, so the senses/turn/stealth cadence
  is deterministic at every frame rate. FIXED_DT/MAX_FRAME_DT import
  from player/motor.js (single source).
- Untouched because already frame-rate independent: EnemyAttack (its
  classic timer + the shared machine's frame clock are accumulators),
  MobileUnit's anim clock (accumulator; DFU animates on real-time
  WaitForSeconds), the rig reaction timer (visual seconds).
- Paralysis (S19) skips ai.update entirely - the accumulator holds
  and does NOT burst on unfreeze (dt is clamped per render frame).
- Fixture doctrine (as P16): the enemymotor senses tests drove
  update(CLASSIC_UPDATE_INTERVAL) expecting one tick per call - a
  bare 0.0625 now lands 3 whole steps (0.05) and NO tick. The tests
  drive 4x 1/60 per tick (0.0667 >= 0.0625: exactly one tick, one
  roll-sequence consumption, safe for ~14 calls before remainders
  stack). NEW pin: a 10 fps foe pursues to the BIT-IDENTICAL spot
  and yaw as a 60 fps foe (both drives decompose into the same 1/60
  steps), and a 10-second hitch integrates at most 0.25s.
- RESIDUAL (carried): the 60 Hz-on-120 Hz-display note from P16
  applies to foes the same way; foe knockback motion still pends
  (C11 audit item 6).

Suite 403/88 (the parity pin rides enemymotor.test.js).

## PERF HOTFIX (2026-08-17): the collider grid + the foe rest path - the live lag

Live report #3 ("an insane amount of lag now ingame"), root-caused by
a Node bench on the real Privateer's Hold collider
(tools/colliderBench.mjs, promoted standing):

- ONE capsule move cost ~2.3ms: the grid CELL was 8 world units, so
  the sphere resolve's 3x3 neighborhood scanned a 24-unit square -
  75 tris/cell average, 391 max, closestPointOnTriangle on each.
  Invisible for the lone player (2.3ms of a 16ms frame since P9);
  catastrophic when C11 put ~29 foes on the P17 60Hz fixed step:
  66ms/frame of pure collision on a fast DESKTOP, several times
  worse on the phone the game is played on. The lag arrived with
  C11 (foes default-on) and P17 made it render-rate-independent.
- FIX 1, the grid: CELL 8 -> 2. The 3x3 scan only needs to exceed
  the capsule contact radius + the worst chained push (~1.1 units;
  2.0 keeps margin - CELL=1 measured 1.4x faster still but shaves
  that margin, rejected). Same triangles found, every movement law
  untouched: all 412 tests green UNCHANGED, and the P16 real-mesh
  8-heading sweep reproduces its healthy shape (apexes 0.45-0.5,
  zero penetration). A capsule move: 2323us -> 228us (10x). The
  PLAYER motor gets the same 10x on phones.
- FIX 2, the rest path: an idle foe standing on solid ground skips
  the capsule query entirely until it moves again (gravity would
  resolve to the same spot). 29 idle foes: 66ms/frame -> 0.72ms.
  Accepted edge (documented in the motor): a mover sliding out from
  under a parked foe leaves it frozen mid-air until it next pursues
  - foes never ride movers.
- Worst case, all 29 foes pursuing at once at 10fps render:
  767ms/frame -> ~65ms; the realistic handful-of-pursuers case is
  low single-digit ms.

## P18 (2026-08-19): the P12 residue clears - the timed height transition + the breath refunds SHIPPED

The three laws the P12 Ledger row held open, plus the stale
race-selection excuse one bullet over (P11's swim exemption). Suite
green with ARENA2 set and unset; every new pin mutation-checked
(flip-at-press, coin != 1, trunc -> round, press-resets-the-clock -
all four caught, then reverted).

- **The timed height transition** (PlayerHeightChanger.cs; motor.js
  _heightAction/_eyeLevel). ONE camTimer, ticked while any action
  pends and reset only by timerResetAction (:451-455) - a re-press
  mid-window re-arms the same action without extending it (the
  toggle reads IsCrouching, which a pending crouch has not flipped),
  and an action SWITCHED mid-window INHERITS the clock, DFU's own
  arithmetic, pinned. DoCrouch (:246-262) flips IsCrouching + the
  capsule only at camTimer >= timerMax (timerFast 0.10): the player
  is mechanically STANDING for the whole window - walk speed base,
  the 1.8 capsule, the full 4.5 jump (no crouchingJumpDelta), the
  stealth half-speed compare. DoStand (:265-287) is the reverse
  order: the flip lands on the FIRST CanStand tick and only the eye
  lags, its lerp T riding the same accumulated camTimer (a stand
  that spent 0.08 s blocked gets a nearly instant camera). The
  AUDIT 18 blocked-stand retry window is unchanged - it was always
  this clock.
  DEPARTURE (documented at _eyeLevel): the eye path is a straight
  lerp between OUR rest eyes (1.7/0.8 - the 0.1-below-top law); DFU
  lerps the camera inside its Unity transform parenting (DoCrouch
  runs from prevHeight/2, 0.09 above the standing rest, and sits
  0.45 high until the height change drops the transform; a blocked
  stand lerps stale prev/target fields). Scaffolding, not law - the
  endpoints and the 0.10 s duration are DFU's.
  THE FOUR HOSTS: the seam is the MOTOR. exterior.js, world.js,
  worldModes.js and dungeonContext.js all drive it through the
  shared input.crouch edge - no host wiring changed, all four carry
  the law.
- **systems/breath.js**: PlayerEntity.FixedUpdate's breath clause
  (PlayerEntity.cs:322-343) extracted as breathStep - one classic
  update's worth; the cadence, the submergence geometry and the
  SetHealth(0) stay in dungeonContext.breathTick, which BOTH
  dungeon-mode hosts drive through dungeonCtx.drawFoes
  (worldModes.js:621). exterior.js and world.js have no submersion
  path for it to ride yet - when exterior water lands, it consumes
  this same step. New in the step:
  (1) THE ARGONIAN COIN REFUND (:331-333): on each drain tick,
  raceId 8 (EntityEnums.Races.Argonian) + Range(0, 2) == 1 re-adds
  the point. The refund lands BEFORE the drowned check, so a lucky
  Argonian at 1 breath survives that tick - pinned both ways, roll
  injectable.
  (2) THE DEEPBREATH REFILL (GuildManager.cs:388-394): the fill
  from empty folds MaxBreath through every membership.
  Guild.DeepBreath is the identity (Guild.cs:246-249); the ONE
  override is Temple.DeepBreath's Kynareth arm (Temple.cs:440-448),
  (int)(((10f + rank) / 10) * duration) - the whole rank ladder
  pinned (duration 25 -> 25,27,30,32,35,37,40,42,45,47). Ported on
  DOUBLES per the Ledger A FaceUVTool row (Mono widens float math);
  the two disagree inside the fortified-Endurance range and the
  edge is pinned: rank 4 x 45 = 62 where float32 lands 63.
  deepBreath lives in breath.js rather than systems/guilds.js -
  that file is mid-flight in a parallel session today - and it is
  the member's only export either way.
- **The Argonian swim-fatigue exemption** (PlayerEntity.cs:412;
  worldTick.js): the race gate SHORT-CIRCUITS before the Dice100
  roll - an Argonian never consumes a roll (sequence preservation,
  pinned with a counting rolls()), pays the DEFAULT 11, and still
  tallies Swimming (:414). Closes P11's "pends race selection"
  excuse - races shipped at U9.

Pins: test/breath.test.js (the identity fold, the Kynareth ladder,
the precision edge, the coin + its race gate, the drown order,
surfacing/WaterBreathing zeroing); player.test.js P18 x2 (flip at
the END going down / at the START going up on one clock, the
standing jump inside the window, the swim exemption); the P12
crouch test and audit18_player F1/F2 re-derived on the timed law
(the no-step-frame press law and the blocked-stand retry survive
unchanged). The doc-truth suite re-anchored: the breath clause is
asserted at its new seam (dungeonContext must call breathStep,
breath.js must own currentBreath), and the open-flags citations
regenerated for the one-line import shift in dungeonContext.

## M3 (2026-08-20): CLIMBING - the skill's consumer at last SHIPPED

AUDIT 23 motor-3. The Climbing skill trained (jump tallies) with no
mechanic reading it; ClimbingMotor.cs (905 lines) had no port. M3
ships the CLASSIC path whole - AdvancedClimbing OFF is the port's
law, the same doctrine as EnhancedCombatAI, so the corner wraps,
rappel/hanging handoffs, WallEject and the overhang bumps stay with
their setting as residue.

- **player/climbing.js** - the laws: CalculateClimbingChance
  verbatim ((int)(Lerp(base,100,skill/100) + Lerp(0,10,luck/100)),
  skill = live Climbing +30 Khajiit x2 Climbing-effect then clamped
  5..95 - both Unity Lerps clamp t); GetClimbingSpeed = Speed/3;
  and the ClimbingCheck state machine, classic arms only: the
  14-unit start countdown (x systemTimerUpdatesDivisor 0.0549254 -
  the divisor moved to its DFU home, a PlayerMotor field, with
  characters/enemyMotor.js re-exporting) behind the horizontal
  tolerance 0.12, the base-70 start check whose GROUND failure
  re-checks every frame WITHOUT resetting the timer (:430-437, the
  verbatim tally-spam quirk) while the mid-fall grasp (base 40)
  resets; the 15-unit continue at base 50, the 5-unit regain at
  base 20, standing still clears a slip with no roll (:449-454);
  the abort ladder (forward released, wall lost, levitating,
  riding, slipped to ground, ground within height/2+0.12 while
  descending/slipping/grasping, the non-orthogonal drift); the
  skill tallying ONCE PER CHECK before the roll, and the underwater
  forgiveness (:837-843 - the foot position collapses to
  feetY - 0.25 against the block water surface).
- **The motor's capsule work**: _climbWallProbe - two rays at
  0.4h/0.8h along the wall direction, reach radius+0.1, standing in
  for CollisionFlags.Sides + the GetClimbedWallInfo capsule cast
  (documented departure); a hit latches myLedgeDirection = the
  horizontal -normal (:608) so turning the camera mid-climb keeps
  the hug on the WALL's plane - the collider's raycastHit grew the
  hit surface's unit normal (oriented to face the ray) for exactly
  this. _climbStep owns the movement: the classic ClimbMovement arm
  (:754-758) - the wall-hug at the STALE Speed field (the early
  return sits above UpdateSpeed, the same quirk the swim path
  rides) + up at Speed/3, fall anchor held at the live height so a
  release falls from the RELEASE point (acrobat.Falling =
  isSlipping); slipping is a plain gravity fall billing from the
  slip start through the normal landing bookkeeping.
- **Wiring**: shared.climbingDeps (live Climbing/Luck, the Khajiit
  race read, TallySkill(Climbing,1), the climbingMode HUD line
  through townTalk.say where a host has one) at all three
  PlayerMotor sites. No deps = no ClimbingMotor component - exactly
  DFU's mount - so headless/test motors stay climbless and mock
  colliders never see the probe.

Mutations: 6 run, 6 killed (the ground-fail timer reset; the tally
dropped; the stand-still clear dropped; the 5..95 clamp dropped;
the water forgiveness dropped; the vertical climb component
dropped).

Pins: test/climbing.test.js x5 (the chance formula's lerps/racial/
clamps and the speed pair; the countdown + the fail-retry quirk +
the grasp reset; the continue/slip/regain cadences + the
stand-still clear; the abort ladder + the water forgiveness; and a
LIVE climb - a real Collider wall, the motor rises past 0.5, the
skill tallies, the mode line speaks once, and the release fall
bills from the release height).

### M3 addendum (2026-08-20): the climb PROBED LIVE

tools/climbProbe.mjs - frame-synced, the ?world boot. The blind
compass walk taught the first lesson: an angled wall contact SLIDES,
and the 0.12 horizontal-stationarity gate faithfully refuses the
drift (nonOrthogonalStart) - a real player squares up to a wall, so
the probe does too: the new __doorSpots surface hands building-door
positions with their outward normals (centre/normal through the door
matrix, staticDoors' own contract), and the probe stands 1.2 out,
faces square in, and holds W through the real key path. ALL GREEN:
the countdown + the live-skill check started the climb, the capsule
ROSE 1.1 up real city geometry (y 390.23 -> 391.34), releasing W
aborted through the classic abort key, and the drop landed grounded.
The __climb probe surface (climbing/slipping/y/grounded) ships with
it.

## U31 (2026-08-21): THE FIRST DUNGEON HAS A DOOR OUT SHIPPED

Reported from play: *"you cannot currently exit the first dungeon."*
It was true, and it was structural rather than a broken door.

**What was wrong.** The bare URL - the classic start, the thing a new
character actually boots - handed off to `scenes/dungeon.js`. That
scene is a standalone dev host: it builds one named dungeon, spawns at
its start marker, and its ONLY activation arm is
`ctx.actions.activate` (`:132`, `:309`). There is no exit branch in
the file. Privateer's Hold was a sealed box, and every new game began
inside it.

The complete dungeon->exterior transition existed the whole time, and
was already tested - `worldModes.tryExitDungeon`, with the verbatim
`PositionPlayerToDungeonExit` landing. It lives in the WORLD host,
which the classic start never booted. So this was not a missing
mechanic; it was a routing mistake that hid a finished one.

**What it does now**, and it is DFU's own shape rather than a
convenience. `StartGameBehaviour` (:371-401) does not resolve the
start by name. It reads a MAP PIXEL out of settings - `StartCellX` /
`StartCellY` - asks the world what location sits there, and if
`StartInDungeon` is set and that location `HasDungeon`, teleports the
streamer to the pixel and starts the dungeon interior. The classic
start now takes exactly that path: `main.js` boots the world host with
`?classic`, `world.js` resolves the start cell out of the store, and
`worldModes.startInDungeon()` puts the player inside.

**The one thing that mattered in the wiring.** `startInDungeon` routes
through `tryEnterDungeon` rather than repeating its body. That is not
tidiness: `tryEnterDungeon` is what records `dungeonReturn`, the
entrance-door candidates the exit landing is computed from. A copied
body that entered the dungeon directly would have started the game
correctly and stranded the player exactly as before - the same bug
wearing a new hat. The pin holds the call, not just the behaviour.

**VERIFIED against the data, not assumed.** `StartCellX/Y` ship as
109/158 in the vendored `defaults.ini`. Resolving that pixel against
the real `MAPS.BSA` returns `Privateer's Hold`, region 17,
`hasDungeon: true` - so DFU's shipped start cell and the port's own
map reader agree on where Daggerfall begins. Those three keys were
tiered `stored` while nothing read them; they are LIVE now, which
means changing the start cell on the settings screen really does start
a new character somewhere else.

**PROVED LIVE** (`tools/classicStartProbe.mjs`): the classic start
comes up in `mode: dungeon`, the start location reports 1 exit door,
and standing at that door and making the same activation a player
makes returns `mode: exterior`. Nothing is shortcut - the probe drives
the real raycast pick, from a stand position that had to be MEASURED:
the first draft stood at the door's own height, put the eye ~2.3 above
the door box, sailed the ray over it, and reported the exit broken
when it was not. The probe-only `__warpTo` exists for that stand and
lives inside `installShotProbes`, so it is absent from any played
build.

`scenes/dungeon.js` keeps its dev routes (`?dungeon=<name>`, and the
`?shot`/`?nomenu` path 25 probes in `tools/` drive). A pin fails if it
ever gains an exit, so that decision gets made deliberately rather
than drifting.

Pins: 4 in `classicstart.test.js` + the live probe; 4 mutations, 4
killed.

## FROM PLAY (2026-08-27): THE EXTERIOR SIDE OF THE DOOR - the airborne spawn

Mac: "when entering/exiting locations your character spawns in the air
and drops". Both exterior exits are RepositionPlayer in DFU
(StreamingWorld.cs:283-288 -> :1330-1351): the door position plus the
normal times an offset is where the controller's CENTRE goes, and it
goes no lower than terrain + height/2 + 0.15. The port's spawn is the
FEET (motor.pos; the eye is 1.7 above it), and both exits handed it the
door CENTRE - about 0.9u up - then let gravity floor it. Every building
door and dungeon door out was a small fall. `repositionFeetY(terrainY,
centreY)` in player/enterExit.js is the law in feet: max(terrain +
0.15, centre - h/2); both exits read the terrain off the collider they
are about to stand on. The world host's arrivals were the same shape
by a different route - `centerHeight + 2` at the teleport and
`heightAt + 2` at the first drop-in, with gravity for the rest - where
PositionPlayerToLocation ends in FixStanding (:1597-1608); both now
floorLanding on the built pixel, and a saved y (load, anchor recall)
is restored as saved. enterexit.test.js +2, mutant dead. exterior.js's
dev-host +2 is left as it was.

## FD1 (2026-08-28): THE OUTDOOR-WATER FALL EXEMPTION SHIPPED

`AcrobatMotor.CheckFallingDamage` (:208-224) opens, after clearing
`falling`, with a line the port never had:

```csharp
// don't take damage if landing in outdoor water
if (GameManager.Instance.StreamingWorld.PlayerTileMapIndex == 0)
    return;
float fallDistance = fallStartLevel - myTransform.position.y;
```

Both exterior hosts billed a water landing exactly like ground, and
both carried the same flag, worded identically, saying so.

**The return sits ABOVE the distance**, so the exemption covers the
`BadFallDetected` half too: a landing in a lake costs neither HP nor
the hard-fall grunt. Writing the test inside the damage arm instead
would leave the player splashing into water and still hearing the
ground-impact sound - a half-port that reads as done, and the
campaign's fourth mutant.

**The index needed no new law.** `PlayerTileMapIndex`
(StreamingWorld.cs:345) is `TileMap[...].r / 4` over the bytes
TerrainHelper's `UpdateTileMapDataJob` writes, and the port already
had that job verbatim in `convertTilemap` - 0xFF sentinel included. So
the index is that conversion `>> 2`, and the slice's real work was
factoring `convertTile` out as a per-tile door onto the law the array
path already ran. A second copy beside the fall code is exactly how the
water sentinel comes to be handled in one place and not the other.

Two things fell out of reading the encoding properly:

- **The 0xFF sentinel IS water.** `setLocationTiles` stores a zero
  tileBitfield as 0xFF so `AssignTiles` will not overwrite it, and
  `convertWater` (true on the default texturer) restores it to record
  0 - which is water. A town ground tile that encoded as zero reads as
  water to every consumer of this index. A plain `& 0x3f` mask, the
  obvious-looking law and the campaign's first mutant, answers 63 and
  loses the case entirely.
- **The sentinel collides with a real tile.** Record 63 with both the
  rotate (0x40) and flip (0x80) bits set is the byte 0xFF exactly, so
  it reads as water rather than 63. The C# tests `tile == byte.MaxValue`
  first and cannot tell them apart either. This surfaced as a FAILING
  assertion in the first version of the pin, which claimed a record
  always survives its transform bits; the honest resolution was to pin
  the collision, not to drop the case quietly.

**-1 is why this needs no interior arm.**
`UpdatePlayerTerrainTileIndex` (:321) sets the index to -1 and returns
early when the player is over no terrain - every dungeon, every
building. -1 is not 0, so the exemption is false there by
construction, and the port's `null` tile maps onto it exactly. That is
also the safe direction: a missed exemption costs the player HP, an
over-eager one makes every fall free.

The exterior host got its own probe, `playerGroundTileRaw`, the twin of
world.js's FS1 `playerGroundTile`. Its stride is DERIVED as
`RMB_SIDE / GROUND_TILE_DIM` rather than repeating the 6.4 the ground
draw passes as a literal - a probe that agrees with the picture only by
coincidence is one that will stop agreeing.

Pins: 6 in `test/fallwater.test.js`, including a source sweep that both
exterior hosts pass the tile and that no underground host invents one,
and a regeneration arm asserting from `AcrobatMotor.cs` that the water
return still precedes the distance. Campaign: 6 mutants, 6 killed.

## AUDIT 63 F37 - a moved action model kept its AT-REST activation box (2026-09-08)

`activationTargets` preferred a precomputed `o.aabb` over the live
`o.matrix`, and `dungeonContext` writes the placement's AT-REST world
box onto every MOVE-flag action model. Nothing ever refreshed it:
`ActionSystem.update` rebuilds the mover's matrix and its collider
bucket every frame, and the only aabb-travelling code in the file,
`_applyFlat`, is guarded by `baseAabb`, which only `addMoveFlat` sets.

DFU has no second box. `DaggerfallAction.TweenToEnd`
(`Internal/DaggerfallAction.cs:361-379`) is `iTween.RotateBy` (:378)
plus `iTween.MoveTo` (:379) on the GameObject, so the MeshCollider
RDBLayout attached travels with the transform, and both rays that reach
an action object read a LIVE `Physics.Raycast` hit -
`PlayerActivate.cs:381-385` (`ActionCheck` -> `Receive(Direct)`) and
`WeaponManager.WeaponEnvDamage` (`Game/WeaponManager.cs:459-464`,
`GetComponent<DaggerfallAction>()` -> `Receive(player, Attack)`). So a
platform that has tweened to its End state is clickable and strikeable
where it now stands, and nothing answers where it used to.

The port answered the opposite on both. A Translation mover driven to
`state === 'end'` reported `matrix[13] === 10` while its target box was
still `{min:[0,0,0]}`: the mover could not be clicked or struck at its
new pose, and its ghost box both answered the ray at the vacated spot
and - because `pickActivatable` takes the NEAREST AABB hit - swallowed
the activation of anything genuinely standing behind it.

One box now, `objectAabb(o)` in `src/player/activate.js`: a posed
object (`cpu` + `matrix`) measures live, and the objects that have no
mesh - effects, relays, moveFlats - keep the stored box, which is the
only one they have. `activationTargets` and `weaponRig.envAttack` (the
port's single WeaponEnvDamage ray, called from the dungeon and interior
swings) both call it, so the two copies cannot drift apart again.
Recomputing rather than translating a `baseAabb` is required: a model
mover carries ActionRotation as well as ActionTranslation
(`_applyMatrix` applies both) and an offset-shifted box is wrong under
rotation.

`dungeonContext`'s `o.aabb = aabb` stays where it is and is never
mutated in place: `collisionTriggers` owns that array as the AT-REST
trigger box behind its `restOnlyTrigger` guard, and at `state ===
'start'` the recomputed box is identical to the stored one.

Pins: 3 in `test/audit63_world_actions.test.js` - the live box, the
activate ray following the mover while the ghost stops answering, and
the swing landing at the live pose. Mutants: the precedence reverted in
either reader, 2 killed.

## AUDIT 63 F38 - action DOORS were excluded from the collision-trigger pass (2026-09-08)

`collisionTriggers` skips every object without an `aabb`, and no door
had one: `addDoor` assigns none, and neither the action-door loop nor
the special-door arm filled it in. Doors were the only registered kind
with no box, so the port's only WalkOn/WalkInto producer could never
reach one.

DFU flags them through the same call every other model goes through.
`RDBLayout.cs:255-259` runs `AddActionModelHelper` on the action-door
GameObject `if (HasAction(obj))`; that reaches `AddAction` (:897); and
`AddAction` attaches `DaggerfallActionCollision` whenever the trigger
flag is Collision01/Collision03/MultiTrigger/Collision09 (:992-996),
with no door exclusion. A special door is a plain model that went
through the same `AddAction` (:897) before
`AddComponent<DaggerfallActionDoorSpecial>()` (:901). The component
then fires `thisAction.Receive(PlayerObject, WalkOn|WalkInto)` on
contact while a move key is held
(`Internal/DaggerfallActionCollision.cs:36-56`).

Everything downstream was already ported and simply never called:
TRIGGER_GATE accepts WalkInto for Collision03/MultiTrigger/Collision09,
`receive` increments `activationCount` and plays, and `_dispatchDoor`
sends a DoorText door to `_runDoorText`, which carries the plaque line
and the `ActionAxisRawValue > 5` trespass -> MakeEnemiesHostile check.
`DaggerfallActionDoor.cs:263` names the real classic data this costs -
"Some Castle Wayrest doors have 'MultiTrigger' trigger flag" - and
those are DoorText doors, so bumping one showed no plaque and never ran
the trespass check.

Both door buckets get their box now, gated the way DFU gates the
component: the action-door loop `if (d.action)` (DFU's
`if (HasAction(obj))`), the special-door arm unconditionally, since a
special door is minted from a record by definition. `restOnlyTrigger`
is the door's OWN law rather than a borrowed one: `Open()` calls
`MakeTrigger(true)` (`DaggerfallActionDoor.cs:293`, :354-358) and
`Close()` `MakeTrigger(false)` (:349), so DFU's ControllerColliderHit
cannot fire on a swinging or open door either.

One refinement beyond the finding: the pass measures a door LIVE. A
door's `state` is the SWING while the RECORD's move rides `moveState` /
`moveT`, so a door whose record also translates would sit at
`state === 'start'` with a stale placement box - and DFU, whose
BoxCollider rides the transform, would collide with it where it now
stands. Suppressing the trigger there would have been a second
departure; recomputing is the reference. Every other kind keeps its
stored box: movers only reach the test parked at 'start', where the two
are identical, and flats travel their box in `_applyFlat`.

Pins: 2 in `test/audit63_world_actions.test.js` - the registration and
the live read, and a MultiTrigger DoorText door driven through
`receive('WalkInto')` to the plaque, the second-bump trespass, and the
record-less door's empty gate. Mutants: either box removed, the live
read reverted; 3 killed.

## AUDIT 63 F39 - the door plaque scrolled off in half the classic time (2026-09-08)

`DaggerfallAction.DoorText` is the one action text that overrides the
HUD pop delay: `DaggerfallUI.AddHUDText(tokens, 2.0f)`
(`Internal/DaggerfallAction.cs:875`) -> `DaggerfallUI.cs:775-781` ->
`PopupText.cs:130-141`, which hands the delay to
`AddText(string, float)` PER LINE (:106-116). The port's `onDoorText`
seam called `hudText.add(l)` with no second argument, taking
`HUD_TEXT_POP_DELAY` = 1.0 - `PopupText.popDelay` (:28) - so every
plaque line held for one second instead of two. The port's own comments
at both ends already stated the 2.0 while the code took the default.

`DOOR_TEXT_HUD_DELAY_S = 2.0` now lives beside `TYPE_99_TEXT_INDEX` in
`src/world/actionSystem.js` and the seam passes it, the way DFU's call
site carries its own literal. The port's `add` was already a verbatim
transcription of `AddText(string, float)`, timer arithmetic included,
so the argument was live and merely unsent.

Noted, not swept: DFU overrides the delay at many other sites (Open,
Lock, EnemyEntity, DiseaseEffect, EnemySenses, EntityEffectManager,
QuestMachine) and not one of the port's 43 `hudText.add(` calls passes
one. That is the same defect shape at the ported twins of those sites
and belongs to the magic/entity lenses, each call site matched to its
own DFU literal.

Pins: 1 in `test/audit63_world_actions.test.js` - the constant against
`DaggerfallAction.cs:875`, the 2.0 line still on its no-scroll hold at
1.5 s where the 1.0 default has begun sliding, and the seam passing it.
Mutants: the argument dropped, the constant drifted to popDelay; 2
killed.

## AUDIT 63 F41 - an armed Open beat an armed Lock at the door (2026-09-08)

`doorSpellFor` picked Open when both were armed ("Open wins if both are
somehow armed"). `PlayerActivate.ActivateActionDoor` runs
`if (HandleLockEffect(actionDoor)) return;` and only then
`if (HandleOpenEffect(actionDoor)) return;`
(`Game/PlayerActivate.cs:693-696`); the two handlers (:1012-1021,
:1023-1032) resolve two INDEPENDENT incumbents, so casting Open and
then Lock leaves both armed and the door is LOCKED to the caster's
level and swung shut (`Lock.cs:100-129`), not opened. The port produced
the opposite outcome on that classic path, and nothing merged the two
armed entries in either engine.

The bare inversion would have broken the EXTERIOR door, which is why
the fix is two lookups rather than one order.
`HandleOpenEffectOnExteriorDoor` (`PlayerActivate.cs:1036-1043`) does
its own `FindIncumbentEffect<Open>` and never asks about Lock - Lock
has no exterior arm at all - so an armed Lock masking an armed Open at
a building would have been a new defect on a wider path.
`exteriorOpenSpellFor` reads Open directly for that host and carries no
skeletonKey, because `TriggerExteriorOpenEffect` (`Open.cs:146-160`)
tests only the player's level and says so in its own summary. The
comment at the exterior site that justified the old order ("doorSpellFor
only answers 'lock' when no Open is armed") is rewritten: the reason an
armed Lock is left alone at a building is DFU's routing, not a priority
inside the lookup.

Pins: 1 in `test/effectarms.test.js` - both armed on one entity, the
action door answering 'lock' while the exterior arm still answers
'open'. Mutants: Open-first restored, the exterior arm folded back onto
`doorSpellFor`; 2 killed.

## AUDIT 63 F43 - the interior activation ray was a fourth reader of F37's law (2026-09-08)

The review round. F37 centralised "what box does a ray meet" onto
`objectAabb` / `activationTargets` in `src/player/activate.js` and the
lane's note claimed all consumers were covered through those helpers.
They were not: `worldModes.js`'s INTERIOR activation ray walked
`interiorCtx.actions.objects.values()` itself and measured each one
with the host-local `objAabb = (o) => worldAabb(o.cpu.positions, o.matrix)`.

That inline spelling is exactly what `activationTargets` was minted to
replace. It dereferences `o.cpu.positions` on an object that has no
mesh - an effect, a relay, a moveFlat, all of which carry a precomputed
`aabb` and nothing else - where `objectAabb` returns `o.aabb ?? null`.
The arm was inert only because `interiorContext` registers doors and
nothing else on that ActionSystem (`actions.addDoor` at :327 is its one
registration), i.e. it sat one interior action record away from a
TypeError thrown inside the activation ray - the crash class
`activate.js`'s own docblock records as the reason the helper exists.
It also missed F37's live-box law for a posed object.

The loop is `targets.push(...activationTargets(interiorCtx.actions.objects));`
now, which is what the dungeon arm twenty lines below already was. The
reach is unchanged: `activationTargets` stamps
`DOOR_ACTIVATION_DISTANCE`, and `pickActivatable`'s fallback
`DEFAULT_ACTIVATION_DISTANCE` is the same `128 * GLOBAL_SCALE`.
`objAabb` stays for the ladders, which are genuine meshes.

Pins: 1 in `test/audit63_world_actions.test.js` - the arm reads the
helper and no longer names `objAabb`, plus the crash the dropped
spelling throws on a mesh-less object. Mutants: the loop restored; 1
killed.

## AUDIT 63 F44 - the Castle Daggerfall hack spelled the component one door too wide (2026-09-08)

The review round. `CastleDaggerfallMagicDoorsSpecialOpenHack`
(`Internal/DaggerfallAction.cs:256-273`) ends in
`DaggerfallActionDoor door = GetComponent<DaggerfallActionDoor>();`
(:270) and acts only `if (door && door.IsLocked && door.IsClosed)`. The
port's copy tested `if (o.kind !== 'door') return;` with no `!o.special`
- and a `DaggerfallActionDoorSpecial`
(`Internal/DaggerfallActionDoorSpecial.cs:24`) is a SEPARATE
MonoBehaviour from `DaggerfallActionDoor`
(`Internal/DaggerfallActionDoor.cs:28`), so that lookup can never
return one. It has no `CurrentLockValue` at all; DFU's own class
comment is that the player "cannot open, bash, pick, or cast their way
through this type of door".

The line is `if (!isActionDoorObject(o)) return;` now - the helper F36
minted, which the F36 bible record and the `actionSystem.js` docblock
both already asserted this site was using. Both prose claims are
corrected on the Characters arc page and in the docblock: the hack was
the one of the three named sites that did NOT spell it that way, and
collapsing it was the change that made the claim true.

Pins: 1 in `test/audit63_world_actions.test.js` - given the same foyer
`loadID` and the same lock, the ordinary door is unlocked and swung and
the special door is untouched. Mutants: the `kind !== 'door'` test
restored; 1 killed.

## AUDIT 63 F45 - F38's boxes newly exposed doors to the hack on the collision path (2026-09-08)

The review round, against F38 itself. F38 gave every recorded action
door an `o.aabb`, which is what lets `collisionTriggers` reach it and
call `actions.receive(o, 'WalkOn'|'WalkInto')`. `receive` runs
`_castleDaggerfallMagicDoorsSpecialOpenHack(o)` BEFORE the
`TRIGGER_GATE` test, which is correct and deliberate - DFU's `Receive`
runs the hack ahead of its own trigger-flag switch
(`Internal/DaggerfallAction.cs:183`), the ROAD-B B4 ordering. But in
DFU the collision path is a COMPONENT, not a loop:
`RDBLayout.AddAction` attaches `DaggerfallActionCollision` only when
the TriggerFlag is Collision01, Collision03, MultiTrigger or Collision09
(`Utility/RDBLayout.cs:992-996`), and that component - driven by
`PlayerCollisionHandler.OnCharacterCollided`, itself driven only by
`Game/PlayerCollision.cs`'s `OnControllerColliderHit` - is the ONLY
collision caller of `Receive`. A Castle Daggerfall foyer door carrying
the ordinary `Door` or `Direct` trigger flag therefore has no
`DaggerfallActionCollision` in DFU and can take the hack from the
activate ray alone; the port would have unlocked it and swung it open
when the player walked into it.

Everything downstream of the gate already agreed, which is why the
distinction had never mattered: `TRIGGER_GATE` admits `WalkOn`/`WalkInto`
for exactly those four flags, so `activationCount` and the delegate
were both already refused. The hack is the one statement in front of
the gate. The fix refuses the CALL rather than reordering the gate, so
B4's ordering survives intact for the objects that genuinely collide:
`COLLISION_TRIGGER_FLAGS` / `hasActionCollision` in `actionSystem.js`
are `RDBLayout.cs:992-996` with a name, and `collisionTriggers` skips
anything they refuse. That makes the port's reachable `Receive` set
DFU's component set for every kind, not doors only. `dungeonContext` is
the tree's one collision pass (the interior host registers no action
records, so it has none to run).

Pins: 2 in `test/audit63_world_actions.test.js` - the four flags that
carry the component against the five that do not, and a `Door`-flagged
foyer door proven to take the hack from a direct `receive` (so the gate
alone would not have saved it) with the pass refusing the call ahead of
it. Mutants: the filter dropped; 1 killed.

## AUDIT 64 F0 - the exterior swim speed had no port (2026-09-08)

`PlayerMotor.UpdateSpeed` is three statements
(`Game/PlayerMotor.cs:383-389`):

    speed = speedChanger.GetBaseSpeed();
    speedChanger.ApplyInputSpeedAdjustment(ref speed);
    if (playerEnterExit.IsPlayerSwimming && !PlayerEntity.IsWaterWalking)
        speed = speedChanger.GetSwimSpeed(speed);

The port had the first two. The third was missing outright, and the one
place `swimSpeed()` was ever spent (`motor.js`'s LevitateMotor branch)
is reached only when `levitateMotor.IsSwimming` is set - which only the
two DUNGEON hosts raise. So the third statement was unreachable exactly
where DFU reaches it.

**Outdoors DFU does NOT engage the replacement motor.** `PlayerEnterExit
.cs:414-421`'s not-in-dungeon arm sets `levitateMotor.IsSwimming = false`
unconditionally ("Underwater swimming logic should only be processed in
dungeons at this time") but clears `isPlayerSwimming` only
`if (StreamingWorld.PlayerTileMapIndex != 0)` - and tile 0 IS the swim
tile. So on deep exterior water `IsPlayerSwimming` stays TRUE while
`levitateMotor.IsSwimming` is false: `FixedUpdate`'s swim/levitate early
return (`:322-326`) is not taken, `UpdateSpeed` runs at `:335`, and the
player walks the lake floor at `GetSwimSpeed`
(`PlayerSpeedChanger.cs:418-422`: `base * LiveSwimming/200 + base/4`).
The port carried the whole exterior-water model already - both exterior
hosts set `player.onExteriorWater` from `_surf.water === Swimming` and
`_heightAction` sinks the capsule to 0.30 through `_beginSink` - and
crossed the water at the full grounded walk/run/sneak speed: at Swimming
30, 2.5x too fast.

The fix is UpdateSpeed's third statement, at DFU's own position. The
gate is `this.sunk`, which is `controllerSink`, which `DoSinking` /
`DoUnsinking` write in lockstep with `PlayerEnterExit.IsPlayerSwimming`
(`PlayerHeightChanger.cs:419-423`, `:374-377`); the argument is the
ALREADY input-adjusted `speed`, so run/sneak/crouch/ride scale first and
the swim law multiplies the result. It sits ABOVE both `this.speed =
speed` and `_trackHalfSpeed`, because DFU scales the `speed` FIELD and
`IsMovingLessThanHalfSpeed` (`PlayerMotor.cs:168-181`) compares
`GetBaseSpeed()/2` against that already-swim-scaled field: a swimmer
under half the walk base must read `movingLessThanHalfSpeed` true, which
is the stealth and footstep-cadence half of the same law.

~~RESIDUE, recorded not invented: `sunk` is `IsPlayerSwimming` everywhere
the sink arms it, but it does not carry MeteoricDragon's tile-0 latch~~
**WIRED (OT1, 2026-09-10).** `exteriorSurface.js`'s `exteriorSwimming`
is the host's `IsPlayerSwimming` above ground - the sink/unsink edge
(DoSinking/DoUnsinking write it in lockstep with controllerSink) and
the tile-0 clearing rule (`exteriorSwimLatch`, PlayerEnterExit.cs:415-421)
in one helper both exterior hosts call after the surface model; the
dungeon exit's value is read before the per-frame clear and carried.

Pins: 2 in `test/audit64_motor.test.js`, both computing DFU's
`GetWalkSpeed` and `GetSwimSpeed` from the C# constants
(`PlayerSpeedChanger.cs:30-31`, `:389-393`, `:418-422`) rather than
calling the port's helpers, so a mutation of those helpers cannot move
the expectation with them. Mutant: the clause dropped; 1 killed.

## AUDIT 64 F1 - the exterior-water jump cancel (2026-09-08)

`AcrobatMotor.HandleJumpInput` cancels the jump on four conditions
(`Game/Player/AcrobatMotor.cs:64-70`): `IsParalyzed`, `OnExteriorWater
== OnExteriorWaterMethod.Swimming`, `IsSlowFalling`, and `TransportMode
== Cart`. The port's gate carried slowfall and Cart, the hosts' zeroed
input bag covers paralysis, and the water clause was covered nowhere -
so standing in outdoor deep water the port granted the full
`JUMP_SPEED * boost` leap DFU refuses outright. The clause is live for
exactly F0's reason: the outdoor swimmer is grounded on the lake bed
with the replacement motor disengaged, so control reaches
`HandleJumpInput` at `PlayerMotor.cs:346`.

Fixed with the clause itself, beside its three siblings. Pin: 1 in
`test/audit64_motor.test.js`, which also proves the same motor jumps the
instant the flag drops, so a mutation that cancels every jump reddens
too. Mutant: the term dropped; 1 killed.

## AUDIT 64 F0/F1 (the shared half) - the indoor answer nobody stated (2026-09-08)

`PlayerMotor.Update` recomputes `onExteriorWaterMethod =
GetOnExteriorWaterMethod()` every frame in every context
(`PlayerMotor.cs:367`), and that method returns `None` indoors and
underground because `GetOnExteriorGroundMethod` fails on
`PlayerEnterExit.IsPlayerInside` (`:511-513`, `:585-587`). The port
wrote `player.onExteriorWater` in the two EXTERIOR hosts only and never
cleared it, so a value carried in off a lake would ride into an interior
or a dungeon - keeping the 0.30 capsule today and, with F0 and F1
landing, the swim speed and the jump cancel with it.

The clear belongs in the hosts that ARE inside, not in
`shared.applyMotorEffectFlags`: both exterior hosts call that helper
BEFORE `player.update` and write `onExteriorWater` at the frame's tail
AFTER it, so clearing there would zero the flag for every exterior step
and take the existing sink with it. `worldModes.frame` returns early
unless the mode is interior or dungeon - which is exactly
`IsPlayerInside` - and `dungeon.js`'s walk arm is underground by
construction, so each states DFU's indoor answer for itself. Pin: 1 in
`test/audit64_motor.test.js` over both hosts.

## AUDIT 64 F2 - the Jump spell gave no mid-air control (2026-09-08)

`AcrobatMotor.CheckAirControl` (`:130-151`) recomputes airborne x/z from
live input whenever `(rappelMotor.IsRappelling || airControl ||
PlayerEntity.IsEnhancedJumping) && frictionMotor.PlayerControl`. Its one
caller is `PlayerMotor.cs:349-353`, the airborne arm of `FixedUpdate`,
with the `speed` `UpdateSpeed` just wrote. `airControl` ships false
(`:21`) and the rappel disjunct is Ledger A (AdvancedClimbing), but
`IsEnhancedJumping` is the plain Jumping effect - `DaggerfallEntity.cs
:85`, raised and cleared by `Jumping.cs:84/:94` - and the port already
reads it for the +0.6 liftoff term. So under a Jump spell DFU gives both
the taller jump and mid-air steering, and the port gave only the jump:
its airborne arm replayed the frozen liftoff momentum unconditionally.

The arm is the grounded arm's own x/z pair, which is right: Unity's
`TransformDirection` under a yaw-only player transform maps local
(strafe, y, forward) to that same pair, and `moveDirection.y` is
untouched so no gravity term rotates. Three details that are the law
rather than incidental: it ASSIGNS rather than adds, which is what makes
`HandleJumpInput`'s moving-jump boost (`:113-114`) survive only the
liftoff frame; it runs on EVERY airborne frame, so a buffed player who
walks off a ledge steers too and gating it on `jumping` would be wrong;
and it takes no paralysis guard, because DFU takes the arm with
inputX/inputY ZEROED (`:137-141`) - the velocity is killed, not frozen -
which the hosts' zeroed bag already reproduces. `frictionMotor
.PlayerControl` is deliberately not modelled: it is sticky-true on the
classic path (`FrictionMotor.cs:68/:87` with both slide settings false),
so a port of it would be a constant.

The predicate is `isEnhancedJumping` in `systems/skills.js`, beside the
`jumpSpeedMultiplier` that already made the same read, and reaches the
motor as a constructor thunk at all three `new PlayerMotor` sites
(world, exterior, dungeon - worldModes shares world's motor). A thunk
rather than a per-frame flag precisely to dodge the four-hosts miss: a
`player.enhancedJumping` field would have to be written in
`applyMotorEffectFlags` AND in worldModes' dungeon arm AND in
`dungeon.js`. A motor built with no dep keeps the frozen path, so the
headless pins are untouched.

Pins: 3 in `test/audit64_motor.test.js` (reversed input mid-flight
assigns -walkSpeed; a buffed walk off a ledge steers with no jump; the
dep is wired in all three hosts). Mutant: the disjunct dropped; 2
killed.

## AUDIT 64 F3 - AutoRun toggled the run mode and moved nobody (2026-09-08)

DFU's autorun is two halves in two components. `PlayerSpeedChanger
.ToggleRun`'s latch (`:82-99`) is the half the port had: the press flips
`InputManager.ToggleAutorun`, hands it to `ToggleRun`, and forces the
run mode on when the player was not already running. The other half is
`InputManager.Update`'s `if (ToggleAutorun) ApplyVerticalForce(1);`
(`InputManager.cs:542-545`) - the line that actually MOVES the player -
and it had no port at all: `MoveAxes.update` derived both axes purely
from the four held move keys, so pressing AutoRun (bound `Mouse2` on the
shipped map) flipped the run MODE and the player stood still.

Order is load-bearing. `:542` runs AHEAD of `FindKeyboardActions`
(`:548`), and `ApplyVerticalForce` is `vertical = scale` without
MovementAcceleration (`:1466-1468`), so the LAST write wins there: the
latch alone is +1, autorun + MoveForwards is +1, and autorun +
MoveBackwards is -1 because `:1852`'s `ApplyVerticalForce(-1)` is the
later write. (The file's recorded neutral-difference answer for two
opposing keys is untouched.) With acceleration the two forces SUM, and
the autorun force must raise `posVerticalImpulse` (`:1472`) or
`ApplyFriction` (`:1482-1483`) decays the axis by the same 9.8/s every
frame and the net stays 0.

The second half is the CLEAR, and DFU's two clears are different keys'
semantics: `InputManager.cs:1850-1852` zeroes `ToggleAutorun` inside
`FindKeyboardActions`' `GetKey` loop - MoveBackwards HELD - while
`PlayerSpeedChanger.cs:96-99` clears `ToggleRun` on the press EDGE. The
port ported only the second, so `_autorun` stayed true through a back
cancel and the NEXT AutoRun press computed `!true = false` and turned
the latch OFF where DFU re-latches: two presses for one. Both clears now
stand, each with its own key semantics.

All four hosts hand the latch to the axes (`{ ...mv, autorun:
player.toggleAutorun }`), which is a one-frame lag against DFU's own
script-order indeterminacy between `InputManager.Update` and
`PlayerMotor.Update`. The overlay-frozen arms are left alone - that is
AUDIT 28 W8's timeScale-0 law - and `moving = anyMove(mv)` was left
alone too, because `:542-545` calls the force only and adds no
`Actions.MoveForwards` to `currentActions`, so DFU's own `HasAction`
gates are false under autorun. That last clause was true and the
conclusion drawn from it was not - see the review round below, which
struck the term entirely.

REVIEW ROUND (2026-09-08), and three corrections to this section.

(1) THE RESIDUE THAT WAS NOT ONE, struck. This section first recorded
that `worldModes`'s own mousedown/mouseup handlers never call
`mouseCode(e.button)`, so `held(keys, 'AutoRun')` was dead in that host
at the shipped `Mouse2` default, and handed it to the input lane.
`worldModes` has no `keys` Set of its own: it destructures one from
`host` (`worldModes.js:357`), and its only two callers are `world.js`
(`:6147`) and `exterior.js` (`:2769`), both of which pass their own Set
and both of whose WINDOW-level handlers (`world.js:5217-5218`,
`exterior.js:2519-2520`) call `mouseCode(e.button)` and add/delete
unconditionally - outside every mode and overlay gate. `MOUSE_CODES`
maps button 2 to `Mouse2` (`input.js:281`), which is the shipped
binding (`InputManager.cs:995`). The latch is live in that host; there
was no gap to hand on and none is queued.

(2) THE FOOTSTEP GATE, fixed. The paragraph above correctly says
`:542-545` adds no `Actions` entry, so DFU's `HasAction` gates are
false under autorun - and then wrongly left `moving = anyMove(mv)`
standing as the footstep term in all four hosts. `PlayerFootsteps` does
not gate on `HasAction`; it gates on `playerMotor.IsStandingStill`
(`PlayerFootsteps.cs:264-265`), which is
`Vector2(moveDirection.x, moveDirection.z).magnitude == 0` inside
`if (grounded)` (`PlayerMotor.cs:113-125`) - and under autorun
`ApplyVerticalForce` gives `InputManager.Vertical` a non-zero value
that `GroundedMovement` writes straight into `moveDirection`, so DFU
plays the stride. The port walked the autorunner forward in silence in
every host. All four now pass `standingStill: player.standing`, the
motor's own mirror of that getter (`world.js:8617` already did at its
other footstep site) - which is also still the paralysis answer,
because the hosts zero both axes for a frozen player.

`motor.js` gained three writes to make that term honest everywhere it
is read, because `_trackHalfSpeed` on the walk path had been its only
writer and every early return above it left the term stale.
`this.standing` is initialised `true` (a motor that has not stepped has
moved nothing); the `cancelMovement` block sets it to `grounded`,
because `PlayerMotor.cs:289` zeroes `moveDirection` there; and the
swim/levitate branch sets it to `grounded` too, beside the
`movingLessThanHalfSpeed` mirror already standing there and for the
identical reason - `:322-326` zeroes `moveDirection` and returns above
`UpdateSpeed`, so `:113-125` collapses to `grounded` for a swimmer or
levitator. Without those a dungeon swimmer read a stale land value; the
climb path is left as it was, which is the same stance the
`movingLessThanHalfSpeed` mirror already takes there. The FREEZE block
(`:296-307`) correctly keeps the last value - it returns without
touching `moveDirection`.

(3) THE `ToggleAutorun` CLEAR MOVED OUT FROM UNDER THE LEVITATION GATE.
The clear above was written into `_captureSpeedAdjustment`, which
`update()` calls only `if (!this.levitating)` - the faithful mirror of
`PlayerMotor.cs:371-375`, whose early return sits directly above
`speedChanger.CaptureInputSpeedAdjustment()`. But the clear is
`InputManager.cs:1850-1852`, and `InputManager.Update` has no
levitation test at all: in DFU a levitating player who holds
MoveBackwards has `ToggleAutorun` zeroed and stops drifting when the
key lifts, where the port kept the latch and - the hosts feeding
`autorun: player.toggleAutorun` to `MoveAxes` unconditionally - resumed
flying forward. The InputManager half is now its own
`_captureInputActions`, called from `update()` ahead of and outside
that gate. It carries all four press EDGES too - AutoRun,
MoveBackwards, Run and Sneak - for the same reason: `ActionStarted`
(`InputManager.cs:626-629`) reads
`previousActions`/`currentActions`, which `InputManager.Update`
rebuilds every frame (`:463-464`), so a key held across a levitation
window must not read as a synthetic press on the frame the gate
reopens. (That was observable on Run as well as on AutoRun: with
`ToggleRun` raised, `:72-76` XORs `runningMode` by
`ActionStarted(Run)`, so a Run key held through a levitation turned the
run mode OFF when the player came down.) What stays inside the gated
half is what `CaptureInputSpeedAdjustment` itself does with those
edges - the HELD `HasAction` reads (`:72-78`), the mode toggles, the
AutoRun arm and `ToggleRun`'s own clear. Running the clear ahead of the toggle arm is order-safe:
`PlayerSpeedChanger.cs:82-83` refuses the AutoRun press while
MoveBackwards is held anyway.

Pins: 4 in `test/audit64_motor.test.js`, plus 5 from the review round
in the same file - the whole chain (MoveAxes -> PlayerMotor ->
FootstepMachine) driven under a latched autorun with no key held until
a step comes back and with the paralysis bag proving the silence is
still there; the four hosts' source read; the levitating back-cancel;
the held key across a levitation window; the swimmer's `IsStandingStill`
both ways. Two existing `AUDIT 39 #59`/`39r` pins in
`test/audit39_worldstate.test.js` moved WITH the law (the frozen
player's silence is DFU's own, and it runs through this getter:
`FrictionMotor.cs:76-81` zeroes `inputX`/`inputY` on `IsParalyzed`).
Mutants: the no-acceleration arm reverted, the impulse flag dropped,
the `_autorun` clear removed, one host's gate put back to `!moving`,
the clear returned under the levitation gate, the press edges returned
under it, the swim `standing` mirror dropped, the `cancelMovement` one
dropped; 8 killed. (Held-vs-edge on that clear is unobservable in isolation,
because the AutoRun press is itself refused while MoveBackwards is down;
the clear follows `InputManager.cs:1851` because that is where DFU puts
it.)

## AUDIT 64 F5 - CanStand was 0.55 stricter than DFU's (2026-09-08)

`PlayerHeightChanger.CanStand` (`:525-531`) is one sphere cast:

    float distance = camCrouchToStandDist;
    Ray ray = new Ray(controller.transform.position, Vector3.up);
    return !Physics.SphereCast(ray, controller.radius, distance);

`camCrouchToStandDist` is `(controllerStandingHeight -
controllerCrouchHeight) / 2f` = 0.45 (`:115`, `:54-55`). Crouched, the
controller transform is the capsule CENTRE at feet+0.45, so the swept
sphere tops out at 0.45 + 0.45 + 0.35 = feet+1.25: DFU clears room for
the CAMERA's rise, not for the 1.8 capsule, and `DoStand` (`:265-283`)
raises the capsule regardless and lets the head clip. The port instead
demanded that the whole standing capsule fit at the current feet, so
under a ceiling between roughly 1.25 and 1.8 the crouch key was a
one-way trip where DFU pops the player up.

Ported verbatim, over the collider's own `sphereCast` and from the LIVE
controller centre (`this.pos[1] + this.height / 2`), which gives
feet+0.45 on the first tick while still crouched and feet+0.9 on the
retries after the flip - exactly what DFU re-evaluates each frame until
`timerResetAction`. The pass condition is `!Number.isFinite(dist)`, not
a comparison against the distance: the collider returns `Infinity` only
on a clear sweep and a finite `dist` (0 on a start-overlap) for any hit,
which is Unity's boolean. AUDIT 18's 0.10 s retry window is untouched.

One accepted deviation at the site: Unity's `SphereCast` ignores
colliders overlapping the START sphere, so a ceiling below feet+0.80
would make DFU's `CanStand` return true where ours refuses. That band is
inside the 0.9 crouched capsule and unreachable.

RESIDUE, measured and left standing. The port's collider is engine-side
(it depenetrates; Unity's CharacterController does not), and a 1.8
capsule wedged between a floor and a ceiling in the newly-permitted band
is displaced vertically rather than left clipping: with the feet at 0, a
ceiling at 1.3-1.45 ejects the capsule to feet +0.2/+0.3 (the head
sphere resolves from ABOVE the plane) and a ceiling at 1.45-1.8 sinks it
to feet -0.1/-0.3. DFU's outcome is feet planted with the head clipping.
Both bands are PRE-EXISTING and already reachable by walking a standing
capsule into the same geometry - this law adds a second route to them,
not the artifact. A mirror of `_resolveCapsule`'s existing "a body
cannot be depenetrated UP into a ceiling" clamp was written and
MEASURED: it fixes the sink band exactly (feet 0.000, eye 1.700 under a
1.5 ceiling) but reddens `test/motorStairs.test.js`'s "a tread the
capsule cannot STAND under stays blocked", because the step-up ladder
depends on `_resolveCapsule` capping a raised rung under a ceiling and
the clamp removes that cap. The collider law therefore belongs to a lane
that owns `collider.js`, and it is recorded here rather than half-done.

Pins: 3 in `test/audit64_motor.test.js` - the reference's own arithmetic
(0.45, 0.35, feet+1.25), a 1.4 ceiling that must PERMIT the stand, and
the 1.2 ceiling that DFU's own sweep still refuses. Mutant: the
predicate reverted to the full-capsule fit; 1 killed.

## AUDIT 64 F6 - a paralysed swimmer still sank from encumbrance (2026-09-08)

`LevitateMotor.Update` returns outright when the player is paralyzed
(`Game/LevitateMotor.cs:67-69`, "Cancel levitate movement if player is
paralyzed"). That return sits ABOVE the input read (`:71-78`), ABOVE the
`upDownVector` ladder whose first arm is the over-encumbered sink
(`:81-89`), and ABOVE the one movement call in the component
(`groundMotor.MoveWithMovingPlatform`, `:106`); `PlayerMotor.cs:321-326`
returns above gravity for any swimmer regardless. So DFU gives a
paralysed swimmer zero displacement of any kind.

The port's swim/levitate branch had no paralysis test at all, and the
sink is not an input term - it is generated inside the motor from
`carriedWeight()` - so the hosts' zeroed paralysis bag, which does
neutralise mx/mz and the float keys, could not touch it: past 62.5 kg a
frozen swimmer was dragged to the bottom at swim speed.

The guard is DFU's own return, placed immediately before the move. It
sits BELOW the velY/`_airVelX`/`_airVelZ` zeroing, because that is
`PlayerMotor.cs:325`'s `moveDirection = Vector3.zero` and runs
unconditionally on the swim/levitate return - returning above it would
leave stale air momentum for the frame the player leaves the water. It
sits below the `movingLessThanHalfSpeed` mirror too, because
`IsMovingLessThanHalfSpeed` is a computed PROPERTY in DFU, not a
per-frame write. And it deliberately leaves `grounded`/`groundKey`
stale: DFU issues no `Move` on this step, and Unity's `isGrounded`
reports the last one. The minimal alternative - `&& !this.paralyzed` on
the sink alone - was rejected: it only looks equivalent because all four
hosts happen to zero the input bag, and it would still run a zero-delta
`collider.move` where DFU runs nothing.

Pins: 2 in `test/audit64_motor.test.js` - a paralysed 80 kg swimmer must
not move at all, the same swimmer unfrozen must still sink (so the guard
cannot silently revert AUDIT 26 F027), and the vector zeroing above the
guard must still run. Mutant: the guard removed; 1 killed.

## SH1 - A TABLE IS A WALL (2026-09-12, Mac's report)

Mac: "3D geometry has this issue where while it has collision, you can
immediately walk over things (like interior tables, tree trunks, etc)."

**The mechanism, measured.** `collider.js`'s step-up ladder lifted the
capsule by rungs to stepOffset, moved it forward at the raised height
and KEPT that height, leaving the ground snap to "settle it onto the
tread as forward progress clears the edge". Beside a tabletop that is
what mounted it: the capsule hovered at +0.5 beside the edge (no
contact - the lower sphere's centre 0.85 up, the edge 0.3 away), the
next frame's ladder lifted it +0.5 again from the hover, and the top
edge's contact - a normal well inside slopeLimit 70 - grounded each
slice and pushed it up. A headless walk into boxes: 0.55 mounted to
0.38, 0.6 to 0.6 (in nine airborne frames), 0.7 to 0.51. The stairs
test's own comment licensed it ("a lone box above 0.5 crests via its
~45-deg edge contact, as Unity") - Unity's CharacterController does no
such thing; its slope limit governs sliding on a slope, and a step is a
surface at most stepOffset ABOVE THE FEET.

**Three moves, all in `_moveStep` and the ladder alone.** The stand
ceiling, `entryY + STEP_OFFSET`, threads through `_resolveCapsule` into
`_resolveSphere` for the ladder's three resolves (the raised start, the
retry, the down leg): a contact above it whose normal leans up is a
WALL there - pushed out sideways by its whole penetration (the plain
push only when it sits dead under a face), never ground. A rung whose
resolve lifted the capsule past the ceiling is refused. And the DOWN
LEG, Unity's third move (up, forward, down): from the raised, advanced
position the capsule comes down by eighths of stepOffset to the first
height at which it STANDS - grounded, on a contact under the ceiling,
the forward gain kept - and a rung with nothing to stand on is refused,
so the plain move's block stands and the player slides along the table
as along any wall. Every other caller passes Infinity and resolves
bit-for-bit as before: the 0.3 staircase, the 0.45 riser, the 60- and
78-degree ramps, the facade ladder, the 2.2 stairwell, the MAC3 floor
snap - all 35 pins in `motorStairs`, `player`, `mac3_downhill` and
`mac1_playreport` hold. The same walk now: 0.55 through 1.2 blocked
flat with no airborne frame, 0.3 and 0.4 stepped and crossed.

Trees: wilderness trees are billboards with no collider at all (the 3D
tree lane was reverted whole, Audit-58); a trunk that blocks is an RMB
model in the same triangle soup, and blocks like the table now. Noted
and left: thin free-standing geometry (a 0.2 column) can be walked
through - opposing pushes cancel and `d2 === 0` contacts are skipped -
a different bug, its own slice. Ledger row SH1. Pinned:
`test/macfive.test.js` SH1.
