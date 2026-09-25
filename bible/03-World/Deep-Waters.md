# Deep Waters - Iliac Puddle No More (DW-A to DW-E2, 2026-09-25)

jet082's **Iliac Puddle No More 1.2.2** (Nexus 1304; its assembly calls
itself *Deep Waters*), ported 1:1 off the compiled assembly - Mac,
2026-09-25: "All mods attached are to be compatible and implemented 1:1."
Provenance is `vendor/iliac-puddle-no-more/README.md` (its permission line
is RECORD OPEN). It is the required dependency of jet082's *There's a Hole
in the Bottom of the Ocean*.

"The Iliac Puddle is now the Iliac Bay." Vanilla Daggerfall's sea is a
flat sheet of water a hand deep over a flat seabed; the mod carves it out.

## The slices

| slice | what | the port's modules |
|---|---|---|
| DW-A | THE COASTLINE: for every map pixel, how far each cell lies from the shore and which cells are sea (the mod's 356 MB `DistanceBake`) | `world/deepWatersBake.js`, `world/deepWatersBakeCache.js`, `world/deepWatersClient.js`, `world/deepWatersWorker.js` |
| DW-B | THE FLOOR: the per-pixel tile data (the biome, the local edge), the bathymetry (`DeepBathymetry.SampleDepthMeters` - the edge distance's shelf, the climate's base depth, the noise), the floor mesh and its walls, the cap that hides a pure-ocean pixel's ground and clips a coastal pixel's water tiles, the surfaces | `world/deepWatersPixel.js`, `world/deepWaterTileData.js`, `world/deepBathymetry.js`, `world/deepWaterClassification.js`, `world/deepWaterFloor.js`, `world/deepWaterCap.js`, `world/deepWaterSurface.js`, `scenes/deepWatersHost.js` |
| DW-C | THE LOOK: the seafloor's and the surfaces' own programs (read back to GLSL uniform for uniform), the scene tint, the underwater distance fog, the horizon under the water | `render/deepWatersRender.js`, `world/deepWaterLook.js`, `render/fogGlsl.js` (`uDwFog`) |
| DW-D | THE SWIMMER: the swim driver in its two phases around the motor, the swim movement (the multiplier, the stroke, the floor clamp), the load grace, the public player API, the ear under the water, the breath | `scenes/deepWatersPlayer.js`, `scenes/deepWatersSwimMove.js`, `world/deepWaterSwim.js`, `world/deepWaterRuntime.js`, `systems/deepWaterPlayer.js` |
| DW-E1 | THE RUNTIME'S OTHER HALF: the transient reset a load or a teleport sends every spawner, the post-transition refresh, the light and heavy work gates, the tracker a spawner keeps what it stood in | `world/deepWaterRuntime.js`, `world/deepWaterTransients.js` |
| DW-E2 | THE DECORATIONS: the weed, coral, rock and dead sea life of the seafloor - the catalog, the per-pixel placement, the work's pacing, the three ways a batch stands, the edge clean, the program | `world/underwaterDecorations.js`, `scenes/deepWatersDecor.js`, `render/deepWatersRender.js` (`DECOR_VS`/`DECOR_FS`, `COLUMN_GLSL`) |
| DW-E3 to E5 | the fish and the fish items, the deep's foes and the encounter pulse, the sunken loot | (next) |

## The coastline is rebuilt, not carried (DW-A)

The mod computes its bake from WOODS.WLD, MAPS.BSA and BLOCKS.BSA - a
derivative of Daggerfall's own data, which never enters this tree. The port
builds the same planes on the player's machine from the player's own files,
by the rules the file proves (the threshold, the fine any-of-3x3 mask with
rows from the north, the coarse strict majority, the flood from the map's
border, octile distances capped at 255), and caches them in IndexedDB. With
the mod's own `DistanceBakeVanilla` at hand, `test/dwa_bake.test.js`
compares the two cell for cell; they agree to within the Perlin departure
(Port-Ledger A: Ken Perlin's reference noise where Unity's Mathf.PerlinNoise
stood - the author's bake is a little wetter at the coast).

## The floor (DW-B)

A carved cell's ground is the seafloor: the world host's `heightAt` answers
the floor's own height there, so the capsule, the foes and every probe stand
on it with no second ground. The floor's walls stand in the step between a
carved cell and the shore as collider meshes (`host.wallBuckets`, which the
swimmer's shore probes skip, as the mod's `IsShoreGround` refuses its own
floor). The collider reads a heightfield STEP as no slope (restFloor and
groundNormal take the gentler one-sided grade): a body at the step rests on
the ground beneath it, never metres over it.

## The look (DW-C)

The floor and the surfaces draw with the mod's own programs. The distance
fog - the mod's post effect over the camera's depth texture - is applied
per fragment in every world program instead (`dwWaterFog`, the same
arithmetic on the same distance), with a pass of its own over the sky's
pixels; see the Port-Ledger row. It is on while the presentation is under
the water (`UnderwaterDistanceFog.TryGetUnderwaterPresentation`), which is
also what the surfaces' `_DeepWatersUnderwater` reads.

## The swimmer (DW-D)

OutdoorSwimDriver runs FIRST in DFU's frame (execution order -32000) and
OutdoorSwimDriverAfter LAST (32000); the port runs the two phases around its
motor (`beforeMove` / `afterMove`):

- **The decisions.** In the water: the capsule's swim-check point (its
  centre + 1.25 - 0.95) within 0.75 m of the sea (1.5 while diving) over a
  usable column, held 1.25 s after contact is lost, never on shore ground.
  Swimming: in the water and the check point 0.1 m under the sea (0.75 once
  forged - the hysteresis), or diving, or rising. The head: the centre +
  0.95, a quarter metre under. The presentation: the camera 0.04 m under
  the sea or the head under, until the camera stands 0.08 m clear.
- **The forge.** The mod hands DFU a `blockWaterLevel` - the sea + 0.75 m,
  or just over a swimmer riding higher - through `WorldYToBlockWaterLevel`
  (a short, Mathf.Round's banker's tie), and the port's motor takes the
  height that short stands for; `LevitateMotor.IsSwimming` and
  `PlayerEnterExit.IsPlayerSwimming` ride the host's ONE motor flag write
  (`applyMotorEffectFlags`), because every change of the first cancels a
  step. The forged level and `isPlayerSubmerged` reach what DFU reads past
  the motor: the ambient's water sounds (WaterGentle at the line, the
  bubbles under it), Temple.AvoidDeath (a Stendarr priest drowning at sea
  is not saved), and the breath (PlayerEntity's own clause, on the forged
  submersion). The forged `OnExteriorWaterMethod` is what the footsteps
  read - never the motor's own: PlayerMotor.Update recomputes that from the
  ground right before the height changer reads it, and the carved sea's
  ground is none (no DaggerfallTerrain under the swimmer), so DFU's height
  changer swim-CROUCHES the swimmer, as in a dungeon, and never sinks one.
