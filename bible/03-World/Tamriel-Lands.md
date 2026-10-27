# The lands past the Bay (TESA-LANDS, 2026-10-27)

**The owner (2026-10-27), of the Tamriel arc: "Ensuring each region recieves proper landscape details and textures (minus
cyrodil and valenwood) and refined detail. Research these regions online to understand and make it the best that it can
be. Dont break anything".**

**What it named.** TESA-BIOME (`03-World/Tamriel-Biomes.md`) split every province past the Bay into the zones its lore
names and laid each on one of Daggerfall's ten climates; TAMRIEL-RELIEF and BREATHTAKER gave each its heights. What a zone
LOOKED like was still its climate's: the Ashlands wore the Wrothgarians' green turf and their pines, the Frozen Coast the
same, Craglorn and the Abecean Coast one sand, Summerset's Vine Coast the desert's cacti on the desert's sand. Cyrodiil has
the Jungle of Bantha (`03-World/Bantha-Jungle.md`) and Valenwood its graht-oaks (`03-World/Graht-Oaks.md`) - the owner's
"minus" - and Black Marsh's Blackwood is one country with Cyrodiil's across the border (TESA-BIOME's recorded choice). The
other thirty-three zones of Skyrim, High Rock, Hammerfell, Summerset, Elsweyr, Black Marsh and Morrowind each take here
their own GROUND (its colours, laid over the set the game draws), their own GROWTH (Daggerfall's own nature flats, any
climate's, in the zone's own share of woods) and their own LANDMARKS (the land's features no flat stands: Morrowind's
giant fungi, the Hist, the reed beds, the rock spires, Summerset's vineyards and groves), and the far views read the
same. Each zone's lore line and its sources are below; the table is `world/tamriel/tamrielLands.js` (LANDS).

**The switch.** The Features row `tamriel-lands` (Lands of Tamriel, World) on the enhanced skin, on by default, FORCED ON
ONLINE (a zone's flats are where Logging's trees stand and its landmarks turn the player: a room agrees on its ground -
realForestsOn's shape); `?lands=off` the kill door, offline (`systems/landsSwitch.js` tamrielLandsOn, re-exported by
`scenes/shared.js`). The world reads it once, as it mounts. Off - and on the classic skin - every zone wears its
climate's ground and flats as TESA-BIOME laid them, byte for byte (an archive's own ground set, the climate's layout, no
landmark, the far views' climate book).

## The ground: a zone's dress (`world/tamriel/groundDress.js`)

Daggerfall grows its ground from four sets of 56 tiles (TEXTURE.002 the desert's, .102 the mountains', .302 the
temperate's, .402 the swamp's). A DRESS is the zone's own materials laid over the set as it is drawn - the classic records,
or the texture pack worn over them (Vanilla Enhanced by default, Sands of the Alik'r on the desert's) - so the zone keeps
the set's grain, its tiles' shapes and its transitions, and takes its own colours.

- **The classes.** DFU's four tile bases (0 water, 1 dirt, 2 grass, 3 stone) and the town's paving (46, its edges 47 and
  55). A class's PROTOTYPE is its solid record in THIS set (`setPrototypes`: its mean colour, its luminance's mean and
  spread), so a pack that repaints the set is read on its own colours. A solid record is its own class whole; a
  transition's texels share their classes softly - a Gaussian of their colour's distance to each prototype, its width
  half the nearest two prototypes' distance, then blurred over 4.5% of the record (`transitionShares`): a transition's
  shape is half a tile, a class's grain a texel or two, so a texel alone cannot say which side it stands on and its
  neighbourhood can.
- **The materials.** A dressed class is a gradient map: its RAMP (four colours dark to light, the zone's) read where the
  texel's luminance falls once carried over - its class's mean at the ramp's middle, every texel as far over or under it,
  in proportion, as it stands over or under its class's mean (`contrast` 1: the set's own light and dark, never the
  ramp's whole span laid over a quiet tile), past either end the end colour scaled on within 0.55-1.6 - with 22% of the
  texel's own colour noise kept, so the set's mottle reads through. FLECKS (pumice in ash, tundra cotton, petals in a
  meadow, the Grazelands' stoneflower) are cells of one texel at a 128-texel record on a hash of the cell.
- **Its light.** The ramps are the research's colours, sampled off the games' screenshots - LIT - and a ground set is an
  albedo the renderer lights: measured, the classic grass's luminance is 65 (TEXTURE.302) and 62 (.102) against the
  sampled grasses' 99, the desert's sand 145 against 196 - two thirds, so a ramp is laid at 0.7 (`albedo`); a pack's set
  at its land's exposure against the classic set's again (`setExposure` - Vanilla Enhanced's .102 0.92); and the
  screenshots' colours, hazed by distance and light, are moved 1.25 further from their own grey (`vivid`), so a dressed
  ground stands as saturated as the set's own.
- **Never dressed:** water (the puddles and the shores keep the set's water and its alpha, which carries their mask -
  `world/puddleMask.js`), the paving (the roads stay the town's) and every winter set (the snow is the snow's).
- **Its base.** A zone whose climate's set is the wrong cloth for its land names another summer set to dress: the Vine
  Coast, the High Savannah and the Pellitine are grass on TEXTURE.302, not the desert's sand. The Alik'r names no dress at
  all - its set is the Sands of the Alik'r pack's own, the lore's dune sea.
- **Its blades.** A zone says whether the enhanced grass grows on it (`blades`): none on the Frozen Coast's shingle, the
  High Peaks' snowfields, the Ashlands' ash, Red Mountain's cinder, the Velothi's rock or the desert's dunes.

**Its door** (`scenes/groundSets.js`). A pixel's ground set is named by the build (`scenes/pixelBuild.js` - its own and
its eight neighbours', each its own zone's: `tamrielLands.js` landGroundSet, `lands:<zone>:<archive>`) and the ground
sets' module reads such a key as its archive read as ever, its drawn layers dressed (`dressLayersSteps`) and every map the
grass and the water read kept under the key - its grass records (none where the zone grows no blades), its floor's, its
puddles' (the archive's own: the dress keeps the alpha whole), its colours. An archive's own key makes what it made.
**Its cost:** a 256-texel set (Vanilla Enhanced) dressed in 1.2-1.5 s of a laptop core on its first pixel, never in one
piece - a band of 32 rows of a 256-texel record a step, a transition's shares a band and a blur a step (the box blur a
running sum), the build's breather between (`world/puddleMask.js` stepsBreathing); the longest step measured 22 ms (its
first, the prototypes), the rest under 13. Once a zone and season; the renderer's tile cache keeps it.

