# MOD SUPPORT - the third asset-injection domain (2026-08-29)

Mac uploaded `WindMills.rar`, a Daggerfall Unity mod by Kamer, and asked
"how hard would it be to implement this", then "I want to find a way to
get this mod to work". This page is the record of the study. NOTHING IS
IMPLEMENTED YET - this is a plan, and the session paused on usage before
any of it was written.

## What the port already has

DFU's asset-injection layer has three domains. The port has two:

- `src/systems/textureReplacement.js` - a port of DFU's
  TextureReplacement.cs, using DFU's exact
  `{archive:000}_{record}-{frame}.png` naming. Gated on
  `getBool('Enhancements', 'AssetInjection')`, the identical gate to
  SettingsManager.cs:569.
- `src/systems/musicReplacement.js` - the same shape for songs.

The third, MeshReplacement.cs, is not ported. Neither is
WorldDataReplacement.cs - `src/formats/blocksFile.js` says so verbatim in
its header ("Structural simplification only: DFU's WorldDataReplacement
mod-injection hooks are not ported"). That disclaimer is the marker for
where this work lands, and it gets DELETED when Step 4 ships.

## The archive

No RAR extractor exists in the session image, and `pip install rarfile`
imports with a pyo3 panic. The unrar 7.1.6 source from rarlab builds
clean with the stock toolchain (`make -j`) and extracts all 204 entries.
Worth knowing: 170 of them use RAR5 method 3, so header-only parsing
recovers the file list but no content.

**The archive is the mod's Unity SOURCE PROJECT, not the distributable.**
There is no `.dfmod` in it - only `WindMills.dfmod.json` (the manifest)
plus 102 `.meta` sidecars, 24 `.prefab`, 21 `.png`, 21 `.mat`, 9 `.dae`,
3 `.cs`. DFU itself would refuse this directory: ModManager scans for
`*.dfmod` and TryGetAsset answers nothing unless `mod.AssetBundle`
is non-null.

This is GOOD for the port. The bundle is a bake of text files that are
all present, so the port reads the source where DFU reads the bake. That
is a delivery divergence to document, not a blocker.

## The five findings that changed the plan

**1. The runtime artifact question is a red herring, but only just.**
Everything the bundle carries exists as source EXCEPT the two
`[ImportedComponent]` behaviours, which are compiled C#. The port cannot
execute C#. They must become named built-ins keyed on script filename.
That is the one genuinely non-1:1 step in this whole arc and it ships
labelled as such.

**2. The watermill is model 41601, not 21411.** All seven block
overrides place exactly one 41600 and one 41601; `grep -c 21411` is 0 in
every one. 21411 appears only in `LoadWindmill.cs`, which is ABSENT from
the manifest's Files array and therefore never compiles - namespace
`DaggerfallModdingTutorials.Part3`, dead tutorial scaffolding. Ignore
that file completely. It also means the "does this mod spin the whole
building?" worry is void: all 24 prefabs attach the spin components to
child parts only, never a root.

**3. The four "malformed" RMB JSONs are not malformed.** DFU parses them
with FullSerializer, whose commas are OPTIONAL - fsJsonParser.cs:350 and
:414 are both `if (HasValue() && Character() == ',')`, not a
requirement, and :136/:142 accept `\a` and `\0`. That is exactly and
only what breaks `JSON.parse`. Implementing those three rules, all seven
files parse and all seven carry both 41600 and 41601. DO NOT REPAIR
THESE FILES - they are valid DFU input, and repairing them would both be
the divergence and mean writing third-party bytes.

The specific defect in FARMAA01 (line 3749) is an object closing `}`
followed directly by the next array element `{` with no comma. A
tolerant reader that only drops TRAILING commas still fails on it.

**4. The mesh axis rule is measured, and the declared up-axis lies.**
The files say `<up_axis>Z_UP</up_axis>` and the data is already Y-up.
Trusting the declaration produces a blade 13 units from its mount. The
rule, settled by measurement:

    positions: (-x,  y,  z)   from the raw float_array
    normals:   (-nx, ny, nz)
    indices:   REVERSE winding (swap tri[1] and tri[2])
    ignore the <node> <matrix>.  no up-axis conversion.  no GLOBAL_SCALE.

The decisive measurement: the `Plank` submesh of `New_Windmill 2.dae` is
the blade's mounting plate, centroid (-3.944, 5.889, -7.031). The prefab
puts the Blade hub at (3.96, 6.01, -5.5). Negate X and they meet -
dX 0.016, dY 0.124, dZ 1.531 (the blade sits in front of its plank along
the axle). Leave X alone and the blade is 7.90 units off its own mount.
Corroborated on 41601, whose raw X runs [-14.578, 1.472] while
`Plank_Gear` sits at X=+11.02 and `Roller` at X=+9.64.

Winding is measured too, not assumed: `cross(v1-v0, v2-v0) . normal > 0`
in 332/332, 26/26, 722/722 and 34/34 triangles across four meshes, so
raw COLLADA is uniformly CCW-front. Negating X mirrors, so winding must
reverse to match the port's CCW world-space front faces.

> The mirror applies to the MESH ONLY. Prefab `m_LocalPosition` and
> `m_LocalRotation` are already authored in Unity space and are used
> verbatim. That asymmetry is what the plank/hub test validates.

**5. The mod's 21 PNGs must NOT be registered.** They are
classic-resolution re-exports of vanilla archives
(64/67/69/91/103/124/164/165/166/332/364/365/366/369/464/465). The
texture registry indexes by archive/record with no directory scoping, so
registering them repaints those archives GAME-WIDE, not on the mills.
They are also unnecessary - the `.mat` basenames already encode
`(archive, record)`, so the mill wears the player's own ARENA2 art.
Biggest scope cut in the plan, and it is free.

## The mod, decoded

Unity prefabs are plain YAML and every GUID in them resolves to a real
file in the archive. `41600.prefab` reads out as:

- root "41600", identity transform
- MeshFilter -> `New_Windmill 2.dae`, 5 submeshes in order
  (Walls, Plank, Roof, Windmill, Door)
- MeshRenderer m_Materials, same order: 364_2-0, 067_1-0, 369_3-0,
  067_1-0, 332_0 - all Daggerfall archive/record names
- child "Blade" -> `Blade.dae`, local position (3.96, 6.01, -5.5)
- `Spin_Up` attached to the BLADE, not the root

`Blade.dae`'s bounding box is symmetric about the origin
(x[-17.03, 17.05], z[-17.05, 17.04]), which independently confirms the
blade pivots on its own centre.

The COLLADA subset is the easiest possible: v1.4.1, one `<geometry>`,
`<triangles>` only, VERTEX/NORMAL/TEXCOORD, no skinning, no animation.
Each `<triangles>` is one submesh carrying its material name. Nine files,
the largest 722 triangles.

The two behaviours, read from the shipped source:

    Spin_Up.cs:27         transform.Rotate(0f, 0f, -13 * Time.deltaTime, Space.Self);
    SpinTime_Roller.cs:47 transform.Rotate(13 * Time.deltaTime, 0f, 0f, Space.Self);

## The seam

The single most useful correction from the study: **`getGpuMesh` is not
the only ARCH3D reader.** Three paths read it independently -
`src/scenes/dataPipeline.js` (getGpuMesh; caches null on a miss BEFORE
anything could substitute), `src/scenes/dungeonContext.js` (getModelPre;
THROWS on a miss, taking the whole dungeon context down), and
`src/scenes/worldModes.js` (houseMeshRadius, a direct radius read).

A check inserted only in getGpuMesh is therefore neither sufficient nor
necessary. Decorating the `arch` object passed to createDataPipeline -
four call sites, in `src/scenes/world.js`, `src/scenes/interior.js`,
`src/scenes/exterior.js` and `src/scenes/dungeon.js` - covers all three
readers at once and better matches DFU, where MeshReplacement sits
beside MeshReader rather than inside a single consumer.

For world data the seam IS single: the top of `getBlock` in
`src/formats/blocksFile.js`, mirroring BlocksFile.cs:385 which
short-circuits before LoadBlock so the stock BSA record is never read.
Every consumer funnels through getBlock/getBlockByName.

## What already works, unchanged

- `src/render/renderer.js` needs ZERO changes for spinning blades:
  drawMesh already takes an arbitrary matrix per call, and both exterior
  hosts already issue per-frame-recomputed matrices via `arrows.draw`.
- renderer.createMesh already consumes exactly the `dfMeshToModel`
  struct from `src/world/meshReader.js`, so a COLLADA mesh drops in.
- The submesh->texture key is already the mod's key: the renderer builds
  `${sm.textureArchive}_${sm.textureRecord}`, and the `.mat` basenames
  ARE `{archive}_{record}-{frame}`.
- Space.Self is already doctrine in `src/world/actionSystem.js` - "world
  translation pre-multiplies the placement, self rotation
  post-multiplies it".
- `src/world/rmbLayout.js` already iterates array `.length`, not header
  counts, so the mod's appended-past-the-count subrecord works free.
- The delivery pattern exists: pickAssetFolder -> storeAssets ->
  IndexedDB -> re-registered every boot, in `src/scenes/dataSource.js`
  and `src/scenes/shared.js`.

## The plan

Planned modules are named by basename because the bible may not name a
`src/` path that does not exist yet.

GENERIC CAPABILITY

1. `fsJson.js` (formats) - the FullSerializer dialect. ~40 lines.
   Optional commas, `\a` and `\0` escapes. Throws on real failure,
   matching Parse->AssertSuccess; WorldDataReplacement.cs has no
   try/catch anywhere. TRIVIAL.
2. `dfBlockJson.js` (formats) - JSON to the port's DFBlock shape.
   PascalCase->camelCase; GroundTiles flat-256 to `[x][y]` as
   `tiles[i%16][(i/16)|0]` (DFBlock.cs:1136-1141). Take arrays by
   `.length`, never header counts. Do NOT reuse the blocksFile path that
   synthesizes subRecord.xPos from fldHeader.blockPositions - verified
   wrong here (FARMAA05's mill subrecord is (3200,3328,0) while
   blockPositions[1] is (1152,1920,0)); RMBLayout.cs:826 reads
   subRecord.XPos directly. MEDIUM.
3. `worldDataReplacement.js` (systems) - shaped one-for-one on
   `src/systems/textureReplacement.js`. Same AssetInjection gate.
   Filename `${blockName}${variant}.json` verbatim, blockName including
   the `.RMB`. Parse everything at registration - getBlock is
   synchronous all the way down, so the lookup must be a sync Map hit.
   Set `index = block` unconditionally, discarding the JSON's own Index
   (the mod ships 704/1185/792/795, all thrown away). MEDIUM.
4. `src/formats/blocksFile.js` - the hook above loadBlock, plus delete
   the now-false disclaimer in the header. TRIVIAL.
5. `colladaFile.js` (formats) - ~150 lines, zero deps. De-index against
   each input's OWN offset (NORMAL count != POSITION count in every
   file - 41601 is 420 vs 652 - so shared-index assumptions silently
   corrupt lighting). Honour `accessor/@stride`. One `<triangles>` = one
   submesh. Skip the stray `<lines>` in 41601.dae. MEDIUM.
