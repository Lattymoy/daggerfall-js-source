# AUDIT FOREST1 + GRASS-LIT (2026-10-01)

Mac: *"audit this and ensure it's as detailed as possible. In addition to this, I want to drastically improve the
grass texture that isn't super dark and blends well into the terrain."*

Two pieces of work on `claude/new-session-0j5ivw`, after FOREST1 (Real forests, commit 490e8f4a) landed there:

1. **AUDIT FOREST1.** A second, read-only lens over the forest branch (an independent reviewer: frames, every
   consumer of the nature flats, determinism, edge cases, cost, test strength, the docs' claims), then every finding
   paid, pinned and mutation-checked. The real game data was used for the first time - the branch had shipped with
   synthetic terrain only.
2. **GRASS-LIT.** The grass's colour and light, measured against the real ground tiles and the real light, its five
   causes of darkness found and fixed, and the result photographed on the real game in every condition.

## How it was verified

- **The real game data, outside the repo.** Daggerfall's ARENA2 (the freeware game files, from the Daggerfall Unity
  bundle the Internet Archive holds) was unpacked into the session's scratch directory - never the tree
  (Port-Doctrine: the data and any render of it stay out of the repository). Every number below marked *real* comes
  from it.
- **`tools/grassLookProbe.mjs`** boots the real streaming world headless (SwiftShader) at a one-square view radius,
  stands the camera on a field (`__grassSpot`, shot mode only), and photographs it - optionally several grass palettes
  per boot (`__grassTones`). Before/after sets were taken from a worktree of the branch's head and from the work, at
  noon, 8:00, 18:40, 23:30, overcast, rain, the rain season, the classic lighting lane and the smooth style.
- **`tools/grassLightProbe.mjs`** walks the day's real light (world/worldClock.js, the weather's own scales) through
  the terrain's formula and the grass's, both lanes, five climates, and prints the colours and their ratio. No GPU.
- **`test/glsl.mjs`** runs the compiled grass fragment stage in JS, so the new law is pinned on the shader's own text
  against TERRAIN_FS's and EL_TERRAIN_FS's formulas.
- **Mutation.** `tools/mutants/forest1.json` (27) and `tools/mutants/grasslit.json` (19), all dead.

## AUDIT FOREST1 - the findings, ranked as the lens ranked them