## The growth: a zone's recipe (`world/terrain/terrainNature.js` layoutLands)

A zone's `flora` lays its flats by FOREST1's law (DFU's tests on the tile, the woods' field, the places' pull, each tile's
own dice), with the zone's numbers in FOREST1's stead:

- **Its woods' share of the land** (`woods`): the field's edge at its (1 - woods) quantile, FOREST1's own width - the
  field's quantiles measured over 400,000 world tiles of the continent's frame (`tamrielLands.js` FOREST_QUANTILES):
  the Pinewoods 80% woods, the Tenmar 78%, the Ashlands two in a hundred.
- **Its flats, any climate's**: a wood's tile stands one of its `trees`, a plain's one of its `cover`, each an [archive,
  record, weight] of Daggerfall's own nature flats - the Mountains' pines in the Pinewoods, the swamp's black basalt
  stacks and the desert's dry trama in the Ashlands, the rainforest's twisted and vine-hung trees and its palms in the
  Tenmar - and every flat carries its archive (ECOTONE1's own seam: the build reads each flat's own, its season and its
  Low Poly tree its own).
- **Its rates** (`treeRate`, `coverRate`) on FOREST1's chances, and its ground's shares by DFU's tile record.
- **Its border.** With the Blended climates row a pixel's tiles within the ecotone's reach of a neighbour of another zone
  are owned as ECOTONE1 owns them (`world/ecotone.js` ecotoneOwner - the same border the ground draws), each laid by its
  owner's recipe; a zone the table does not name keeps its climate's law on its tiles, and a Bay pixel's neighbour off
  the Bay wears the pixel's own (`tamrielGround.js` climateNeighbourIn).

