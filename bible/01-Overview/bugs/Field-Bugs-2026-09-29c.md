# FIELD BUGS 2026-09-29 (c) - the boats that never left the shore (FIELD-CSA2)

(Written as page (b); main's own 29b page - REALM-DOOR and CUSTOMS-PASS - took the name first, so this batch is (c).)

One screenshot of the Discord's #general, through Mac, on the morning after the 28e batch:

1. ItMustBeMonday: *"I can't get my boat to work"*.
2. SylviaBun: *"I mentioned in game but you may have been crashed at the time, people are saying Ports are bugged for
   player boats. I believe it has a bug report open atm"* - and, answered that the night's fixes should have it:
   *"People were saying it was bugged around 2am (4 hours ago)"*.

The night's fixes were live by then: the deploys of #430 (FIELD-CSA1), #431 (SHIP-PORT, SHIP-SAIL) and #432 finished by
03:12 UTC and #428's at 03:35; the reports are from about 07:00 UTC. So the fault was in the tree as it stood - and it
was: no Come Sail Away boat could move on the open sea with the mods at their defaults.

## FIELD-CSA2: every boat on the sea read its nodes as land

**Reproduced first, live.** A headless Chromium over the real game and the retail data, every mod at its default
(Iliac Puddle No More on), standing at Daggerfall: `giveboat 2 0` - "Deed to Small Ship 'I'" - used on the water south
of the city set the placing going (Daggerfall's 207, 213 is in the deed's search square from there, so "a port is
near"), and `placeboat` - the placing click's own PlaceBoatAtRayHit - said "Boat placed!". Then, spot by spot, a Small
Ship stood on the sea's top through the runtime's own PlaceBoat and its helm taken ("You control the boat!"). On the open
Bay a pixel off the coast - the centres of 209, 216 and 210, 217 - the ground under the whole hull read 34.000001 m (the
sea's clamp, the pixel's roads pass and all) and the five nodes read `[1, 1, 1, 1, 1]`: land. The same probe over the
fixed tree, the same spots: 33.994 m and `[0, 0, 0, 0, 0]`. (The first spot tried, at the south-west corner of the
coast pixel 208, 215, is not open sea: its roads pass stands the ground there at 34.8 m, and both trees read it land,
rightly.) The earlier live probes of the helm
(CSA-D and CSA-E, 2026-09-27) ran with Iliac Puddle No More OFF - its tile arm reads the Bay as water - and the height
arm, the default, had never been seen on open water; CSA-J's audit read it as standing.

**Why.** With Iliac Puddle No More on, Come Sail Away reads a node as water when `Terrain.SampleHeight(node) < 34`
(`nodeReadingAt`; ComeSailAway.WaterLevel, the sea's own height over the terrain). Daggerfall's terrain sampler clamps
the whole sea to the ocean elevation, 27.2 x 1.25 = 34 m over the terrain - the line and the sea are one height. DFU
hands those heights to Unity as floats, and Unity does not keep them: a TerrainData heightmap holds each height as a
16-bit step, kMaxHeight (32766) of them to the terrain's full height, and SampleHeight reads the steps. The flat sea is
579.105 steps, held as 579: 33.994 m, under the line - water. The port's stand-in (`scenes/world.js` `csaTerrainOf`)
read the drawn ground's floats: 34.00000097 m, never under it - and the open sea is that height wherever the sampler
clamped it (south of Daggerfall, whole pixels of the Bay are nothing else: 208 to 212 on row 216, among others). So on
the port:

- **No boat on the sea could move.** More than three nodes off water is beached (IsBeached): the oars' move is zeroed
  each frame and LateUpdate moves nothing. A deed's boat, a Rowboat from its parts, the boat a port put in the water:
  the same.
- **No sail could be raised.** RaiseSails wants all five on water: "Unable to raise sail. Boat is obstructed."
- **The Overworld's crossing never put to sea.** Its launch waits for all five nodes on water by the same law
  (`tvSeaLaunch`, `tvSeaWaterAt`), so a journey across the water walked on at the shore.

Why "ports": a deed wants a port within its search square (IsNearPort), so every deed's boat went into the water beside a
port and sat there. The screenshot's own answer - *"I pushed a ton of bug fixes last night for it"* - ties the report to
Mac's line on 2026-09-28e, *"a player is at a port but unable to set sail"*: SHIP-PORT fixed a real fault on the bank's
ship's deck and set Come Sail Away's "Unable to raise sail. Boat is obstructed." aside as the mod's own refusal. On the
open sea it was the port's. Corrected in place there.

It is the trap WATER1 (2026-09-08) found in the tile job: a comparison the reference holds because of how it stores a
number (there float32, here Unity's 16-bit heightmap) and a double misses.

**The fix.** `world/terrain/terrainSurface.js` `terrainSampleHeightAt`: Terrain.SampleHeight at the precision Unity holds a
heightmap in - each corner as its step (`unityHeightmapStep`, `UNITY_HEIGHTMAP_MAX_HEIGHT` 32766), the steps
interpolated over the quad's two triangles (GetInterpolatedHeight, cut on the drawn ground's own diagonal), the height a
step times size.y over kMaxHeight, in floats. `csaTerrainOf`'s `sampleHeight` reads it; the terrain's clamp to its
edge (CSA-J) and its stride stand. It is the one stand-in for Terrain.SampleHeight whose reader draws a line at the sea:
the node law, the placing's and the Overworld's probes through it. No departure - the port reads the height the
reference reads.

Seen live, the one probe over the tree before the fix and the tree after it (the open Bay, 209, 216, a Small Ship at
the sea's top, the helm taken, the intro's window put away so the keys reach it; the world had re-centred under the
player, the terrain's own y at -10.8):

| | before | after |
|---|---|---|
| the ground under the hull (the drawn floats) | 34.000001 m | 34.000001 m |
| the host's Terrain.SampleHeight there | 34.000001 m | 33.994 m |
| the five nodes | `[1, 1, 1, 1, 1]` | `[0, 0, 0, 0, 0]` |
| the sails' key (End) | "Unable to raise sail. Boat is obstructed." | "Sail raised!" |
| the oars held, 24 frames | 0.00 m | 2.86 m, under way |

**Declared.** Whether Unity's SetHeights rounds a height to its step or truncates it is in no source the port has; the
port rounds. The sea is step 579 either way (579.105), and the two readings part only for a height in the upper half
of a step - 2.9 cm of the coast's first rise.

**Not changed, and why.**
- The node law is the mod's own, 1:1; so is the shore: ground a step above the sea (34.05 m) is land, as in DFU. A
  town's pond (Daggerfall's stands at 320 m) still reads land with the mod on, as the CSA-D probe recorded.
- The drawn ground, the collider and the swimmer's clamp over the vanilla ground (`dwVanillaGroundY`, DW-D) keep the
  floats: a step is 6 cm, and none of them draws a line at the sea's height.
- Boats already placed need nothing: a boat's record is its place, and its nodes are read again where it stands.

## For Mac

- **The deploy.** A client change (`src/`): the site on the push to main, the desktop app with its next release. The
  relay and the account service are untouched.
- **The rounding** (above) is the one reading not proven against Unity; it is recorded, pinned and harmless for the
  sea. A Unity install could settle it: SetHeights(0.5 / 32766 + a little), GetHeights.
- **The bug report thread** SylviaBun mentions was not in the screenshot. If it names anything beyond "the boat will
  not move or sail" - a port that refuses a deed, a boat placed out of sight - it is a second fault, and wanted.

## Records

- Tests: `test/systems/comeSailAway/field_csa2.test.js` (6) - the sampler's sea at the drawn ground's 34.000001; the law (the flat sea at
  step 579 under the line, a step up land, the port's rounding, any ground within a step of the drawn one, the far
  ring's stride); the host's own `csaTerrainOf`, mounted from its source over a real StreamingWorldState and a vertical
  recentre; the real runtime over the vendored hulls, the mod on: all four hulls a shelf or parts give read the sea,
  raise their sails and row; the shore stays land; and on the retail data (ARENA2_PATH) the open Bay the probe sailed
  (209, 216) - the deed's port found by world.js's own `csaIsPortTown` over MAPS.BSA, the Small Ship's nodes on the
  Bay, its sail raised, the coast's first rise (208, 215) land. Red before the fix: four of the six (the reading and the
  shore's guard hold either way).
- Mutants: `tools/mutants/field_csa2.json` (11: the host back on the drawn ground, the step unheld, truncated, or of
  65535, the prefab's terrain scale, the height unrounded to a float, the other triangle, each half's axes swapped,
  the corners one apart, the stride dropped) - all dead.
- Re-aimed by content, never loosened: `test/systems/comeSailAway/csa_close.test.js`'s CSA-J pin (the terrain's clamp to its edge, on the call
  the stand-in makes now) and its record `csa_close.json::CSA-J-host-terrain-unclamped`; `grass3.json`'s two
  `surfaceHeightAt` records, each given a line beside it only the drawn ground's sampler has (the new sampler repeats
  their one) - all three dead.
- The live probes were scratch, not committed: a vite server over the tree (and over a worktree of the base for the
  before), Playwright's Chromium on SwiftShader, `?world&shot&play&class=16`, the `__csa*` hooks (`__csaConsole`'s
  giveboat and placeboat, `__csaUseItem`, `__csaSpawn`, `__csaNodes`, `__csaActivateAt`, `__csaHelm`) and a read-only
  hook for the ground under a point, the keys through the page once the intro's window was put away. A headless page's
  click never reached ActivateCenterObject, so the placing click was the console's `placeboat` - the same
  PlaceBoatAtRayHit.
- Docs: `03-World/Come-Sail-Away.md` (the nodes; the close's Iliac Puddle No More arms; Tests),
  `01-Overview/bugs/Field-Bugs-2026-09-28e.md` (SHIP-PORT's "Not changed" corrected), `09-Testing/Testing.md`,
  `01-Overview/Active-Arcs.md`, the Sea Update's and the Overworld's patch notes.