| # | Finding | Evidence | Paid |
|---|---|---|---|
| F1 | **Every World of Daggerfall rock field and mountain became a "hidden place".** The kernel gave every pick `hide: true`; 206,964 of the mod's 222,816 instances (93%) are `Rocks_*` / `Mountain_*`, whose rects are anchors, not footprints - a woods ring off to one side of a rock field, a 9x9 clearing at its anchor, and groves growing through boulder meshes (nature was never tested against the rock pieces). Contradicted the Features note. | `terrainGen.js` pois; the packs scanned | The host marks each pick (`hide: !wodPiecewise(prefabName)`; `worldOfDaggerfall.js` hands the prefab's name on the pick); scenery is no place. A wood's flats keep out of the rock pieces (`insideRocks(pixelRocks, ...)` in the nature loop, forest mode - DFU's own scatter with the switch off stays as DFU lays it). |
| F2 | **The cost was understated.** "About as many flats as DFU" was a global average from synthetic terrain, and the elevation scale's omission was unsaid. | the lens's benchmark | Measured on the *real* WOODS.WLD, 675 land pixels: flats 1,856 vs DFU 1,900; Trees 1,274 vs 530 (2.4x), at most 7,664 vs 2,296; layout 1.66 ms vs 1.31. The forest density fell from 0.7 to 0.5 a grass tile, the field is sampled on a 4-tile world lattice (twenty-seven times fewer field samples), and the ledger and the patch notes say the cost and the dial. |
| F3 | **The patch notes' Logging claim was false.** `standTrees` takes the flat nearest each law point; plains keep lone trees, so 55% of 420 simulated nodes stood on the plains. | `treeHost.js` standTrees | A Tree flat carries its tile's `wood`; the day's trees stand at the woods' own (`FOREST.woods`, 0.5) wherever the pixel has any, the lone trees only where it has none. DFU's scatter carries no `wood` and is unchanged. |
| F4 | **Eight surviving mutants** - the location dropped from the places, the hidden flag forced, a fixed z inset, no undergrowth, no steepness test, the field shifted a tile, the ring's max-exclusive edge, the town's `near`. | the lens ran them | Each pinned: the kernel with a location (woods round a dungeon, fields round a town), both insets, the woods' undergrowth share, a fifty-degree slope, every flat's `wood` equal to the field plus the pull exactly, the ring's edge tile, the town's ease, and the numbers as literals (two more survivors the first pass found: the measurements read `FOREST` itself). 27 mutants, all dead. |
| F5 | **The Oblivion Gate's clearing kept no nature.** `GATE_CLEAR_M` refused WoD pieces only: ~31 trees inside the clearing in a wood (5-11 under DFU), through the plinth and the Sigil Broker. | `gateClearance.js` | The nature loop keeps the gate's clearing (`pointNearGate(gateClear, ...)`, World of Daggerfall's flats' own margin) in BOTH modes - the gate is the port's own feature, and the sweep already rebuilds a pixel when the gate's day turns. |
| F6 | **Peers could disagree on a whole pixel's forest.** One RNG stream walked the pixel: a place one peer stands and another does not (a spawned dungeon's expiry runs on the character's own clock) shifted every tile after it. `?forests=off` worked online. | `layoutForests` | Every tile draws its own dice off its WORLD tile (`tileDraw`, murmur3's finaliser over three words) - a difference moves only the flats about that place (pinned: everything past a place's reach is identical with and without it). The kill door is offline's alone. The steepness decision is on the gradient (no arctangent). |
| F7 | **Camps reached past their clearing.** The clearing was the rect plus four tiles; `BanditCamp_04`'s objects reach seven tiles south of a three-tile rect, `Nature_01`'s six. | the prefabs | A site's FOOTPRINT is the clearing: its rect and every object of it grown by the site margin (`wodSiteFootprint`, beside `wodSiteClear`, which reads the objects the same way). |
| F8 | **Trees stood on tracks over dirt** (a track over dirt leaves the tile's record dirt, so the record cannot say so); a stale cite (`roadPainter.js` into `terrainNature.js`); the online patch note ignored the kill door. | `roadPainter.js` TRACK_TILES | The kernel hands the road painter's own `paths` mask to the forest, which keeps off it; the cite re-aimed (`:146 and :200`); the door fixed (F6). VERGE1 (2026-10-07, `03-World/Roads.md`): the fix never held - the painter wrote nothing for a track over dirt (`TRACK_TILES`' NO_CHANGE) and so marked nothing; it marks the track now, unwritten, and the woods keep off it. |

**Answered OK by the lens** (with evidence): the World of Daggerfall rect and the DFU location rect are in the
tilemap's frame (x the column, y the row; checked against the prefabs' object extents); the field's world mapping is
continuous east and north (pixel `py` stands at z = -py x 819.2, tile y runs north); the worker carries the job whole;
`perlinNoise` is floor and arithmetic only; seasons and Seasons of the Iliac Bay read records by index on the summer
archive; the far ring, the Overworld and the server never read nature; herbs and veins (`natureStandsAt`) are
unchanged.

## GRASS-LIT - why the grass was dark, measured

The temperate grass tile (TEXTURE.302, its grass base) averages **(52, 76, 42)** - *real*. Its texels are
low-contrast: the dark third is 0.85x the mean, the light third 1.16x, the brightest tenth 1.27x (the five grass
climates' bases averaged, `GRASS_PALETTE`). Five causes stacked:

1. **A fixed olive the ground is not.** The blade's middle was (33, 51, 18) - two thirds as bright as the tile and
   twice as yellow; its root the tile at 0.62, shaded again by 0.42 of the ambient; its tip a yellow the tile has
   nowhere in it.
2. **The weather, twice.** The lab's `LAB_DIM` (rain 0.60, a storm 0.46) rode on a light already weathered
   (`exteriorAmbient` takes the weather's scale squared, the sun once).
3. **No lighting lane.** Under Enhanced Lighting (the enhanced skin's default) the ground is decoded, lit linear,
   exposed (1.4 x the eye's adaptation), tonemapped and encoded; the grass ran none of it.
4. **Light the ground had and the grass did not.** The cloud deck's shadow, the sun map (a tree's shade - the forests
   made this matter), and the player-following light (R12).
5. **The ambient occlusion.** The air pass reads its AO off the frame's depth at the resolve; the grass writes that
   depth, so every blade read as a crease and the AO's 0.75 resolve darkened the field and the ground round each tuft.
   Proven by photograph: with all four tones at the ground's own colour, the tufts still drew 10-15% darker than the
   ground - and with `?air=off`, or with the fix, they vanished into it.

`tools/grassLightProbe.mjs`, the middle of a blade against its ground, before -> after (classic lane):

| | noon | 9:00 | 18:30 | overcast | rain | storm |
|---|---|---|---|---|---|---|
| woodland | 0.62x -> 1.18x | 0.61x -> 1.17x | 0.58x -> 1.16x | 0.45x -> 1.18x | 0.37x -> 1.18x | 0.28x -> 1.17x |
| swamp | 0.74x -> 1.18x | 0.73x -> 1.17x | 0.69x -> 1.15x | 0.53x -> 1.18x | 0.44x -> 1.18x | 0.33x -> 1.17x |

(The *before* omits cause 5, which darkened it further on the enhanced lane.)

**The fix** (`render/labGrass.js` GRASSLIT_VS_EDITS / GRASSLIT_FS_EDITS, the fourth declared list over the lab's
text; `render/airPass.js` snapshotAoDepth; `render/enhancedLighting.js` EL_CODEC_GLSL factored out byte for byte;
`scenes/world.js` the frame's light and the AO copy): the tuft's four tones are ratios of the ground's own mean
under each blade (`GRASS_TONES`: the root 0.92x - it melts into the ground - then 1.18-1.24x, 1.38-1.50x and the
highlight 1.56-1.70x, a shade greener, as a sunlit blade is lighter than the soil under it); the light is the
terrain's, on whichever lane is installed, with the deck and the sun map read once at the root (lifted 0.2 off the
ground's own depth, in each triangle's provoking vertex alone) and R12; no second weather dim; past 0.12-0.6 of the range the colour gives way to the ground's
mean; and the AO reads a copy of the depth taken just before the grass draws, so the grass neither takes nor casts
occlusion and still hides, and is hidden, by depth. Tones were chosen by photographing candidates on the real game
(`__grassTones`): the ground's own palette alone made the tufts all but invisible; brighter tips past it read as grass.

## GRASS-LIT2 (2026-10-02) - the not-done list, paid

Mac: *"Tackle the not done."* GRASS-LIT's report left five things unpaid; four were code and one a photograph. The
branch first took main in (`5f719712`), which fixed the nine suite failures it had inherited from its base - they
failed identically on the base before FOREST1, and pass on main.

| Was | Now | Evidence |
|---|---|---|
| **Lanterns and torches did not light the grass.** At night by a fire the ground glowed and the grass on it did not: 0.21-0.52x the lit ground beside a lantern. | The vertex stage walks the frame's own light list at the root - the ground's falloff on each lane (TERRAIN_FS's `(1 - d/r)^2`, the lane's `elAttenuation` as `EL_ATTEN_GLSL`), each light's shadow map where it has one, once a triangle (`vPoint`, flat). 1.06-1.21x the lit ground. | `test/grasslit2.test.js` runs the compiled vertex stage against both terrain formulas, with a map and without; `grassLightProbe` prints it; the real game at 23:30, a lantern put first in the frame's own list on a field: before, its pool lit the ground and the tufts stood dark in it; after, they are lit with it. |
| **A blade stood straight up on any slope.** A 30-degree hillside facing away from the 9:00 sun: the ground darkened, the field on it did not (1.34-1.43x the ground). | A blade is lit about the ground's own normal - the drawn mesh's (`surfaceNormalAt`: the near grid's vertex normals over the triangle under the root) - packed into the height lane's spare bits (the height's six, the normal's x and z five each, dithered). No byte more a blade (a near pixel keeps its grid's normals, 195 KiB, while the field is on). 1.04-1.18x, as on the level. | The normal against the real mesh to 1e-6; the pack's dither unbiased to 0.002; the decode and lambert on the compiled stage; `grassLightProbe`'s hillside rows. Not photographed - see the correction below. |
| **A texture mod's ground** drew colours the grass did not take. | The record means come off the tile set that is drawn - the mod's, where one dresses the archive; a big tile read on an odd step. | Pinned on the host's own text and on a 1024-square tile with a two-texel pattern. No texture mod is in the game data here, so this one is not photographed. |
| **The classic lane** drew the field brighter and greener than the default lane: of the near field's pixels, 9.9% stood over 1.2x the ground beside them and 7.2% over 1.3x, against the default lane's 6.4% and 4.9%. | Its own tones, `GRASS_TONES_CLASSIC`, calibrated by photographing four palettes on the real game: 7.8% and 4.9% in the final build's shot, the tufts a shade less green than the default lane's. A per-channel match of the default lane's mean colours was tried first and left 9.1% and 6.3% - the lane's eye and curve press the middle tones harder than its mean says. | The tones pinned as literals and held no brighter and no greener than the default lane's per-channel picture; the classic lane at noon before and after, the default lane beside it. The classic frame stays brighter overall: its ground is too. |
| **The aerial forest shot** showed the fields beside Daggerfall city, not a wood. | Photographed from the air round The Citadel of Gaersley - a keep whose whole map pixel is forest under the field (found by scanning MAPS.BSA's woodland dungeons) - with Real forests on and off: a closed wood against Daggerfall's even scatter. | The real game, `tools/grassLookProbe.mjs`; `__forestSpot` (new) names the deepest wood in the built pixels. |

`tools/mutants/grasslit2.json`: 25 mutants, all dead; with `grasslit.json`'s 19 (three re-aimed at the lines this
changed), 44 of 44.

**A correction to GRASS-LIT's photographs.** `tools/grassLookProbe.mjs` stood the camera on a field with `__pose`,
and in shot mode the pose turned the eye but did not move it across the ground: its x and z, read off the terrain
program's `uView` and `renderer._camPos`, stayed at the pixel's corner - 48 m from the posed spot in the run that
found it, and in another, posed at (27.6, 4.4), at (-1.0, -1.3), 29 m off. GRASS-LIT's before/after pairs were taken
from that corner (both halves of each pair from the same place, so the comparisons stand), not from the field
`__grassSpot` named. Found when a lantern posed beside the field lit nothing. GRASS-LIT2's lantern was photographed
from over the corner, looking at it; the probe's header says so. Why is not run down. (AUDIT GRASS-LIT2: this
paragraph first blamed FIX-C's first stand and said `&fly` let the pose set the height. Neither is the code: shot mode
never walks, so `__pose` writes `cam.pos` the same way with `&fly` or without, and FIX-C's stand is the walk's alone.
Something after the pose takes the eye back.)

## AUDIT GRASS-LIT2 (2026-10-02) - three lenses over the not-done list

Mac: *"Audit this."* Three read-only reviewers over `550b23bc`, each its own lens: the shader (the vertex stage's
new code, its uniforms and its cost), the host (world.js's normals, means and hooks, the draw's uploads), and the
tests and docs (every new law mutated, every doc claim read against the code). Every finding was re-checked against
the code before it was paid.

| # | Found | Paid |
|---|---|---|
| A1 | **Every provoking vertex walked all 48 lanterns**, in range or not - a field drawn in a lit town paid the loop on every blade, and its cost had never been measured. | A cell walks its own: before each cell `_cellLights` picks the lights whose reach meets its box (the stage's own `d >= range` cut, at the box), nearest first, at most `GRASS_CELL_LIGHTS` (8, a tie to the earlier light), and uploads `uPointCount` / `uPointIdx` only when the list changes. The same picture: a lantern's pool on the real game measured 21.7 against 21.6 before. |
| A2 | **A frame without shadows left the last frame's caster slots on the program** - latent: `uCasterOf` and the point params are uniforms, they outlive the frame that set them, and a stale slot whose map answers black puts a lantern out. | The no-shadow draw uploads every light as having no caster (all -1) and every slot off. Pinned on a recording GL, and on the stage: a stale slot zeroes the lantern, the reset lights it. |
| A3 | **A zero word read as the steepest slope.** A pad, or a cleared slot, is all zero; codes 0 and 0 decoded to a lean of -0.75 on both axes. | The two slope codes are stored XOR 15: zero is level, in the pack and the stage. |
| A4 | **A NaN normal packed as the steepest lean** (NaN shifts to code 0). | A normal that is not finite packs level. |
| A5 | **The mean read more than its cap** (`floor(n / cap) | 1` read a 256 x 384 tile whole, 98,304 texels), and the uniform count the docs quoted (210) had counted six vectors out of a comment. | `ceil(n / cap) | 1`; the count is taken off the code: 212 with the cell list (224 if a driver keeps the two const face tables as uniforms), of 256. |
| A6 | The lab's own stage still decodes the old height lane - the probe's lab page draws it, not the game. | Its docstring says so. |
| B1 | **Every stride-1 pixel kept its grid's normals** (~200 KB each) with the lab field off. | Kept only when the field is on, at build and at a promotion. |
| B2 | **A texture mod's tile set was asked for twice** - once for the upload, again for the means. | The means are taken off the layers the upload took (`groundDrawnMeans`). |
| B5 | The shot hooks: a zero `r` never left either hook's loop; `__grassSpot`'s hillside looked along the slope, not down it, and read its normal at the near edge. | `r` at least 1; the yaw down the slope; the normal at the far half's middle. |
| C | **The tests walked past 24 of the reviewer's 35 mutants** of GRASS-LIT2's code (two of the 24 on lines A1 and A5 have since rewritten; one is equivalent), and two more after (a mask widened into the height's bits, and TERRAIN_FS's falloff). The helper fed the stage its word as a double, so the `+ 0.5` that rounds the word was never tested - a GPU that normalises a unorm16 by its reciprocal in float32 hands 512 of the 65,536 words over a hair under themselves (a correctly rounded normalise, none); the dither's constants, the hold to the span, the height's 63 steps, the out written before the loop, the lantern's lambert about the leaning blade, the draw's cut to the shorter list, the JS twin's normal, moon and lantern colours, a sliced rim cell's slope, the normal's low-edge clamp, the host's normals guard and the hooks' choices were all unpinned; and the ground's lantern formulas the grass is held to were the test's own copy, so a change to TERRAIN_FS's falloff left the grass suite green. | Eleven tests (C1-C11 in `test/grasslit2.test.js`): the word as such a GPU hands it, R2 by its derivation with the two axes independent, the twin against both stages end to end, a walk's sliced cells, the hooks and the slope closure lifted off world.js's text and run, the ground's formulas read off the terrain programs' own text, and the probes' before column and palettes. |
| D | **Claims.** The probe numbers the docs quoted (a lantern 0.21-0.51x -> 1.16-1.21x, a hillside 1.34-1.40x -> 1.14-1.18x) were an intermediate build's - the classic tones then were the per-channel match later dropped; and the light probe's classic "was" column painted the old blade in the lane's new tones, when before GRASS-LIT2 the classic lane drew in GRASS_TONES. The look probe's palettes reached only the default lane, so on the classic lane a palette variant changed nothing. "No byte more a blade" was true of the GPU lane and silent on the 195 KiB of normals a near pixel now keeps. The photograph correction blamed FIX-C's first stand and `&fly`, and the code says neither. Two wording slips: a test comment calling the classic lane's tones "the shipped tones", and the Testing row calling every classic tone darker than the shipped (the root is a hundredth over). | `grassLit` takes an optional `tones`, the probe's classic "was" takes GRASS_TONES, and the docs quote the probe as it stands: a lantern 0.21-0.52x -> 1.06-1.21x, a hillside 1.34-1.43x -> 1.04-1.18x (both lanes). The look probe hands a palette to the lane it boots. The normals' memory is stated where "no byte more" is. The correction says what was seen and what the code rules out, and that the cause is not run down. The two slips mended. |

`tools/mutants/grasslit2.json` is 76 records: GRASS-LIT2's 25 (one re-aimed at `grassLit`'s `tones`), the fixes' 21
(A1-B5), and the tests' and the claims' own 30 (C, D) - 75 dead and one recorded equivalent (`uLane` is uploaded as exactly 0 or 1, so `> 0.5` and `>= 0.5` are one
branch). With `grasslit.json`'s 19, 94 of 95, the one the equivalent.

## Known and not paid

- **The far rings draw every Tree.** Forests carry 2.4x DFU's Trees on average; the Features row is the dial.
- **SwiftShader's milliseconds are not a player's.** The probe's frames prove the picture, not the frame rate. The
  lanterns' loop runs only in the provoking vertex and over the cell's own lights, eight at most (AUDIT GRASS-LIT2
  A1); its cost on a real GPU is unmeasured.
- **The grass's lanterns have no contact shadows and no glint.** The terrain's lantern without a map takes a
  screen-space contact shadow (EL8) and a specular glint; the grass takes the diffuse and the map's shadow alone.
- **A lantern is read at the root.** One value a blade, as the sun is; a torch held over a tall blade lights its tip
  no more than its root.