**The Tenmar and Murkmire** are jungle in the lore, and stay off the Bantha's storeys - the owner's "the unique jungle
biome we developed" is Cyrodiil's (TESA-BIOME). They take Daggerfall's own jungle instead, grown close: the Tenmar the
rainforest's twisted, vine-hung and rain trees and its palms over ferns, bulb plants and flowering spikes (78% woods) with
wild sugarcane on its plains; Murkmire the swamp's mangroves and moss-hung trees among the rainforest's tall trees, reeds
at every water's edge and a Hist deep in its woods.

## The landmarks (`world/lands/`)

The land's own features no flat of Daggerfall's stands - procedural low-poly meshes of the port's own, every vertex a
function of its kind's and variant's seed (`landPropMesh.js`), flat-shaded, wound out (the graht-oaks' law), in three
submeshes (body, crown, detail) at three LODs:

| Kind | Variants | What the lore names |
|---|---|---|
| parasol | an emperor parasol (a stalk 11.5-15 m, a cap 11-15 m across, its gills under it); a grove of three from one foot; a grown pod on its stalk; the xylaria's cluster of dark-tipped spikes | the Ascadian Isles' "large mushroom-like plants not unlike trees" (UESP, Morrowind:Ascadian_Isles), the Telvanni's grown pods, Deshaan's fungal forests and its glowstalks, the Ashlands' xylaria (Lore:Flora_G) |
| spire | a pillar or obelisk; a hoodoo under its caprock; a crag and its two lumps; a standing stone; a termite mound | the Ashlands' "clusters of stone obelisks", the Alik'r's and Anequina's sandstone hoodoos and pillars, the Reach's crags, the Bitter Coast's menhirs, the High Savannah's termite mounds |
| hist | a gnarled bulging trunk on its root flares (6-9 m out), its limbs and spreading crown, moss hung from them | "giant spore trees growing in the innermost swamps" (Lore:Hist) |
| reeds | a clump of reeds, their heads (cattails); sugarcane; a low rush | the Shadowfen's "endless field of reeds that reached up to his chin" (The Argonian Account), Elsweyr's moon-sugar cane |
| vines | a vineyard row's length (6.4 m - a tile), its posts, its trellised foliage hung with grapes | Summerset's "rows of vineyards" (Lore:Alinor_(city)) |
| grove | a round tree (cherry), a tall (ginkgo, the Rift's aspen), a spreading (maple) | the Vine Coast's pink cherry, gold ginkgo and crimson maple, Auridon's cherries, the Rift's white-barked golden aspens, Stonefalls' orange and purple thorny cherry |

**The pictures** (`render/landPropArt.js`): the port's own, painted from value noise that wraps (render/grahtOakArt.js's
noise and mip chain, one home) - a stalk's fibres, a cap's blotches and spots, its gills, a rock's strata and cracks, a
lichened top, furrowed bark, a smooth rind with its lenticels, a crown's clumps, a leaf spray, hung moss: GREY, so one
picture serves every look (a look's colour laid over the picture's mean); the reeds and the grapes in their own colours.
**The looks** (`landProps.js` LAND_LOOKS): a kind's variants, its scale and its colours, by name - `ascadian` (a pale stalk,
an olive-brown cap), `deshaan` (dragon-scale violet caps, gills aglow), `glowstalk` (a tree-sized glowing orange pod),
`telvanni` (the grown purple pods), `xylaria`; the spires' `frost` (a snow-white top), `lichen`, `reachstone`, `granite`,
`striated`, `flint`, `redstone`, `limestone`, `honey`, `sandstone`, `mound`, `karst` (a green top), `basalt`, `scoria`,
`menhir` (a mossed top); `hist`; `reed`, `cane`; `vine`; `cherry`, `ginkgo`, `maple`, `aspen`, `ember`, `jester`.