6. `unityPrefab.js` (formats) - THE HARD STEP, and the schedule risk.
   The only place hierarchy, pivots and script bindings exist. The two
   shipped shapes DISAGREE structurally: 41600.prefab nests the Blade as
   a PrefabInstance whose transform lives in m_Modifications
   propertyPaths, while 41600_Desert.prefab uses a plain child. Handle
   both or the blade is misplaced or motionless WITH NO ERROR. Write its
   test first, not last. LARGE.
7. `modelReplacement.js` (systems) - 1:1 with MeshReplacement.cs.
   modelName from GetName verbatim: Desert gets a SEASONLESS name, every
   other climate gets climate+season. Climates off `src/world/climateSwaps.js`,
   seasons off `src/systems/gameDate.js` (DFU's Seasons order), NOT
   climateSwaps' 3-value SEASON. Honour the manifest's Files[] or the
   port picks up `Models/11511.prefab` and injects a windmill over
   unrelated classic model 11511, which DFU can never do. Scale is
   MULTIPLIED, not assigned. MEDIUM.
8. `src/scenes/dataPipeline.js` - hook above the null cache, and re-key
   the caches from modelIdNum to id|climate|season (climate varies PER
   PIXEL, so a bare-id key freezes the mill at whichever climate loaded
   first). Populate cpuModels for replacements too - the exterior hosts
   do an unguarded `cpuModels.get(...)` then read `.positions`, so a
   replacement without a cpu entry THROWS out of scene build. MEDIUM.
9. Delivery - two new IndexedDB stores (models, worldData) on
   `src/scenes/dataSource.js`, one picker, registered in
   `src/scenes/shared.js`, a button on the AssetInjection row in
   `src/ui/settingsWindow.js`. The model store must key on RELATIVE
   PATH, not basename. SMALL.

WINDMILL-SPECIFIC GLUE

10. `modComponents.js` + `spinners.js` - THE NON-1:1 STEP. A named
    registry mapping script filename to a built-in behaviour, resolved
    script GUID -> `.cs.meta` -> filename. Two built-ins. Post-multiply,
    beside the existing arrows.update/draw. Do NOT reuse ActionSystem -
    its update clamps t to [0,1] over a duration and settles at 'end';
    continuous rotation would mean inventing a state DFU does not have.
    Write in the file header that this registry stands in for a compiled
    mod assembly and is the one thing here that is not a port. SMALL.
11. Interior watermill 41601 - `src/scenes/interiorContext.js` already
    has the dynamic lane. Two parts: Plank_Gear (Z, -13/s), Roller
    (X, +13/s). SMALL.
12. The mill sound - SoundClips.ArenaFireDaemon = 11, LoopOnAwake.
    `src/systems/audio.js` hardcodes `distanceModel = 'linear'`, correct
    for DFU torches but wrong here (the mod sets nothing, so Unity's
    logarithmic default). Add an option defaulting to 'linear' so no
    existing caller changes. No proximity gate - LoopOnAwake has
    playerCheck=false. Most droppable; ship last. SMALL.

## Mod bugs to reproduce faithfully, not "fix"

`41600_Desert.prefab` references `New_Windmill 2.dae`, not the Desert
mesh. And 41600_Temperate/_Swamp/_Mountain can never be requested, because
GetName emits a seasonless name only for Desert. Follow the data.

## First move

Two probes, neither touching a repo file.

**(a) The coupling fork.** Against Mac's own ARCH3D: does
`getRecordIndex` answer for 41600 and 41601? If -1, the override ships
STANDALONE (getGpuMesh returns null, world.js continues, no floating
anything, and the appended subrecord still yields a properly grounded
farmhouse because it carries classic model 118 at YPos 0 alongside the
mill). If >= 0, stock 41600 floats 16.55 units in all seven blocks and
the two features must ship together. NOT RUN - ARENA2_PATH is unset in
the session, so this needs Mac's machine.

**(b) The render kill-shot.** Build only the COLLADA reader, hack two
lines into the pipeline to return it for one model id in a walkable
town, and screenshot. That one image proves four things nothing else
can: the axis rule, the scale, that `.mat`-derived (archive, record)
submeshes resolve against vanilla textures, and that a non-ARCH3D-shaped
mesh survives createMesh/drawMesh unchanged. Do (b) BEFORE the block
adapter - if the mill renders mirrored or inside-out, the mesh half
changes shape and the WorldData work would have been wasted.

The ground-contact identity already holds, driving the port's real
layoutRmbBlock over all seven blocks: mill world Y 16.55-16.58 against
meshMinY -16.572, leaving ground contact within 3-22 mm. Bake that into
the reader's self-check so it cannot silently regress.

## Tests

Nineteen mutation-checked pins were specified, every fixture SYNTHESIZED
- no mod byte, no game byte, so all run in CI with no ARENA2_PATH. The
ones that matter most, each with the mutation that must break it:

- axis / X sign, in three arms (drop the negation; apply the node
  matrix; apply GLOBAL_SCALE)
- winding (drop the reversal - this is the invisible-mill bug)
- normal X sign SEPARATELY from position X, because the position pin
  does not catch an inside-out lighting flip
- ground contact through the REAL layoutRmbBlock
- fsJson dialect, asserting BOTH that fsParse succeeds and that
  JSON.parse of the same string throws - the paired assertion is the
  anti-restatement guard, so "let's just use JSON.parse" fails loudly
- ground unflatten with an ASYMMETRIC fixture (`x + y*17`), because a
  symmetric tilemap passes under transposition and is not a pin
- array-over-header, override-before-load, hook-above-the-null-cache
- cache key width (two climates, different vertex counts)
- prefab BOTH SHAPES - write this one first
- matName vs textureEntry deliberately differing on `332_0`
- manifest honoured (or 11511 gets a windmill)
- doctrine: `git ls-files` matches nothing ending .dae/.prefab/.mat/
  .dfmod and no *.RMB.json. Returns 0 today; the pin is what keeps it 0
  once contributors debug against a real mod folder.

## The asset problem

Mod bytes live only in the player's IndexedDB. What gets committed is
PARSERS - repo code that reads formats - never mod content. The doctrine
pin enforces it mechanically.

One divergence to write down plainly: DFU has NO loose-file path for
meshes (MeshReplacement.cs is ModManager.TryGetAsset only, with no
File.Exists branch anywhere). The port reads source assets directly
instead. **The naming is 1:1; the transport is not.**

## Open

- First move (a) has not been run - it needs ARENA2_PATH and decides
  whether this ships as one feature or two.
- Whether the BSA record name equals the JSON filename stem
  (`FARMAA00.RMB`) is unconfirmed - no BLOCKS.BSA in session. DFU keys on
  GetBlockName(block) + ".json" so it should. Check on the first real run.
- The road-system deep audit launched before this study was still
  running when the session paused; its findings are unreported.