- **The post phase.** Out on shore ground ends the swim (Restore, the stand
  requested, a crouch cleared for 1.5 s after); else the decisions again
  from where the move left the player, the flags re-applied, the ascent
  clamped at the sea + 0.55 - 1.25 + 0.93 while rising, and
  `KeepSurfaceCameraUnsunk` (the forced swim crouch dropped with the head
  clear; a vanilla sink, where one holds, undone).
- **The shore exit.** A surface swimmer (not diving, outside the load
  grace) pushing forward at a shore: a landing 1 m ahead (then under the
  player) found by a ray from the sea + 13 m down 18 m, a walkable slope
  with no open water under it, and the capsule's centre moved to 1.5 m
  over it by a swept move.
- **The movement.** The Swim Speed Multiplier is a walk speed modifier
  (`AddWalkSpeedMod`) - it scales GetBaseSpeed's walk arm wherever DFU reads
  it; the stroke is Run's edge (either edge), `max(24, ceil(MaxFatigue x
  0.025))` fatigue, a burst of the swim speed x 2.65 x the tempo along the
  keys through the camera, eased out over 0.48 s / tempo, 0.9 s / tempo
  apart; the capsule's centre is kept 0.18 m over the swimmable floor.
  LevitateMotor's move is a bare CharacterController.Move - no ground snap.
- **The load grace** (`DeepWaterRuntime`): while a save loads and 1.5 s
  after, 1.5 s after a teleport, while a location loads (dropped as stuck
  after 12 s) - the shore exit, the stroke and the multiplier stand down.
- **The rest of the frame.** A boat (the `ImOnABoat` bundle) or any
  `ShouldSuppressOutdoorSwimming` subscriber turns the swim off
  (ClearBoatSwimPose); the listener takes a 1000 Hz low-pass while the
  presentation is under; a swimmer's splash every 2.5 m (clip 346 at 0.7);
  rain and snow stop for a swimmer; the vanilla encounter roll stands down
  in or over deep water; Argonians breathe forever where the setting says
  (IsWaterBreathing, wherever the player is - a dungeon's water too).
- **The public API** (`systems/deepWaterPlayer.js`, DeepWaterPlayer): the
  four published flags, OnStateChanged announced once a frame with each
  listener isolated, the suppression event, TryGetWaterColumn.

## The runtime's other half (DW-E1)

- **The transient reset** (OnTransientReset): a save starting to load and a
  teleport reset the transition state and tell every subscriber, in the
  order it subscribed - the fish, the foes, the loot and the decorations
  drop what they hold.
- **The post-transition refresh**: a load landing or a teleport (the new
  game's first stand is one - StartNewCharacter teleports the player)
  leaves one pending; the first frame terrain may be touched again (no
  grace, no terrain pass running) runs the decorations' RefreshPlayerArea.
- **The work gates**: light work while the game plays (no window over it)
  and no load is in progress; heavy work also waits out the grace's clock.
- **The tracker** (`world/deepWaterTransients.js`, TransientObjectTracker):
  the list a spawner keeps of what it stood - Clear (each destroyed now),
  Release (each handed to the encounter pulse's destroy queue), Prune (the
  dead dropped, the far destroyed, then the farthest until the cap).

## The seafloor's decorations (DW-E2)

- **The catalog.** Six pools of Daggerfall's own flats from archives 105,
  106, 206, 211, 213, 253, 305, 306, 380, 501 and 502 - weed, coral, rocks,
  dead sea life - one per water biome (the climate's, ClimateToBiome), each
  a list with a record repeated as often as its weight. Archive 106 records
  2-6 are animated, at 5 frames a second.
- **The placement**, per map pixel and seeded by it: a pass count off the
  Decoration Frequency (its fraction a roll; more in the open ocean, fewer
  in the desert's); each pass walks the heightmap three samples at a time
  with a jitter of up to two, keeps a sample under the sea and stands a
  picked record on the floor mesh's own triangle there - at least 8 m of
  water, at most 35 degrees of slope, a quarter metre clear of the floor
  (three quarters for the animated), half a metre under the surface at 1.2x
  the record's height, five metres from every other, until the per-pixel
  cap (Max Decorations Per Tile); past the cap the list is shuffled and cut.
- **The work**, as the mod paces it: the pixels within the Decoration
  Populate Radius of the player's, re-enqueued when the player crosses into
  a new pixel; one pixel placed and one placed batch stood a frame; heavy
  work only, and not in a frame the floor's deferred builds already spent a
  millisecond in (DeepWaterPromoteTiming - the mod flushes the timing at
  the head of its Update, so a build made in the promote itself or in a
  settings callback never counts); the player's own pixel keeps what it
  has; a pixel is placed once its floor is built and again whenever the
  floor is rebuilt.
- **Three ways a batch stands** (UnderwaterDecorationBatchFactory.Spawn):
  with no replacement art, DFU's billboard batch - the record's own scaled
  size, its base on the point, a random start frame; with a replacement
  picture, a material batch - the replacement's billboard size x a random
  0.7 to 1.2, its base on the point; an animated record whose replacement
  has frames, a billboard each - the same random scale, from its first
  frame, turned as a DaggerfallBillboard turns (the camera's horizontal
  facing, not the batch's), and its CENTRE on the point (the billboard's
  pivot is its centre and the mod sets its position straight).
- **The edge clean** (GetEdgeCleanedTexture): a flood from each picture's
  four edges through its padding - alpha under 16, or every channel 12 or
  less - clears what it reaches, so a flat's black outline against its
  transparent surround goes and the sprite reads clean against the water.
  Not an animated replacement's frames: its material is cleaned once, and
  then the billboard's own animation (DaggerfallBillboard.AnimateBillboard)
  sets every frame on it straight from the imported textures.
- **The program** (DeepWaters/UnderwaterBillboardBatchUnlit): the quad
  stood about the up vector, its right the cross of the view's third column
  with the up (DFU's batches' own facing), the texel times 1.12, the cut-out
  at 0.5, the scene tint, no Unity fog - the distance fog closes it - and,
  seen from over the sea, the top's share of the water column over it, as
  the floor takes it (`COLUMN_GLSL`): the mod's batches write the depth
  texture the top reads.

## What is not ported, and why

The Port-Ledger's section-A row for the mod carries six departures - the
coastline built rather than shipped, the fog per fragment, the water
column's two draws, the peripheral-location skip (below), and these two of
the swimmer's:

- **The forge's `isPlayerInsideDungeon`.** The mod raises DFU's dungeon flag
  for the Update window of each forged frame to borrow the dungeon arm's
  swim; the port hands the swim, the submersion and the water audio state
  over directly and never raises it. The arm's own afloat line ("You are
  carrying too much to stay afloat.") IS ported - at sea while forged, and
  in the dungeons, which never had it (`player/motor.js`
  `afloatMessageStep`). What the flag would also reach in that window is not
  reproduced: the city watch held back, the ambient light's target held,
  EnablePlayerTorch's settings-off arm (not ported anywhere), and a window,
  a quest placement or a save that would take the sea for a dungeon for the
  frame.
- **The water terrain collider gate.** The mod turns the terrain's collider
  off over the sea so a swimmer can go under the vanilla ground; the port's
  carved `heightAt` already is the floor, on the floor mesh's own triangles.
`PlayerShipWaterlineFix` needs no port: the two ship pixels sample flat at
the ocean elevation, so the ship's location already stands at the sea. The
mod's install lowers Unity's `Time.maximumDeltaTime` to 0.1 s - the port's
hosts clamp every frame there already - and under that clamp its frame-spike
guard (a swimmer's frame past 0.1 s moves them nothing) fires only when a
raised time scale (Travel Options' accelerated journey) lifts the frame past
it; it is ported so (the motor's `levitateMotorEnabled`).

- **The peripheral-location skip** (SkipPeripheralLocationUpdates,
  PumpDeferredLocationRestore). While the player is in or over deep water,
  or any streamed terrain is ocean-connected, the mod has StreamingWorld
  skip building every location but the player's own pixel's (and an owned
  ship's), and builds them once the player is clear of the sea. It is a cost
  measure for DFU's streamed world; the port builds its locations in its own
  pipeline, so a coast's neighbouring towns stand as they do without the
  mod.

## Online

The room owns thirteen of its switches (`systems/onlineLane.js`): the sea
and its depth (the seafloor is ground - two players who disagree would swim
over two floors), the deep's foes and sunken loot (the host's foes; a roll
that leaves the roller's hands), and the swim multiplier, the stroke and the
Argonians' breath (one ruleset per room). Its looks - the surfaces, the fog,
the fish and the weed - are each player's own.

## Tests

`test/dwa_bake.test.js` (the coastline), `test/dwb_world.test.js` (the
floor, the cap, the surfaces, the host), `test/dwc_fog.test.js` (the look:
the shaders transcribed u_xlat for u_xlat as oracles), `test/dwd_swim.test.js`
(the swimmer, through a real PlayerMotor over a real Collider: the forge,
the one edge, the surfacing, the dive, the shore exit and the post phase's
own, the grace, the suppression, the stroke, the API, the ear, the breath,
the afloat line, the frame-spike guard), `test/dwe_runtime.test.js` (the
transient reset, the post-transition refresh, the gates, the tracker),
`test/dwe_decorations.test.js` (the catalog, the seeded placement against
its C# line for line, the pacing through the real host, the three spawn
paths, the edge clean, the program and the column's share).
Mutation records: `tools/mutants/dwa.json`, `tools/mutants/dwd.json`,
`tools/mutants/dwe.json`.