**Where they stand** (`landProps.js` landSites, laid by the terrain's kernel beside the flats - `terrainNature.js`
layoutLandProps): a site a cell of the kind's own size on the WORLD's lattice (the Hist 16 tiles, a spire 8, a parasol
4, a grove's tree 2, a reed clump 1 - each a power of two dividing a pixel), somewhere in the cell's middle, its chance
the zone's `rate` times its woods' share there (`woods`), its plains' (`plains`), one (`any`) or the water's edge
(`wet` - a tile touching water); a `patch` gathers its sites in blocks of 16 tiles (the Rift's aspen stands). The vines
are fields, not sites: a vineyard a block of 8 x 8 tiles drawn whole, two rows a tile along the world's x, at scale 1 so
each row meets the next. Every draw a hash of the site's world tile - the same landmark on every client, the worker and
the main thread. A site's zone is its tile's owner's (the ecotone's, as the flats'), so a border between two zones is
one seam. Its foot (a stalk, a column, a trunk; the Hist's roots) stands wholly on land - no water, no paving, no road or
track, no place's rect or clearing, nothing past its kind's steepest (a spire 40 degrees, the vines 14), over the beach
(the reeds alone go to the water's edge, never into open water) - at the lowest ground under it, sunk a little; the
larger kinds stand first and the smaller keep off them; the pixel's flats keep off every foot and every vineyard's tile
(`flatsOffProps`). A pixel lays its landmarks in a few milliseconds of the kernel (its kinds' measures made once a
worker).

**Their bodies** (`landPropBodies`, PROP-BODIES' shape): a parasol's stalk, a spire's column, a Hist's trunk, a grove
tree's trunk - the player walks round them, on foot or mounted, and through the reeds and between the vines' rows.
**Their host** (`scenes/landPropsHost.js` - HOST-SPLIT: the trees' host makes it with the row and frames it, the pixel's
build stands a pixel's set off the gate's clearing and the rocks and files its bodies; no line of bootWorld's): the GPU
made when the first landmark is framed, on the stream's slice clock (a mesh a breath, a picture a breath - every kind's
every variant at every LOD in Low Poly Trees' own buffers), a run a look's variant and LOD; the frame culls a pixel's
set whole past its kinds' farthest, then each landmark to the view, the fog's reach and its kind's own `far` (reeds 260 m,
vines 420, a grove 1.2 km, a parasol 1.5, a spire 2.2, a Hist 2.6), at its LOD, on the renderer's fourth tree slot - so
it is lit, fogged, hazed and lantern-lit as every 3D tree under either lane - and the nearest 16 bodied ones cast into
the sun's maps. **The four hosts:** `scenes/world.js` WIRED through the trees' host and the pixel's build;
`scenes/exterior.js`, `scenes/worldModes.js`, `scenes/dungeonContext.js` FLAGGED - none stands the wilderness past the Bay.

## The far views (`render/farFlora.js`, `world/terrain/floraCover.js`, `render/farTrees.js`)

FAR-FLORA's book answered a climate; with the row it answers a map pixel's zone: its woods (`landsFloraSpec` - the zone's
share expected at FOREST1's wood, the field's own distribution read at 4,096 quantiles and averaged in 32 bins of
FOREST1's, so the middle ring's packed wood reads the zone's woods exactly where FOREST1's edge is crossed and its mean
over each side elsewhere; afar its own share, never the climates' 45%), its Trees' art (`landTreeArt` - its recipe's
trees by their weights) and its ground (`landGroundArt` - the drawn tiles in the zone's dress at the pack's exposure, as
the near ground is dressed). The far ring, the middle ring and the far field ask it at each vertex's pixel. The band past
the streamed grid (FAR-TREES) asks the worker with the row: a pixel past the Bay lays its zone's recipe, and a tree of an
archive not the pixel's answers `archive x 256 + record` (`bandTreeCode`), each read in its own archive's art. So the
Ashlands' horizon is grey ash under a few dead trees, the Pinewoods' dark under its pines.

## The zones

Each zone's lore line is LANDS' own (`lore`); its sources the page's Sources, below.

| Zone | Climate (its sets) | Ground: dirt / grass / stone (the ramps' middles) | Blades | Woods: share, its Trees' climates | Landmarks |
|---|---|---|---|---|---|
| the Frozen Coast (Skyrim) | Mountain (510, 102) | `#7d8280` / `#b3bbb8` / `#94979b` | no | 6%, mountain | spire (frost; plains) |
| the Tundra Plains (Skyrim) | MountainWoods (506, 102) | `#8a7a5e` / `#a39a62` / `#a2a39d` | yes | 6%, mountain | spire (lichen; plains); reeds (reed; wet) |
| the Pinewoods (Skyrim) | MountainWoods (506, 102) | `#756247` / `#676b46` / `#8e908a` | yes | 80%, mountain | grove (aspen; woods, in stands) |
| the Reach (Skyrim) | Mountain (510, 102) | `#8c7c68` / `#9a8a60` / `#9a8e80` | yes | 12%, mountain | spire (reachstone; any) |
| the High Peaks (Skyrim) | Mountain (510, 102) | `#9c9ea0` / `#dbe3ea` / `#7b7e81` | no | 3%, mountain | spire (granite; any) |
| the Wrothgarian Mountains (HighRock) | Mountain (510, 102) | `#776a52` / `#999670` / `#919397` | yes | 30%, mountain | spire (granite; plains) |
| Bangkorai (HighRock) | MountainWoods (506, 102) | `#b07a4a` / `#757048` / `#ad8060` | yes | 50%, mountain | spire (striated; plains) |
| the Rivenspire Moors (HighRock) | HauntedWoodlands (508, 302) | `#55473a` / `#7a7656` / `#7f8287` | yes | 15%, swamp, haunted | spire (flint; plains) |
| the Northpoint Coast (HighRock) | Woodlands (504, 302) | `#8a7858` / `#5e7a3e` / `#999b9c` | yes | 40%, woodland | - |
| the Alik'r Desert (Hammerfell) | Desert (503, 002) | the set as drawn (Sands of the Alik'r) | no | 2%, subtropical, desert | spire (redstone; any) |
| Craglorn (Hammerfell) | Desert2 (503, 002) | `#978274` / `#b3aca7` / `#c6c0bd` | no | 4%, mountain, desert | spire (limestone; any) |
| the Abecean Coast (Hammerfell) | Subtropical (501, 002) | `#c8b8a5` / `#7d6d58` / `#bda593` | no | 35%, subtropical, woodland, desert | spire (honey; plains) |
| the Dragontail Mountains (Hammerfell) | Mountain (510, 102) | `#8a7c6c` / `#7a7a58` / `#98887e` | yes | 45%, mountain | spire (granite; plains) |
| the Vine Coast (Sumurset) | Subtropical (501, 002) | `#957f62` / `#6f7c4c` / `#cdc7b9` on TEXTURE.302 | no | 30%, mountain, woodland, mountain woods | grove (cherry, ginkgo, maple; woods); vines (vine; plains) |
| Auridon (Sumurset) | Woodlands (504, 302) | `#d0c8b2` / `#6f7c55` / `#d9d6cf` | yes | 65%, woodland | grove (cherry; woods) |
| Eton Nir (Sumurset) | Mountain (510, 102) | `#7a8088` / `#7e8868` / `#8a8e94` | yes | 30%, mountain | spire (granite; plains) |
| the Anequina Badlands (Elsweyr) | Desert2 (503, 002) | `#a48f7e` / `#b08159` / `#a0754f` | no | 5%, desert, subtropical | spire (sandstone; any) |
| the Anequina Plains (Elsweyr) | Subtropical (501, 002) | `#9e866c` / `#a8935e` / `#a8967e` on TEXTURE.302 | no | 8%, desert, subtropical | spire (mound; plains); reeds (cane; wet) |
| the Pellitine Coast (Elsweyr) | Subtropical (501, 002) | `#e3d3b0` / `#808058` / `#8f8f89` on TEXTURE.302 | no | 45%, subtropical, woodland | reeds (cane; plains); spire (karst; any) |
| the Tenmar Forest (Elsweyr) | Rainforest (500, 402) | `#454f39` / `#5a4632` / `#4f5a45` | yes | 78%, rainforest | reeds (cane; plains) |
| the Hist Swamps (BlackMarsh) | Swamp (502, 402) | `#352b21` / `#4a3b2c` / `#44522f` | yes | 60%, swamp | hist (hist; woods); reeds (reed; wet) |
| the Shadowfen (BlackMarsh) | Swamp (502, 402) | `#4f4130` / `#8a8a55` / `#4e5a38` | yes | 15%, swamp | reeds (reed; plains); hist (hist; woods) |
| Murkmire (BlackMarsh) | Rainforest (500, 402) | `#544833` / `#4e5a38` / `#44522f` | yes | 65%, swamp, rainforest | reeds (reed; wet); hist (hist; woods) |
| the Ashlands (Morrowind) | Mountain (510, 102) | `#5f5a55` / `#8c8780` / `#524d48` | no | 2%, mountain, desert | spire (basalt; any); parasol (xylaria; any) |
| the Grazelands (Morrowind) | Woodlands (504, 302) | `#64523e` / `#a89a55` / `#8e8a83` | yes | 3%, woodland | - |
| Red Mountain (Morrowind) | Mountain (510, 102) | `#5e3a2e` / `#5e4b44` / `#4a2a22` | no | 0%, mountain | spire (scoria; any) |
| the Ascadian Isles (Morrowind) | Woodlands (504, 302) | `#776048` / `#5c7a3a` / `#a8a69c` | yes | 25%, woodland | parasol (ascadian; woods) |
| the Bitter Coast (Morrowind) | Swamp (502, 402) | `#544833` / `#5a5a34` / `#5a5a34` | yes | 55%, swamp, mountain | reeds (reed; wet); spire (menhir; plains) |
| Stonefalls (Morrowind) | Mountain (510, 102) | `#4a4642` / `#716e60` / `#3f3a36` | no | 12%, mountain, haunted | spire (basalt; plains); grove (ember, jester; woods); parasol (ascadian; woods) |
| Deshaan (Morrowind) | MountainWoods (506, 102) | `#45403a` / `#6a8448` / `#67625e` | yes | 45%, woodland | parasol (deshaan, glowstalk; woods) |
| the Telvanni Peninsula (Morrowind) | MountainWoods (506, 102) | `#7a684e` / `#7a7650` / `#77726c` | yes | 50%, woodland | parasol (telvanni, xylaria; woods); spire (basalt; plains) |
| the Velothi Foothills (Morrowind) | Mountain (510, 102) | `#946454` / `#8a8858` / `#8e8a84` | yes | 10%, mountain | spire (scoria; plains) |
| the Velothi Mountains (Morrowind) | Mountain (510, 102) | `#7a7876` / `#7a746c` / `#8a8885` | no | 5%, mountain | spire (granite; any) |


## Decisions

1. **The ground is dressed, not repainted.** A dress keeps the set's own grain, shapes and transitions (the classic records
   or the pack's) and changes its colours; a zone of the port's own pictures would be a texture set per zone, and the
   player's pack would no longer dress the land past the Bay. The ramps are the research's sampled colours at the albedo.
2. **The flats are Daggerfall's own.** Every flat a recipe stands is one of TEXTURE.500-510's nature records, any
   climate's - the game's own art for the lore's plants (the swamp's basalt stacks as the Ashlands' obelisks' kin, the
   desert's trama, the rainforest's palms); the landmarks are what no record stands.
3. **The Tenmar and Murkmire stay off the Bantha's storeys** (the owner's unique jungle is Cyrodiil's) and grow
   Daggerfall's rainforest and swamp close instead.
4. **Online it is the room's ground**, forced on (Logging's trees and the landmarks' bodies are where the room stands);
   offline a row and a kill door.
5. **Winter is the snow's.** A winter set is never dressed; the landmarks wear no snow of their own (the Frozen Coast's
   spires their snow-white tops all year).

## Departures from DFU (Port-Ledger A, THE LANDS PAST THE BAY)

DFU shows no province past the Bay; past it the port's zones (TESA-BIOME) now each wear their own ground (the drawn set
dressed in the zone's colours), stand their own flats (any climate's records, in the zone's own woods) and their own
landmarks (procedural meshes of the port's own) - none of it DFU's. On the Bay nothing is changed.

## Verification

`test/world/tesalands_ground.test.js` (7): the dress compiled (water and paving never, monotone ramps, vivid), a record
dressed (its grain kept in order, its mean at its ramp's middle at the albedo, its alpha, water and paving the set's own,
a transition each side its own class), stepped in bands (dressLayers' layers, the running-sum blur against the box), the
exposure and the ramp's reading, the table (every owed zone once, ramps dark to light, picks Daggerfall's, one entry a
kind, frozen), a pixel's ground set, and the doors. `test/world/tesalands_flora.test.js` (7): the recipes in the kernel
(their picks and archives, the woods' share, the same every run, off the climate's), the border between two zones, the
flats off the landmarks' feet, a zone's woods afar (monotone, its mean the zone's woods), the band's codes and art, the
far views' book (the zone's woods, its Trees' art by weight, its dressed ground; the Bay and the row off the climate's),
the doors. `test/world/tesalands_props.test.js` (7): the meshes, the pictures, the looks and the laws, where a landmark
stands (its inset, its rate, its woods and plains, never a road, water, a steep face or the beach, the lowest ground,
the reeds' edge, the vines' rows and vineyards, a patch's stands, the larger first), the flats off the feet and the
bodies, the host, the wiring and the four hosts. Pins moved with it (PIN MOVED, TESA-LANDS):
`test/world/graht1_oaks.test.js` (the trees' host frames the landmarks beside the graht-oaks),
`test/world/terrain/terrain.test.js` (the lands' beach test the fifth through the one home),
`test/render/precip4_snowground.test.js` and `test/formats/incident_texture.test.js` (the pixel's set is its zone's
dress), `test/scenes/fb1024_groundagree.test.js` (the lands' clearing the third), `test/world/gate/gateclear.test.js`
and `test/systems/disc20.test.js` (the publish entry's window, grown by the landmarks' set), `test/systems/features.test.js`,
`ft18_features.test.js` and `ft8_combatvisuals.test.js` (the row and the counts), and
`test/systems/l10n4_hardcoded.test.js` (the table's lore lines are data, not the player's words).
`tools/mutants/tesalands.json` (65); `farflora.json` and `fartrees.json` re-aimed by content.

## Sources

The lore's pages, read through UESP's wikitext (2026-10-27); a colour the page or a table names is sampled off the games'
own screenshots (The Elder Scrolls III: Morrowind, V: Skyrim, Online) or, where a game shows none, an estimate from the
lore's words - the ramps' sources by zone:

- **Skyrim.** Lore:The_Pale, Skyrim:Winterhold_(region), Lore:Ice_Fields, Lore:Sea_of_Ghosts (the Frozen Coast);
  Lore:Tundra_Plain, Skyrim:Whiterun_Hold, Skyrim:Hjaalmarch, Lore:Eastmarch (the Tundra); Lore:Karth_River_Forest,
  Skyrim:Falkreath_Hold, Skyrim:The_Rift (the Pinewoods - the Rift's white-barked golden aspens); Skyrim:Reach, Lore:Reach,
  Skyrim:Juniper (the Reach); Lore:Throat_of_the_World, Lore:Jerall_Mountains (the High Peaks).
- **High Rock.** Lore:Wrothgar, Online:Frostbreak_Ridge, Online:Morkul_Plain (Wrothgar); Lore:Bangkorai,
  Online:Fallen_Wastes (Bangkorai's striated ochre stone); Lore:Rivenspire (its flinty crags and moors); Online:Boralis,
  Lore:Northpoint, Lore:High_Rock (the Pocket Guide's "temperate climates and soft rolling hills").
- **Hammerfell.** Lore:Alik'r, Lore:Palm_Tree, Lore:Cactus, Lore:Fallen_Wastes (the Alik'r - its set the Sands of the
  Alik'r pack's own); Lore:Craglorn, Lore:Flora_A (Craglorn's pale grey-cream limestone - not red in ESO); Lore:Rihad,
  Lore:Hegathe, Lore:Stros_M'Kai, Lore:Taneth (the Abecean Coast's honey-red sandstone); Lore:Dragontail_Mountains.
- **Summerset.** Lore:Summerset_Isle, Lore:Alinor_(city) ("rows of vineyards"), Lore:Our_Blessed_Isles (the Vine Coast's
  cherry, ginkgo and maple); Lore:Auridon, Lore:Firsthold, Lore:Skywatch; Lore:Eton_Nir, Lore:Cloudrest.
- **Elsweyr.** Lore:Elsweyr, Lore:Anequina, Lore:Orcrest, Lore:Dune, Lore:Riverhold (the badlands' mesas, pillars and
  arches); Lore:Rimmen, Lore:Guide_to_Northern_Elsweyr (the High Savannah's acacias, termite mounds and cane paddies);
  Lore:Pellitine, Lore:Senchal, Lore:Topal_Bay, Lore:Moon_Sugar (the Pellitine's coast and limestone); Lore:Tenmar_Forest,
  Lore:Torval, Lore:Corinthe (the Tenmar's jungle and wild sugarcane).
- **Black Marsh.** Lore:Black_Marsh, Lore:Middle_Argonia, Lore:Helstrom, Lore:Hist ("giant spore trees growing in the
  innermost swamps"), the Pocket Guide (the Hist swamps); Lore:Shadowfen, Online:Shadowfen, Lore:Thornmarsh, The Argonian
  Account (the Fens' reeds "that reached up to his chin"); Online:Murkmire, Lore:Lilmoth, Lore:Soulrest, Lore:Archon.
- **Morrowind.** Morrowind:Ashlands, Lore:Molag_Amur, Lore:Foyada, Lore:Guide_to_Vvardenfell, Lore:Flora_G (the Ashlands'
  ash, obelisks, trama and xylaria); Morrowind:Grazelands, Lore:Wickwheat; Morrowind:Red_Mountain; Morrowind:Ascadian_Isles
  (the emperor parasols, "large mushroom-like plants not unlike trees", heather and gold kanet); Morrowind:Bitter_Coast
  (its ragged trees, shelf fungi, reeds and menhirs); Online:Stonefalls, Lore:Stonefalls (its basalt, pumice and orange
  and purple thorny cherry); Lore:Deshaan, Online:Deshaan, Lore:Saltrice (its black soil, fungal forests and glowstalks);
  Lore:Telvanni_Peninsula, Lore:Fungal_Lowlands, Lore:Mycoturgy (the Telvanni's grown fungi); Lore:Blacklight,
  Lore:West_Gash (the Velothi Foothills); Lore:Velothi_Mountains, Lore:Dunmeth_Pass.
