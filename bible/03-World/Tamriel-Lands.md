# The lands past the Bay (TESA-LANDS, 2026-10-27)

**The owner (2026-10-27), of the Tamriel arc: "Ensuring each region recieves proper landscape details and textures (minus
cyrodil and valenwood) and refined detail. Research these regions online to understand and make it the best that it can
be. Dont break anything".**

**What it named.** TESA-BIOME (`03-World/Tamriel-Biomes.md`) split every province past the Bay into the zones its lore
names and laid each on one of Daggerfall's ten climates; TAMRIEL-RELIEF and BREATHTAKER gave each its heights. What a zone
LOOKED like was still its climate's: the Ashlands wore the Wrothgarians' green turf and their pines, the Frozen Coast the
same, Craglorn and the Abecean Coast one sand, Summerset's Vine Coast the desert's cacti on the desert's sand.

**What it gives.** Cyrodiil has the Jungle of Bantha (`03-World/Bantha-Jungle.md`) and Valenwood its graht-oaks (`03-World/Graht-Oaks.md`) - the owner's
"minus" - and Black Marsh's Blackwood is one country with Cyrodiil's across the border (TESA-BIOME's recorded choice). The
other thirty-three zones of Skyrim, High Rock, Hammerfell, Summerset, Elsweyr, Black Marsh and Morrowind each take here
their own GROUND (its colours, laid over the set the game draws), their own GROWTH (Daggerfall's own nature flats, any
climate's, in the zone's own share of woods) and their own LANDMARKS (the land's features no flat stands: Morrowind's
giant fungi, the Hist, the reed beds, the rock spires, Summerset's vineyards and groves), and the far views read the
same. Each zone's lore line and its sources are below; the table is `world/tamriel/tamrielLands.js` (LANDS).

**The switch.** The Features row `tamriel-lands` (Lands of Tamriel, World) on the enhanced skin, on by default, FORCED ON
ONLINE (a zone's flats are where Logging's trees stand and its landmarks turn the player: a room agrees on its ground -
realForestsOn's shape); `?lands=off` the kill door, offline (`systems/landsSwitch.js` tamrielLandsOn, re-exported by
`scenes/shared.js`). The world reads it once, as it mounts. Off - and on the classic skin offline (online the row stands
on whatever the skin) - every zone wears its
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
- **Crisp.** Past the blur a share is made CRISP (`crisp` 0.15: under it none, over 0.85 whole, stretched between - the
  second audit: every texel of a transition's inside had stood a mix, never its class whole).
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
  `world/puddleMask.js`), the paving (the roads stay the town's) and every winter set (the snow is the snow's). A winter
  drawn SNOWLESS (Vanilla Enhanced's Snowless Swamps and Jungles' 403, `climateSwaps.js` winterSetSnowless) is its
  summer's ground, dressed as it (`landGroundSet`) - the snow lane draws its summer set there, and off it the Hist
  Swamps had worn the add-on's undressed set every winter (the second audit).
- **Its base.** A zone whose climate's set is the wrong cloth for its land names another summer set to dress: the Vine
  Coast, the High Savannah and the Pellitine are grass on TEXTURE.302, not the desert's sand. The Alik'r names no dress at
  all - its set is the Sands of the Alik'r pack's own, the lore's dune sea.
- **Its blades.** A zone says whether the enhanced grass grows on it (`blades`): none on the Frozen Coast's shingle, the
  High Peaks' snowfields, the Ashlands' and Stonefalls' ash, Red Mountain's cinder, the Velothi's rock or the desert's
  dunes and badlands; every grass land grows them - the Vine Coast's, the High Savannah's and the Pellitine's meadows on
  their `base` too (the second audit: they had stood bare, left over from the desert's sand they were dressed off).

**Its door** (`scenes/groundSets.js`). A pixel's ground set is named by the build (`scenes/pixelBuild.js` - its own and
its eight neighbours', each its own zone's: `tamrielLands.js` landGroundSet, `lands:<zone>:<archive>`). The ground sets'
module reads such a key as its archive read as ever, dresses its drawn layers and keeps under the key every map the grass
and the water read. An archive's own key makes what it made.

- **Its maps.** Its grass records (none where the zone grows no blades) and its floor's. Its puddles are its file's own,
  marked once (the dress keeps the alpha whole); in a scene after they are marked under the file, so every zone's key on
  it finds them. Its colours are the dress's, kept by the module beside the renderer's tile arrays, so a scene after reads
  them and never a mod door that knows no zone's key - taken once a set (the second audit: twice off the same layers).
- **A set whose pixel went** while it was made is asked for again once it stands (`hold.tileArray`): a dropped place's
  ask leaves it loose for the next sweep (`scenes/placeHolds.js`). It had been swept before it was there to free and
  landed held by no one, 20 MB of the GPU's a set (the second audit).

**Its cost, off the page's thread.** A 256-texel set (Vanilla Enhanced) is 0.87 s of a core to dress: a solid record 2 ms,
a transition 16 (its classes' shares, their blurs, its blend - the texel's transform a table over its luminance, built at
2,048 steps of a class's ramp and read between them, and every hot loop a plain function's, which the engine optimises as
it does not a generator's). Once a zone and season; the renderer's tile cache keeps it.

- **Its worker** (`world/tamriel/groundDressWorker.js`, the page's side `groundDressClient.js` - handed copies, the set as
  drawn the page's): the page draws while it dresses. With no worker, or one that fails, the same work runs on the page's
  thread, a band of 32 rows of a 256-texel record a breath (`world/puddleMask.js` stepsBreathing - its longest step 11 ms).
- **The client's laws** (the second audit). A worker that dies is let go and the next dress makes another, three at the
  most (`DRESS_WORKER_DEATHS`; one failure had sent the session's every dress to the page). A dress unanswered in a minute
  (`DRESS_ANSWER_MS`) or answered unreadably counts its worker dead, and the page dresses what it held (a lost answer had
  held its set, and every pixel wearing it, for the scene). A post that throws is the page's to dress.
- **A junction.** A pixel's own set and its neighbours' are loaded together (`pixelBuild.js`), so a junction of zones met
  first has one set dressed while the page reads and uploads the next - on ONE slice a frame however many chains wait
  (`systems/buildBreather.js`: every waiter waits on the one next frame; the second audit: each chain's resume had begun
  the slice again, four sets four slices in a frame).
- **AUDIT:** the first cut dressed on the page's thread in the stream's slices - 1.2-1.5 s of work a set, two seconds and
  more of a pixel's wait, three sets one after another at a junction.

## The growth: a zone's recipe (`world/terrain/terrainNature.js` layoutLands)

A zone's `flora` lays its flats by FOREST1's law (DFU's tests on the tile, the woods' field, the places' pull, each tile's
own dice), with the zone's numbers in FOREST1's stead:

- **Its woods' share of the land** (`woods`): the field's edge at its (1 - woods) quantile, FOREST1's own width - the
  field's quantiles measured every 1% over 400,000 world tiles of the continent's frame (`tamrielLands.js`
  FOREST_QUANTILES, `tools/landsMeasure.mjs`): the Pinewoods 80% woods, the Tenmar 78%, the Ashlands two in a hundred,
  every zone within a tenth of a point of its number. The second audit: measured every 5% and read straight from the
  95th to the field's highest, the tail had stood the Ashlands' and the Alik'r's 2% at 0.05%, the High Peaks' 3% at 0.4%
  and Craglorn's 4% at 1.7%, and the far views (the zone's number) stood half again the trees the ground did.
- **Its flats, any climate's**: a wood's tile stands one of its `trees`, a plain's one of its `cover`, each an [archive,
  record, weight] - usually Daggerfall's own nature flats (the Mountains' pines in the Pinewoods, the swamp's black basalt
  stacks and the desert's dry trama in the Ashlands, the rainforest's twisted and vine-hung trees and its palms in the
  Tenmar), and for Skyrim's four Lands zones also the port's own plant archive (`SKYRIM_FLORA_ARCHIVE` 38362,
  `world/tamriel/skyrimFlora.js` / `skyrimFloraArt.js`, pictures under `src/assets/skyrim/flora/`) - and every flat carries
  its archive (ECOTONE1's own seam: the build reads each flat's own, its season and its Low Poly tree its own).
- **Its dead trees** are `DEAD_TREES` - the desert's snags (503:11, 503:12), its gnarled thorn
  (503:28), the woodlands' great dead oak (504:30) - bare in the classic picture and in Low Poly Trees' mesh alike; never
  the classic sets' grey dead tree (504:24, 510:24), which the mod stands as 504:25's PINE (AUDIT: seen in the game - the
  Ashlands stood forty pines a pixel; `vendor/low-poly-trees/Trees/trees.json`, their prefabs on the pine's mesh).
- **Its rates** (`treeRate`, `coverRate`) on FOREST1's chances, and its ground's shares by DFU's tile record.
- **Its border.** With the Blended climates row a pixel's tiles within the ecotone's reach of a neighbour of another zone
  are owned as ECOTONE1 owns them (`world/ecotone.js` ecotoneOwner - the same border the ground draws), each laid by its
  owner's recipe, and the landmarks by the same owners, walked once a pixel (`terrainNature.js` borderOwners); a zone the table does not name keeps its climate's law on its tiles, and a Bay pixel's neighbour off
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
| reeds | a clump of reeds, their heads (cattails); sugarcane; a low rush | Black Marsh's "endless field of reeds that reached up to his chin" by the Commerce Road out of Cyrodiil (The Argonian Account, Book 2), the Shadowfen's reed beds, Elsweyr's moon-sugar cane |
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
(`wet` - a tile touching water); a `patch` gathers its sites in blocks of 16 tiles (the aspen stands across the Pinewoods).

- **The vines** are fields, not sites: a vineyard a block of 8 x 8 tiles drawn whole, two rows a tile along the world's x,
  at scale 1 so each row meets the next.
- **One seam.** Every draw is a hash of the site's world tile - the same landmark on every client, the worker and the
  main thread. A site's zone is its tile's owner's (the ecotone's, as the flats'), so a border between two zones is one
  seam.
- **Its FOOT** - its mesh's widest to a man's chest (`landPropMesh.js` LAND_CHEST: a crag's lumps, a grove of three's
  outer stalks, the Hist's roots) - stands wholly on land: no water, no paving, no road or track, no place's rect or
  clearing, nothing past its kind's steepest (a spire 40 degrees, the vines 6), over the beach (the reeds alone go to the
  water's edge, never into open water). It stands at the lowest ground about its middle (as it stood), sunk a little; the
  larger kinds stand first and the smaller keep off them. The second audit: one stalk's or one lump's had stood for it,
  a crag's 5.2 m of its 9.2, and its other lumps stood on roads and water.
- **A vineyard's row** is its whole length: off every foot along it, at the lowest of its middle and its two ends (the
  second audit: a rigid 6.4 m stood at its middle's ground on a 14° slope had floated its downhill end).
- **The flats keep off them.** The PIXEL'S BUILD keeps its flats off the feet of the landmarks it STANDS and off their
  vineyards' tiles (`landProps.js` landFeetOff, a grid of the feet - a flat asks the nine cells about it): a landmark the
  gate's clearing or a rock drops leaves its ground's own flats (AUDIT: the kernel had cleared them under every landmark,
  and a dropped one left a bare ring).
- **Its cost.** A pixel lays its landmarks in a few milliseconds of the kernel (its kinds' measures made once a worker,
  only the kinds its owners name walked).

**Their bodies** (`landPropBodies`, PROP-BODIES' shape): each solid part one, read off its mesh to a man's chest and turned
by the landmark's yaw as its mesh is - a parasol's stalk (a grove of three's three), a spire's column (a crag's three
lumps), the xylaria's cluster, a Hist's trunk (3.7 to 4.3 m), a grove tree's trunk - the player walks round them, on foot
or mounted, and through the reeds and between the vines' rows (the second audit: the player had walked metres into a
crag's rock, through two of a grove's three stalks and a metre into a Hist).

**Their host** (`scenes/landPropsHost.js` - HOST-SPLIT: the trees' host makes it with the row and frames it, the pixel's
build stands a pixel's set off the gate's clearing and the rocks and files its bodies; no line of bootWorld's):

- **Its GPU** is made when the first landmark is framed, on the stream's slice clock (a mesh a breath, a picture a breath:
  every kind's every variant at every LOD in Low Poly Trees' own buffers), a run a look's variant and LOD.
- **The frame** culls a pixel's set whole past its kinds' farthest (its scratch sized by what is in reach - the second
  audit: every built pixel's every landmark had sized it, 30 MB for a grid of the Fens' reeds), then each landmark to the
  view, the fog's reach and its kind's own `far` (reeds 260 m, vines 420, a grove 1.2 km, a parasol 1.5, a spire 2.2, a
  Hist 2.6), at its LOD, on the renderer's fourth tree slot - so it is lit, fogged, hazed and lantern-lit as every 3D tree
  under either lane - and the nearest 16 bodied ones cast into the sun's maps.
- **FLORA-GROUND** (#1184's, met at the merge): the kernel stands the landmarks, and the zones' flats, on the walk floor
  (`terrainSurface.js` walkGroundAt - every plant's one law), and the seat draws them on the ground their pixel draws at
  every ring and over its bed (`scenes/floraSeat.js` seatFlora and warmFlora give the set each root's `lift`, as the
  graht-oaks'; the host draws and casts each at it) - their place, their bodies and their feet the walk floor's.

**The four hosts:** `scenes/world.js` WIRED through the trees' host and the pixel's build;
`scenes/exterior.js`, `scenes/worldModes.js`, `scenes/dungeonContext.js` FLAGGED - none stands the wilderness past the Bay.

## The far views (`render/farFlora.js`, `world/terrain/floraCover.js`, `render/farTrees.js`)

FAR-FLORA's book answered a climate; with the row it answers a map pixel's zone: its woods (`landsFloraSpec` - afar its
own share, never the climates' 45%), its Trees' art (`landTreeArt`) and its ground (`landGroundArt` - the drawn tiles in
the zone's dress at the pack's exposure, as the near ground is dressed, a record a task). The far ring, the middle ring and
the far field ask it at each vertex's pixel.

- **Its canopy is its Trees'.** The far views' canopy, the band and the 3D trees are Trees (TREE_RECORDS); a stump, a log or
  a mossy rock among a recipe's `trees` stands as a flat. So a zone's tree rate afar is its recipe's by the share of its
  picks that are Trees, and its art those Trees' pictures by their weights (AUDIT: the non-Trees had read as canopy - the
  woods thinning where the band took over). A Tree among its `cover` stands at the cover's chance and is counted so, its
  picture weighed by its share of the Trees its ground stands (`floraCover.js` landsTreePicks - the second audit: the
  Velothi Foothills' 506:14, a third of its near Trees, had stood none afar).
- **The middle ring reads the zone's own edge.** The worker's packed wood is FOREST1's, and a zone's woods read through it
  are only their expectation given it (the field's distribution at 4,096 quantiles, averaged in 32 bins of FOREST1's wood) -
  where FOREST1's field is all plain or all woods, most of the land, one mean. With the row the worker also answers the
  forest field's own value at each sample (`floraCover.js` midRingCoverPixel, a byte over 0.15-0.85; none for a Bay pixel),
  and a zone's vertex reads its recipe's edge on it - the Pinewoods' glades and woods where the near ground has them (a
  world field, the same at a sample two pixels share).
- **The band past the streamed grid** (FAR-TREES) asks the worker with the row: a pixel past the Bay lays its zone's
  recipe, and a tree of an archive not the pixel's answers `archive x 256 + record` (`bandTreeCode`), each read in its own
  archive's art.
- **The band's atlas.** Its 48 layers are LENT: a Tree's picture is read where a wanted pixel's tree is of it, and a full
  atlas lends the layer of a picture no wanted pixel, no drawn set and no set being laid is of (`farTrees.js` _layerFor),
  the picture it turned away asked again when the drawn set moves (AUDIT: the Bay's eight archives hold 60 Trees, and a
  journey outgrew the atlas - a province's band trees left out for the session). The second audit: a picture that lands
  while a set is laid is held by that set (its layer could have been lent from under its drawing), and the turned-away
  are asked again only where a layer may be lent (a set wanting more than 48 had been laid again at every swap).

So the Ashlands' horizon is grey ash under a few dead trees, the Pinewoods' dark under its pines.

## The zones

Each zone's lore line is LANDS' own (`lore`); its sources the page's Sources, below.

| Zone | Climate (its sets) | Ground: dirt / grass / stone (the ramps' middles) | Blades | Woods: share, its `trees` picks' climates | Landmarks |
|---|---|---|---|---|---|
| the Frozen Coast (Skyrim) | Mountain (510, 102) | `#7d8280` / `#b3bbb8` / `#94979b` | no | 6%, mountain, desert | spire (frost; plains) |
| the Tundra Plains (Skyrim) | MountainWoods (506, 102) | `#8a7a5e` / `#a39a62` / `#a2a39d` | yes | 6%, mountain, desert | spire (lichen; plains); reeds (reed; wet) |
| the Pinewoods (Skyrim) | MountainWoods (506, 102) | `#756247` / `#676b46` / `#8e908a` | yes | 80%, mountain | grove (aspen; woods, in stands) |
| the Reach (Skyrim) | Mountain (510, 102) | `#8c7c68` / `#9a8a60` / `#9a8e80` | yes | 12%, desert, mountain | spire (reachstone; any) |
| the High Peaks (Skyrim) | Mountain (510, 102) | `#9c9ea0` / `#dbe3ea` / `#7b7e81` | no | 3%, mountain, desert | spire (granite; any) |
| the Wrothgarian Mountains (HighRock) | Mountain (510, 102) | `#776a52` / `#999670` / `#919397` | yes | 30%, mountain | spire (granite; plains) |
| Bangkorai (HighRock) | MountainWoods (506, 102) | `#b07a4a` / `#757048` / `#ad8060` | yes | 50%, mountain, desert | spire (striated; plains) |
| the Rivenspire Moors (HighRock) | HauntedWoodlands (508, 302) | `#55473a` / `#7a7656` / `#7f8287` | yes | 15%, swamp, haunted | spire (flint; plains) |
| the Northpoint Coast (HighRock) | Woodlands (504, 302) | `#8a7858` / `#5e7a3e` / `#999b9c` | yes | 40%, woodland | - |
| the Alik'r Desert (Hammerfell) | Desert (503, 002) | the set as drawn (Sands of the Alik'r) | no | 2%, subtropical, desert | spire (redstone; any) |
| Craglorn (Hammerfell) | Desert2 (503, 002) | `#978274` / `#b3aca7` / `#c6c0bd` | no | 4%, desert, mountain | spire (limestone; any) |
| the Abecean Coast (Hammerfell) | Subtropical (501, 002) | `#c8b8a5` / `#7d6d58` / `#bda593` | no | 35%, subtropical, woodland, desert | spire (honey; plains) |
| the Dragontail Mountains (Hammerfell) | Mountain (510, 102) | `#8a7c6c` / `#7a7a58` / `#98887e` | yes | 45%, mountain | spire (granite; plains) |
| the Vine Coast (Sumurset) | Subtropical (501, 002) | `#957f62` / `#6f7c4c` / `#cdc7b9` on TEXTURE.302 | | yes | 30%, mountain, woodland, mountain woods | grove (cherry, ginkgo, maple; woods); vines (vine; plains) |
| Auridon (Sumurset) | Woodlands (504, 302) | `#d0c8b2` / `#6f7c55` / `#d9d6cf` | yes | 65%, woodland | grove (cherry; woods) |
| Eton Nir (Sumurset) | Mountain (510, 102) | `#7a8088` / `#7e8868` / `#8a8e94` | yes | 30%, mountain | spire (granite; plains) |
| the Anequina Badlands (Elsweyr) | Desert2 (503, 002) | `#a48f7e` / `#b08159` / `#a0754f` | no | 5%, desert, subtropical | spire (sandstone; any) |
| the Anequina Plains (Elsweyr) | Subtropical (501, 002) | `#9e866c` / `#a8935e` / `#a8967e` on TEXTURE.302 | | yes | 8%, desert, subtropical | spire (mound; plains); reeds (cane; wet) |
| the Pellitine Coast (Elsweyr) | Subtropical (501, 002) | `#e3d3b0` / `#808058` / `#8f8f89` on TEXTURE.302 | | yes | 45%, subtropical, woodland | reeds (cane; plains); spire (karst; any) |
| the Tenmar Forest (Elsweyr) | Rainforest (500, 402) | `#454f39` / `#5a4632` / `#4f5a45` | yes | 78%, rainforest | reeds (cane; plains) |
| the Hist Swamps (BlackMarsh) | Swamp (502, 402) | `#352b21` / `#4a3b2c` / `#44522f` | yes | 60%, swamp | hist (hist; woods); reeds (reed; wet) |
| the Shadowfen (BlackMarsh) | Swamp (502, 402) | `#4f4130` / `#8a8a55` / `#4e5a38` | yes | 15%, swamp | reeds (reed; plains); hist (hist; woods) |
| Murkmire (BlackMarsh) | Rainforest (500, 402) | `#544833` / `#4e5a38` / `#44522f` | yes | 65%, swamp, rainforest | reeds (reed; wet); hist (hist; woods) |
| the Ashlands (Morrowind) | Mountain (510, 102) | `#5f5a55` / `#8c8780` / `#524d48` | no | 2%, desert, mountain | spire (basalt; any); parasol (xylaria; any) |
| the Grazelands (Morrowind) | Woodlands (504, 302) | `#64523e` / `#a89a55` / `#8e8a83` | yes | 3%, woodland | - |
| Red Mountain (Morrowind) | Mountain (510, 102) | `#5e3a2e` / `#5e4b44` / `#4a2a22` | no | 0%, desert | spire (scoria; any) |
| the Ascadian Isles (Morrowind) | Woodlands (504, 302) | `#776048` / `#5c7a3a` / `#a8a69c` | yes | 25%, woodland | parasol (ascadian; woods) |
| the Bitter Coast (Morrowind) | Swamp (502, 402) | `#544833` / `#5a5a34` / `#5a5a34` | yes | 55%, swamp, mountain | reeds (reed; wet); spire (menhir; plains) |
| Stonefalls (Morrowind) | Mountain (510, 102) | `#4a4642` / `#716e60` / `#3f3a36` | no | 12%, mountain, haunted, desert | spire (basalt; plains); grove (ember, jester; woods); parasol (ascadian; woods) |
| Deshaan (Morrowind) | MountainWoods (506, 102) | `#45403a` / `#6a8448` / `#67625e` | yes | 45%, woodland | parasol (deshaan, glowstalk; woods) |
| the Telvanni Peninsula (Morrowind) | MountainWoods (506, 102) | `#7a684e` / `#7a7650` / `#77726c` | yes | 50%, woodland | parasol (telvanni, xylaria; woods); spire (basalt; plains) |
| the Velothi Foothills (Morrowind) | Mountain (510, 102) | `#946454` / `#8a8858` / `#8e8a84` | yes | 10%, mountain | spire (scoria; plains) |
| the Velothi Mountains (Morrowind) | Mountain (510, 102) | `#7a7876` / `#7a746c` / `#8a8885` | no | 5%, mountain, desert | spire (granite; any) |


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
6. **A flat is chosen as it STANDS, not as it is named** (the audit, after the game was photographed): Low Poly Trees
   stands its own mesh for most nature records, and the classic sets' grey dead tree is its pine - so a recipe names its
   dead trees from DEAD_TREES, held off every pine's mesh against the mod's own data, and the far views count only the
   Trees among a recipe's picks as canopy.
7. **The dress runs off the page's thread** (the audit): a worker of its own, the page's thread the fallback - the same
   work either way.
8. **A zone's trees are the trees its lore names** (the second audit): Northpoint's oak and beech and Auridon's laurel,
   maple and cherry stand no pine (the Woodlands' 504:13 had been a tenth of their trees).

## Departures from DFU (Port-Ledger A, THE LANDS PAST THE BAY)

DFU shows no province past the Bay; past it the port's zones (TESA-BIOME) now each wear their own ground (the drawn set
dressed in the zone's colours), stand their own flats (any climate's records, in the zone's own woods) and their own
landmarks (procedural meshes of the port's own) - none of it DFU's. On the Bay nothing is changed.

## Verification

- `test/world/tesalands_ground.test.js` (11): the dress compiled (water and paving never, monotone ramps, vivid), a
  record dressed (its grain kept in order, its mean at its ramp's middle at the albedo, its alpha, water and paving the
  set's own, a transition each side its own class, its inside crisp), stepped in bands (dressLayers' layers, the
  running-sum blur against the box), the exposure and the ramp's reading, the table (every owed zone once, ramps dark to
  light, picks a summer nature archive's, one entry a kind, frozen, the grass lands bladed; the dead trees and the
  broadleaf lands against the mod's meshes), a pixel's ground set (a snowless winter its summer's), and the doors.
- `test/world/tesalands_ground.test.js`, off the page's thread: the worker's answer, the client's copies and its
  fallback, the ground sets across two scenes, the ash's grass records none; the client's worker kept (made again to
  three deaths, a post that throws, the watch, an unreadable answer); a set whose pixel went freed and the file's
  puddles marked once.
- `test/world/tesalands_flora.test.js` (10): the recipes in the kernel (their picks and archives, the woods' share, the
  same every run, off the climate's), the border between two zones (flats and landmarks), the flats off the feet of the
  landmarks STOOD (a dropped one's ground its own; the feet's grid against every foot), a zone's woods afar (monotone,
  its mean the zone's woods, its Trees' share), the field's own quantiles (120,000 tiles of the continent: every tabled
  share and every zone's woods its own), a Tree among the cover counted and coloured afar, the middle ring's own field,
  the band's codes and art, the far views' book (the zone's woods, its Trees' art by weight, its dressed ground a record
  a task; the Bay and the row off the climate's), the doors.
- `test/world/tesalands_props.test.js` (9): the meshes, the pictures, the looks and the laws, where a landmark stands
  (its inset, its rate, its woods and plains, never a road, water, a steep face or the beach, the lowest ground, the
  reeds' edge, the vines' rows whole and off the feet, vineyards, a patch's stands, the larger first), the flats off the
  feet and the bodies, the rock the body (every face to a man's chest inside a body, turned by the yaw), the host (its
  scratch by what is in reach), the landmarks on the ground their pixel draws (the seat's lift at each ring, made ahead,
  drawn and cast at it; the kernel on the walk floor), the wiring and the four hosts.
- `test/systems/buildslice.test.js`: one slice a frame however many chains wait. `test/render/fartrees.test.js`: the
  atlas's lent layers, a set past the atlas laid once, a picture landed mid-lay held.
- **Pins moved with it** (PIN MOVED, TESA-LANDS): `test/world/graht1_oaks.test.js` (the trees' host frames the
  landmarks beside the graht-oaks), `test/world/terrain/terrain.test.js` (the lands' beach test the fifth through the one
  home), `test/render/precip4_snowground.test.js` and `test/formats/incident_texture.test.js` (the pixel's set is its
  zone's dress), `test/scenes/fb1024_groundagree.test.js` (the lands' clearing the third),
  `test/world/gate/gateclear.test.js` and `test/systems/disc20.test.js` (the publish entry's window, grown by the
  landmarks' set), `test/systems/features.test.js`, `ft18_features.test.js` and `ft8_combatvisuals.test.js` (the row and
  the counts), `test/render/midring.test.js` (the middle ring asks the forest field's own value with the row).
- **More pins:** `test/scenes/fb1004d_placelru.test.js` (the pixel's own set held by the pixel, loaded with its
  neighbours'), `test/systems/surv7_feed.test.js` and `test/systems/tesabiome_feltair.test.js` (the climate the body
  feels past the Bay, a zone's air), and `test/systems/l10n4_hardcoded.test.js` (the table's lore lines are data, not
  the player's words; the dress client's five warnings and reasons, console lines).
- **With the audit:** `test/render/fartrees.test.js` (a picture read where a wanted pixel's tree is of it, not an
  archive's every Tree - and a test of its own for the atlas's lent layers), `test/render/precip4_snowground.test.js`
  and `test/systems/ecotone1.test.js` (a pixel's own set and its neighbours' loaded together, each with its twin).
- **With the second audit** `test/render/owhitch.test.js` (a build asks again for its set once it stands), and at the
  merge with #1184's FLORA-GROUND `test/world/terrain/floraground_rings.test.js` (the build seats and warms the
  landmarks with the plants) and `test/world/graht1_oaks.test.js` (ROAD-LOOK's `bridges` beside the graht-oaks in the
  build's terrain answer - red on #1184's head too).
- **Mutants:** `tools/mutants/tesalands.json` (123, all dead); re-aimed by content: `farflora.json`, `fartrees.json`,
  `ecotone1.json`, `precip1.json`, `forest1.json` (one law for both forest fields), `midring.json`, and with the second
  audit `perfextc.json` (the breather's one wake).

**The second audit (2026-10-27, five lanes)** fixed, each pinned and its mutants dead: the transitions crisp; one slice a
frame however many sets load; the dress's worker made again, watched, its unreadable answer and a failed post the page's;
a set whose pixel went freed; its means taken once; the file's puddles marked once in a scene after; a snowless winter
dressed; the grass lands bladed; the landmarks' feet and bodies their meshes'; the forest field's quantiles every 1%; the
host's scratch by what is in reach; a Tree among the cover counted afar; the atlas's two lending gaps; the vineyard rows
whole; the broadleaf lands' pine; the exposure the record gives (Vanilla Enhanced's .102 0.92). Found sound and left: the
landmark host's GPU outlives no world (the world boots once a page and leaving it reloads the page).

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
  innermost swamps"), the Pocket Guide (the Hist swamps); Lore:Shadowfen, Online:Shadowfen, Lore:Thornmarsh (the Fens'
  reed beds); The Argonian Account, Book 2 (Skyrim:Argonian_Account,_Book_2 - the reeds "that reached up to his chin" by
  the Commerce Road out of Cyrodiil); Online:Murkmire, Lore:Lilmoth, Lore:Soulrest, Lore:Archon.
- **Morrowind.** Morrowind:Ashlands, Lore:Molag_Amur, Lore:Foyada, Lore:Guide_to_Vvardenfell, Lore:Flora_G (the Ashlands'
  ash, obelisks, trama and xylaria); Morrowind:Grazelands, Lore:Wickwheat; Morrowind:Red_Mountain; Morrowind:Ascadian_Isles
  (the emperor parasols, "large mushroom-like plants not unlike trees", heather and gold kanet); Morrowind:Bitter_Coast
  (its ragged trees, shelf fungi, reeds and menhirs); Online:Stonefalls, Lore:Stonefalls (its basalt, pumice and orange
  and purple thorny cherry); Lore:Deshaan, Online:Deshaan, Lore:Saltrice (its black soil, fungal forests and glowstalks);
  Lore:Telvanni_Peninsula, Lore:Fungal_Lowlands, Lore:Mycoturgy (the Telvanni's grown fungi); Lore:Blacklight,
  Lore:West_Gash (the Velothi Foothills); Lore:Velothi_Mountains, Lore:Dunmeth_Pass.
