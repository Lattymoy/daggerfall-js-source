# FIELD BUGS 2026-09-27 — FIELD-CONSOLE1, a player's console read line by line

(Field-Bugs-2026-09-27 on its branch; main's seven from the Discord took that name first, and the merge renamed this one after what it holds.)

The user handed over a browser console from a live session (online, a walk
south from Privateer's Hold, a building, a dungeon, back out). Every line
was read; each is either fixed here, recorded as expected, or open.

## Fixed

- **`[town] FACTION.TXT unavailable: Cannot access 'Ut' before initialization`**
  (reproduced in the production bundle - the minifier's name differs per
  build; in dev it reads `_questRegionIndex`). townTalk's load, built far up
  `bootWorld`, resumes after its FACTION.TXT fetch and reads the region
  through `_questRegionIndex` - a `const` declared thousands of lines below,
  after `await loadQuestPack()`. bootWorld is suspended at that await when the
  fetch lands, so the read hit the dead zone and the region's people never
  loaded: every town's talk ran without its people. It is a hoisted
  declaration now, and everything its body reads is declared before townTalk
  is built (`test/systems/fieldconsole1.test.js`, `test/scenes/regionlive.test.js`).
- **`/assets/undefined` 404, twice at boot and twice at every door**
  (reproduced in the bundle, the initiator Handheld Torches' sprite loader).
  Both of that mod's loaders (the hand's sprite, the dropped torch's flats)
  probe frames until one is missing - the mod's own TryImportTexture loop -
  and in the bundle a frame past the last has no file, so Vite's dynamic URL
  answers `/assets/undefined` and each probe's miss went out as a request.
  The vendored set is known at build time (`vendoredTexture`,
  `systems/handheldTorches.js`); a frame not in it is a miss, never a fetch.
- **`Canvas2D: Multiple readback operations using getImageData are faster
  with the willReadFrequently attribute` (x24)**. Every 2D context the port
  makes to READ pixels back (the PNG decode every vendored texture goes
  through, the SDF font atlas, the held map's sheet and thumbs, the save
  window's shots, the paperdoll skin) asks for `willReadFrequently` now -
  CPU-backed, no GPU readback.

## Made to name its culprit

- **`PERF-2D: a foreign pass ran inside an open 2D run`**. Not reproduced
  offline: a single-player walk of the same route (109,158 to 109,162) with
  the renderer instrumented never raised it, and the static candidates in the
  world section (the sea's surfaces, the pits, the rain, the wisps, the bolts,
  the grass, the bodies, the peers' walkers) all close or never open a run.
  The session that raised it was online with other players. The warning now
  carries two stacks - the pass that found the open run and the draw that
  opened it (kept, as an Error, only until the warning has spoken) - so the
  next console that shows it names the draw.

## Expected, not faults

- `CURSOR.IMG` 404: that player's ARENA2 has no CURSOR.IMG; the OS cursor
  stands in, as the line says.
- `BOK00112.TXT` / `BOK00113.TXT` 404: DFU's book mapping names ids 112 and
  113 ("Bourn in Wood, Part I/II", `vendor/dfu-books/books.txt`), which the
  classic data does not carry and DFU does not ship either; the price preload
  asks for every mapped book and keeps the template price for a missing one.
- The Immersive Footsteps warning: it reads Better Ambience's live
  `Better Footsteps.enable`, which the port ships OFF - that player turned it
  on. The mod's warning is right, and says how to silence it.

## Fixed after the first pass

- **`[enhanced-ai] navmesh bake looks degenerate (11 polys from 17592
  triangles)`**, in the dungeon of map id 1204685, on both entries.
  Reproduced exactly in node (the host's own counters, the bake's own
  input, the same 11 polys and cell 0.7248), and not the spawn's: every
  classic dungeon's soup bake was broken - Privateer's Hold gave 130 polys
  from 9,079 triangles, 11 of 12 sampled dungeons tripped the guard - by
  four faults in the triangle-soup bake that compound, and the one-anchor
  cull (`src/ai/nav/navBake.js`, `src/ai/triRaster.js`, `src/ai/nav/navClient.js`):
  1. **The cell was coarsened.** Mac's budget rule (`coarsenAgent`) is for
     open terrain and sizes by the soup's box; every classic dungeon's box
     is three blocks or more a side, so all 4,232 coarsened, to 0.54-1.05 m
     cells, at which no 1.25 m doorway survives. A soup bake keeps its
     cell (0.25 m).
  2. **Two rings of erosion.** AGENT's 0.4 m radius erodes two 0.25 m
     cells off each jamb: 0 of 12 grid alignments kept a classic 1.25 m
     doorway. The soup's agent erodes one ring (`SOUP_AGENT`); a gap of
     0.75 m or less still never links.
  3. **Closed doors were walls.** Every unlocked action door (openDoorsStep's
     own test - a foe opens it) is left out of the soup; a locked or special
     one stays a wall.
  4. **Flat floors vanished.** A level triangle is a zero-thickness box, and
     the voxeliser drops one whose height lands exactly on a voxel boundary
     (16, 24, 32, 48 m against a grid based at minY - 10.2): 5,865 m2 of
     floor in that dungeon. A flat box is one voxel whose top is the surface
     (`FLAT_EPS`, Recast's own clamp).
  5. **Only the player's component was kept.** Behind one-way drops and
     locked doors most foes had no mesh at all; the bake keeps every place
     agents live - the player's feet and each layout foe's, each landed on a
     floor within 0.6 m (`landAnchors`) - through the anchor union Mac's
     `buildRegions` already takes. No implicit plane is laid any more.
  After: m1204685 8,819 polys, cell 0.25, 92 of 93 foes on the mesh, 88% of
  the capsule-walked floor; Privateer's Hold 4,602 polys, 42 of 42. The
  cache version moves to 4 (every earlier bake is a coarse one; main's
  DUNGEON-SEAMS took 3, and the merge renumbered this one past it). THE COST:
  a worker bake of a large dungeon is 5-11 s instead of 1-2 s and up to
  ~0.5 GB (the corpus's largest, Scourg Barrow, ~1.3 GB, node figures), and
  the hydrated mesh keeps its boxes on the main thread (m1204685 19 -> 136
  MB). So a worker that dies on a large soup no longer falls back to a
  main-thread bake - that would be AUDIT 59 F1's freeze several times over -
  and the classic motor stands, as it did behind a degenerate bake. The
  memory itself belongs to Mac's navmesh body (sparse cells, packed boxes,
  the poly merge), untouched here and owed to project-final. Pinned in
  `test/ai/nav/enhancedAI.test.js` (DEGENERATE-BAKE ROOT: the doorway at every
  alignment, the boundary floor, the doors, the anchor union, the worker's
  death, and with ARENA2 both real dungeons) and `tools/mutants/navbake.json`
  (10 mutants, all dead).
