# The Jungle of Bantha (BANTHA1, 2026-10-18; BANTHA2, 2026-10-19)

**The owner's call (2026-10-18), with `jungle_trees.zip`: "Bantha, north of daggerfall is going to be the first region in
the continent to recieve a biome expansion. Using the attached file, populate the area in a dense jungle like format.
When traveling inside the area there should be a fog-like haze that reduces visability. This needs to be insanely
detailed and not hurt performance. No band aids."**

**BANTHA2 - the owner's call (2026-10-19), with a map of the Iliac Bay and an area of its south-eastern shore painted
red, and a "Jungle Preview" of a floor carpeted in grass, ferns and broad leaves under the trees: "1. The area is red in
bantha and should be the jungle biome 2. At the ground level, the image shows the flora abundence that should be present
in the jungle ... no band aids."**

**Bantha** - the area the owner painted on Hammerfell's shore of the Bay, from Lainlyn and Satakalaam east to Mournoth and
the map's edge (`world/jungle/banthaArea.js`; BANTHA1 stood it on Glenpoint, region 18, once Bantha's own region proved to
hold no land: AUDIT BANTHA1 RISK) - stands as a jungle in four storeys - the owner's five trees closing a canopy
overhead, emergents above it, young trees and palms in its light gaps, ferns and flowers on its floor, and under them a
carpet of grass, ferns and broad leaves with no earth showing (The floor) - under a humid
haze that is thickest at dawn and in rain, fog and storms, thins as the player climbs out of it, and drifts. Its edge is no line:
the trees come in as stands and the air closes over a kilometre. Inside it, the haze hides the streamed world past a
kilometre or so - and what it hides is not drawn, so the jungle pays for itself. Its own Features row (`bantha-jungle`,
the World tab's Land section), on by default; forced on online.

## The owner's trees

`src/assets/jungle/source/` holds the zip as they handed it over, byte for byte (`test/tooling/doctrine.test.js`'s
SUPPLIED rows): five Blender 5.2 OBJs, their MTLs and one 252x164 RGBA picture each, cut by its alpha (every texel 0 or
255, a stray 1 in one). Nothing is baked: the game fetches the fifteen files the first time a pixel stands a jungle tree
(~0.24 MB) and reads them (`world/jungle/jungleModels.js`, `systems/jungleTreesAssets.js`).

| Species | File | Tree record (archive 500) | Triangles | Height | Crown reach | Foot | Crown from | Trunk |
|---|---|---|---|---|---|---|---|---|
| banyan - aerial roots hung from a wide dome | `jungle_tree` | 12 | 132 | 22.54 m | 8.73 m | 8.30 m | 3.00 m | 1.44 m |
| kapok - a buttressed column under layered parasols | `jungle_tree2` | 13 | 103 | 21.41 m | 9.63 m | 8.53 m | 9.00 m | 0.99 m |
| fig - a strangler's braided trunk, a round crown, vines | `jungle_tree3` | 14 | 156 | 22.53 m | 9.42 m | 7.58 m | 8.00 m | 1.10 m |
| flame - palmate leaves, red blooms, moss curtains | `jungle_tree4` | 15 | 156 | 16.23 m | 7.80 m | 5.60 m | 3.00 m | 0.43 m |
| mahogany - a twisted trunk under a tall, dense crown | `jungle_tree5` | 16 | 261 | 22.54 m | 9.48 m | 6.37 m | 8.00 m | 1.33 m |

**Read.** Each polygon fanned into triangles, each distinct corner one vertex (f32 x 8: position, normal, uv - Low Poly
Trees' own layout). An OBJ is right-handed and the port's meshes are Unity's, so each tree is **mirrored in x** as Unity's
OBJ importer mirrors it - the tree stands as they drew it, never backwards - and **moved so its root** (the middle of its
lowest 2.5 m) **is the origin**: in their scene the five stood 7 to 53 m off it (AUDIT BANTHA1 TREE-8). Their ground
(y 0) is kept, so the roots they sank stay sunk. Each face is **wound as its normals say** (the mirror reverses a fan;
the kapok's export had turned its faces and its normals apart, 99 of its 103 triangles). Every material is drawn on both
faces and cut at a half, and no tree program reads which face it sees - so the winding changes nothing drawn today; it is
kept so a face cull or a facing read would agree with the light (TREE-8). A file the reader takes is one material (a
second `usemtl` throws - a tree is one picture), and a comment after a face or a map's options are read past (TREE-7).

**Measured.** A tree's foot, crown, crown's start and trunk are read off what it DRAWS - its picture's opaque texels
carried onto its faces in 3D (`measureTree`, every 0.1 m of every triangle), never its cards' corners, which reach far
past the leaves cut into them. The table above is `JUNGLE_MEASURES`, the stream's own (no picture is decoded to stand a
tree); the test measures the files again and holds the table to them to the centimetre. The foot is what a road keeps
clear of; the trunk and the crown are the tree's cover. The trunk is the 30th percentile of the drawn radii between the
foot's top (3 m) and the crown - and where the crown begins at the foot's top (the banyan's roots and the flame tree's
curtains hang from it), of the 3 m above it (`TRUNK_BAND`; AUDIT BANTHA1 TREE-5: that window was empty, and a default
0.5 m stood in for the banyan's 1.44 and the flame tree's 0.43).

## Where the jungle is

**The owner's area** (BANTHA2). Their map is Daggerfall's own 1000 x 500 at 0.4: it registers on the Bay's coasts at 2.5
map pixels a pixel and no offset (99.2% of its sea on the map's sea). `tools/banthaArea.mjs` holds their red as they drew
it (`BANTHA_DRAWN`, a run a row on their 400 x 200 picture, 4,185 of their pixels - never their picture, a render of the
game's map) and reads it into map pixels by four laws:

1. **The drawing at its own resolution.** Each of their pixels is 2.5 map pixels (2 km) square, so a line they drew at a
   slant is a staircase of 2 km steps: their red is smoothed by a Gaussian of 0.75 of their pixels (`DRAWN_SIGMA` - it
   takes a one-pixel step and keeps every feature two pixels wide; a hole of one of their pixels closes, a line one
   pixel across stays one map pixel across) and read at each map pixel's centre at a half.
2. **Hammerfell's land.** A map pixel is the area's where POLITIC names it land of a Hammerfell region (`REGION_RACES`'
   Redguard): at the Bay's eastern end their red reached over the inlet onto a strip of Wayrest's and Gavaudon's shore.
3. **The coast is its north edge.** Their map's coast stands a pixel or two off the map's own, so a column whose top is
   within `COAST_REACH` (6 map pixels) of the water runs on up through Hammerfell's land to it; a top further inland is
   where they drew it.
4. **The water it closes round** (a lake, a river's pool) is the area's - the jungle's air over it; the land it left
   unpainted is not.

`world/jungle/banthaArea.js` `BANTHA_AREA_ROWS` is what that law wrote on the freeware's map (the test derives it again,
row for row): **25,787 map pixels** (17,300 km², about 1.9 times Daggerfall's region) in 86 rows, the box (591, 272) to
(999, 357) - Mournoth 8,004, Totambu 7,026, Lainlyn 3,988, Satakalaam 3,470, the Dragontail Mountains 1,912, Kozanset
1,328, Tigonus 22, and 37 of lakes it closes round; the Rainforest's climate 23,415 of them, the Mountain's 2,329 (the
Dragontail foothills), water 43; 168 towns and cities, Satakalaam's and Lainlyn's among them (`tools/jungleExtent.mjs`).
Its heart, in Mournoth, stands 32 km inside its line. `banthaAreaHas(x, y)` reads a pixel off the rows.

**The field.** `world/jungle/jungleRegion.js`. The area is a set of map pixels (819.2 m), so its edge is a
staircase of pixel edges. Here each pixel near the area carries its **signed distance** from the edge - from its centre
to the nearest square of the other side, positive inside, held at six pixels (`jungleField`) - read the first time a
pixel is asked, ring by ring out from it until no nearer ring can beat what it found, and kept: no boot or frame sweeps
the map (a whole-map sweep cost 30 ms cold on the main thread; the stream's pixels cost about 0.1 ms each, once). Read **bilinearly between pixel centres** the field crosses zero on the shared edges and
rounds the staircase's corners; two octaves of the ecotone's own integer-hashed value noise (`ecoNoise`, cells of 64 and
8 tiles, 150 m and 40 m) **wander** the line, so it bends through the land. The same `jungleDepthAt` runs on the terrain
worker (a job carries its pixel's 3x3 of distances, nine numbers) and on the main thread, and agrees across every pixel
edge exactly. Two shares read it: the layout's (`JUNGLE_EDGE`: none 60 m outside the line, whole 480 m inside) and the
haze's (`JUNGLE_HAZE.edge`: none 320 m outside, whole 760 m inside - the air drifts out past the last trees).

## The layout - four storeys

`world/terrain/jungleNature.js` `withJungle`, run by the terrain kernel (`world/terrain/terrainGen.js`) over the pixel's
own layout (DFU's scatter or Real forests, and the ecotone's border) - none where the 3x3 shows the pixel whole jungle
(`jungleWhole`: the kernel lays no layout only to drop it, AUDIT BANTHA1 PERF-6). A tile is the jungle's where the share
beats its **stand noise** (`jungleStandNoise`: ECOTONE1's own patch law, two octaves of 8 and 2 tiles on the world's
lattice, stretched) - so the jungle comes in at its edge as stands that grow and join (LAY-9: it was each tile's own
draw, white noise) - and the pixel's own flats on it give way. Every draw is a hash of a WORLD tile or cell (FOREST1's `tileDraw`): a tree stands where it stands whatever was laid
before it, on every client and on the worker, so Logging's trees stand where the room sees them.

| Storey | Law | Numbers (`JUNGLE`) |
|---|---|---|
| Canopy | every other cell of 2 x 2 tiles (12.8 m) is a **site** - a quincunx on the world's lattice (`canopySite`, SPREAD) - and a site stands one tree somewhere in its middle half, unless a glade or a place's clearing opens it: the trunks about 16 m apart, never nearer than 9 m, and the crowns (16-19 m across) still meet | 90% of whole sites; scale 0.80-1.18 |
| Emergents | of the canopy, the kapok's parasols and the mahogany's dome alone stand above the rest | 8%; scale 1.28-1.55 |
| Understorey | a cell's: one young tree at most, at its own place in the cell's middle 60% (SPREAD - so two never stand nearer than 5 m), thicker in a light gap (a place no canopy crown reaches: 9 m at the trunk's scale) than under a crown; never within 4.5 m (at the trunk's scale) of a canopy trunk in its cell or a neighbour's - a neighbour PIXEL's too, where its site's tile hashes would stand it, grown or not (LAY-7); none in a place's fields (LAY-3) | 16% a cell, 42% in a gap; scale 0.36-0.62; flame 50%, fig 25%, banyan 15%, mahogany 10% |
| Mid storey | one of the rainforest's own Trees - World of Daggerfall's Tree records of archive 500, its palms (Low Poly Trees' 3D palms where that mod is on) - on the young trees' roll, in their place: a cell stands one of the two at most; none in a place's fields | 5% a cell |
| Floor | the rainforest's own cover - archive 500's other records, its ferns, shrubs and flowers (and under them the floor's carpet, The floor below) - denser in a glade's light (the glade's alone, never a place's pull); never within 2.2 m of a canopy trunk at that trunk's scale (1.8-3.4 m), nor on the tile a young tree or a palm stands on | 50% a tile, 68% in a glade (LAY-11) |

**Species.** A canopy tree's species is drawn from weights (`canopySpecies`): a base (`JUNGLE.base`), a **grove** - each
species' own value noise over 32-tile cells (a cell dividing 128, so the world's lattice - AUDIT BANTHA1 LAY-1: at 24
the groves restarted at every pixel's edge), so a slope of figs gives way to a stand of mahoganies - its **ground's
height above the beach** (banyans and figs crowd the wet lowland under 25 m, kapoks and mahoganies the uplands over
120 m), and **light** (the flame tree takes a glade's edge, its weight times 1 + 3 x light).

**Glades and clearings.** The forests' own field read some 4,600 tiles away (4096.5 east and 2048.5 south - `gladeField` - its lattice the world's, every
fourth tile, 1,089 samples a pixel) opens about a tenth of the land; FOREST1's places pull the canopy back into fields
round a town, a farm or a tavern and close it round a dungeon, a ruin or a shrine - a town's fields are open ground, no
canopy, young tree or palm, never the jungle's thickest light gap (LAY-3: the pull read as light, and a town stood in a
sapling thicket); the location's rect and every place's footprint, widened by DFU's clearance, stand nothing - with Real
forests off as on (LAY-4: World of Daggerfall's site footprint and its rock pieces were Real forests' alone, and jungle
trees stood in the rocks).

**What it never stands on.** A track or a river the road painter laid (its `paths`), or a trail of its own (The
trails), a slope over DFU's 50 degrees -
and no TREE, canopy or young, over 34 (a 20 m tree on a cliff reads wrong; the palms and the floor stand to 50 - LAY-2:
a hillside between 34 and 50 was bare), any ground but dirt, grass or stone (their shares 0.7, 1 and 0.2), under the
beach line. Beside a road (VERGE1's clear roadsides) a jungle tree keeps its **foot** off it - its roots, buttresses and
the curtains it hangs to the ground, at its own scale - never its crown: a road is cut through the jungle, and the crowns
lean over its sides (0.4 m for the banyan to 3.1 m for the mahogany at scale 1 - LAY-11: not "close over" it). The foot
is the measure whether or not the owner's files loaded (LAY-5/HOST-6: a client on Tree records cleared by the record's
reach, and its Logging trees stood elsewhere than its room's).

**SPREAD (2026-10-19, the owner: "Lets spread out on the distance between trees").** The canopy stood a tree in every
cell (12.8 m apart, as near as 5 m), and the young trees and palms each rolled a tile's dice (two as near as 1.3 m):
5,700 trees a pixel, one to 118 m², the nearest neighbour 7 m at the median. The canopy now stands on every other cell
in its middle half and the understorey one a cell at most: 2,600 trees a pixel, one to 250 m², the canopy's nearest
trunk 16 m at the median (11 m at the hundredth) and any tree's 11 m (`test/world/junglespread.test.js`). The crowns
still close overhead - a site's crown reaches 7-11 m and the next site's trunk stands about 16 m off - so the jungle
stays a jungle overhead and opens at the eye.

**Cost.** A pixel of whole grass wholly jungle stands about 1,350 canopy trees (100 of them emergents), 1,080 young
trees and 8,200 palms and plants - about 10,600 flats, against Real forests' mean of about 6,200 (and DFU's scatter's
9,200) on the same ground - laid on the terrain worker in about 8 ms warm (SPREAD: it was 13,900 flats and 11 ms;
AUDIT BANTHA1 LAY-10, PERF-6: 16 before that; the ordinary layout is about 3), never on the frame's thread. The list crosses to the main thread BY COLUMN
(`world/terrain/natureWire.js`: a float64 column a field, the buffers transferred, the objects made again - 2 ms
against the 10 ms structured clone it was, PERF-2).

## The trails

**JUNGLE-TRAILS (2026-10-19, the owner: "Implement procedural dirt pathways that cut through the forest").** Dirt
trails wind through the jungle, meet, cross and loop - about one through every pixel (1.2 km of trail to the km²) - its
own, never the road painter's tracks: a track runs straight from a pixel's middle to its edge and is the map's (the
travel map, the ink map, the landforms and fast travel read the network), so the jungle's trails stay off it.

**The law** (`world/jungle/jungleTrails.js`). A trail is where a field on the WORLD's lattice crosses its middle value:
two families (`JUNGLE_TRAILS.families` - lattices of 176 and 240 tiles), each a value noise (`ecotone.js` `ecoHash`)
seen through a warp of its own, so a trail bends as a path walked round trees bends, and the two cross at junctions.
Each family's lattice is turned off the world's axes by a Pythagorean triple (36.9° and -22.6°: a cosine and a sine
exact in every engine, where `Math.cos` is not - the room agrees on its trails), so no trail runs along a lattice line
(14% of their headings lie within 10° of an axis, against 22% for a line at random and 35% unturned). A lattice point's
value is held 0.1 off the middle either side, so no island of the field - no ring of trail round it - is smaller than
about half a cell; each warp stretches a step at most 1 + 6 x its amplitude over its cell (`warpStretch`, under 2), so
it never folds a trail back over itself. A point's distance from a trail is the field's distance from its middle over its gradient (the
warp carried through by the chain rule). The field is a pure function of the world tile: a trail runs on unbroken across
every pixel's edge, on the worker and the main thread, every client alike, with no graph of neighbours to agree on.

**Painted** (`paintJungleTrails`, by the terrain kernel `world/terrain/terrainGen.js` after the road painter and before
the marching squares): a corner within 0.75 tile of a trail's line - past a corner's diagonal half, so the dirt runs
unbroken at every heading - on land, out of the location's rect, where the jungle is whole (`JUNGLE_EDGE.in` deep; at
its edge the ground is the pixel's own layout's too, and DFU's scatter reads no mask), is dirt, and DFU's own
dirt-to-grass tiles blend its edges. Every tile two of whose corners are the trail's - half dirt by its marching
square's art and more - that no painter wrote goes into the pixel's `paths` (a tile with one is the trail's edge, a
corner of dirt the floor grows over: marked by any corner, a trail cleared a band three tiles wide, 19 m, in the
game's first photograph) - the mask the road painter keeps (GRASS-PATH1, `03-World/Roads.md`), which every layer that keeps off a track
already reads: the jungle's palms and floor, Real forests, the meadow's grass and the jungle floor's carpet, the home
yards. The heights are never moved - a trail is worn into the ground, not cut - so the room's ground is the ground it
was.

**Beside a trail.** A jungle tree - the canopy and the young - keeps its **foot** off a trail's dirt, as VERGE1 keeps it
off a road (`jungleModels.js` `JUNGLE_MEASURES`, at its own scale; `trailClear`, `vergeClear`'s shape), where the trails
run; the crowns lean over it.

**Cost.** A pixel's blocks of 4 tiles square are read once (`trailBlocks`): for each family, a floor under how near its
line comes to any point of the block - the field's distance from the middle at the block's middle over its steepest
(the noise's steepest through the warp's stretch), less the block's half diagonal. The painter reads the corners of a
block only where a family's floor is under the half width, and a tree asks its own distance only where its block's floor
is under its foot: exactly the answer of reading every corner and every tree (`test/world/jungletrails.test.js`), about
2.5 ms a whole jungle pixel on the terrain worker, against the kernel's 23.5 on the same machine - never on the frame's
thread.

## The trees in the game

**One door, two sets** (`systems/lowPolyTreesAssets.js` `createLowPolyTrees`'s `treeSet`). The jungle's door is Low Poly
Trees' own over the owner's files - its pictures decoded, never painted from the player's records - so a jungle tree is
held, drawn near as its 3D tree and far as its own far picture, handed over across the band on the port's one Bayer
screen-door, swayed by the wind (WIND3 and Windfall's law by its Tree record), lit by the far picture's law at night and
the sun's by day, cast in shadow by its far picture, felled and given back exactly as a low-poly tree is. THE ONE
CONSTRUCTION SEAM asks the door for it (`world/naturePicture.js` `junglePicture` - beside `naturePicture`, the only file
that asks a door for a far picture). Its far picture is drawn once a species from the side at 8 texels a metre and uploaded as a flat of
archive 500 (`jungle-<species>#lpt`), its batch sized for the tallest emergent (`JUNGLE_SCALE_MAX`, 1.55) with each tree's
own scale on its corner; its near set takes the layout's own scale (`buildTreeSet`'s `own`) and lptVariety's turn.

**The renderer's second tree slot** (`render/renderer.js` `setLowPolyTrees(frame, slot)`): slot 0 is Low Poly Trees',
slot 1 the jungle's; each slot's trees are drawn with its own buffers, and a far picture gives way to its OWN slot's trees
at that slot's radius and band; both are spent in the call.

**What the flat is** (`scenes/pixelBuild.js`). A jungle tree is a flat of the rainforest's archive with one of its Tree
records, in a group of its own (`J<species>`, and `J<species>y` for the young): it is **Logging's** (the pixel's forest -
`scenes/treeHost.js standTrees` stands the day's trees at it; felled, it sinks and falls as its far picture; its node
glints on its own picture - NODE-GLINT, Professions-Arc 47 - where its mark, `jungleTreeMark`, stood the glow's card out
of its trunk or its hung curtains toward the eye until NODE-OUTLINE - AUDIT BANTHA1 TREE-3: the 0.6 m pull of an
ordinary tree left it inside the banyan), **cover** at its own trunk and crown (`jungleCover`, TACT1's
trunk-and-crown shape, the crown at TACT1's 0.7 of its reach - LAY-6), **flora** that sways, and the far rings (MAC1)
stand a canopy tree by its own height - a young tree's group stands no far ring (PERF-5: 41% of the trees, under the
canopy, drew to the horizon). **Its cover's cost** (TREE-1, PERF-1): a crown 7-15 m across was filed in every 4 m cell it
touched - 134,000 entries, 10 MB and 40-80 ms a pixel; a proxy wider than a cell is now filed once in a 32 m grid of its
own (`ai/cover.js` `COVER_WIDE`), the add sliced through the build's breather (`COVER_SLICE`) - 9 ms a pixel, the same
answers. A pixel HOLDS its far pictures' handles (`jungleTrees`'s, and BUILD-FAIL1's ledger `jungleHandles`) and lets them
go with it (`scenes/treesHost.js` `released`, `releasedBuild`). Should the owner's files not load, every jungle tree
stands as the Tree record it carries - never an empty jungle, never a Logging node at an invisible tree - and the door
asks again on BUILD-RETRY's backoff (`BUILD_RETRY_MS`; TREE-6: one failed fetch was the session's). A 3D tree takes its
sun at its crown (`uSunLift`, `JUNGLE_SUN_LIFT` 0.6 of its height - TREE-2: one shadow tap at the root lit or darkened a
whole 22 m tree by its foot's shade), and the door uploads nothing on a frame with no tree near (TREE-9).

**A large tree gathering spot** (JUNGLE-WOODS, 2026-10-19, the owner: "The forest region we recently implemented should
be a large tree gathering spot. Moreso than other places within daggerfall"): a map pixel of the area stands **48 of
Logging's trees a day** (`net/nodeLaw.js` `JUNGLE_TREE_SLOTS`, `treeSlots`) - four times the Woodlands' and the
Rainforest's 12, the most anywhere else - every slot a tree (on ground nobody has vouched for, a slot whose Teak or
Mahogany waits on the witnesses stands Pine, where an ordinary Rainforest pixel stands nothing), each at a jungle tree
of the day's law point (`scenes/treeHost.js` `standTrees`). The area's law, the service's as the client's (acct161):
`06-Systems/Professions-Arc.md` JUNGLE-WOODS. Each glints on its own 3D tree near the eye
(NODE-GLINT, Professions-Arc 47 - NODE-OUTLINE's ring in Logging's green before it, 46).

## The floor

**BANTHA2** - the owner's "Jungle Preview": a floor of grass, ferns and broad leaves under the trees, no earth showing.
The floor storey above stands the rainforest's cover as flats, half a tile's chance a 6.4 m tile - a plant every 80 m²,
the jungle's red earth between them. A carpet that thick is the grass system's to draw (`render/labGrass.js`: a field
of cells about the eye, placed a slice a frame, faded and culled, instanced), so the floor is a **second field of it**
(`scenes/jungleFloorHost.js`, a module the world host wires - HOST-SPLIT): its own renderer wearing the floor's plants
on the meadow's crossed cards (MEADOW1, `render/grassMeadow.js`), its own density and seed. The flats still stand over it.

**The plants** (`render/jungleFloorArt.js` `JUNGLE_FLOOR_PLANTS`, in the atlas's eight cells): the owner's tall tuft
(`src/assets/grass/source/tuft-tall.png`, the meadow's first sprite) for the grass, and archive 500's own low cover - the
pictures the floor storey's flats wear, the classic record's or a pack's (`floorPictures`), never a Tree record:

| Plant | Record | Height (m) | Stiff / sway | Judged share, poor / lush (at 1.8) | Share, poor / lush (JUNGLE-GRASS) | A square metre, poor / lush |
|---|---|---|---|---|---|---|
| grass (the owner's tall tuft) | - | 0.5 | 1 / 1 | 42% / 30% | 55.2% / 49.6% | 1.76 / 1.58 |
| sedge | 7 | 0.5 | 1 / 1 | 16% / 10% | 21.0% / 16.5% | 0.67 / 0.53 |
| fern | 9 | 1.2 | 0.6 / 0.8 | 12% / 20% | 6.8% / 11.3% | 0.22 / 0.36 |
| frond | 10 | 0.95 | 0.6 / 0.8 | 10% / 16% | 5.6% / 9.0% | 0.18 / 0.29 |
| broad-leaved bush | 1 | 0.9 | 0.3 / 0.6 | 5% / 8% | 2.8% / 4.5% | 0.09 / 0.14 |
| palmlet | 27 | 1.0 | 0.5 / 0.7 | 6% / 7% | 3.4% / 4.0% | 0.11 / 0.13 |
| flowering stem | 21 | 0.9 | 0.5 / 0.7 | 4% / 5% | 2.3% / 2.8% | 0.07 / 0.09 |
| spike | 6 | 1.1 | 0.4 / 0.7 | 5% / 4% (the rest) | 2.8% / 2.3% (the rest) | 0.09 / 0.07 |

Each picture is laid in the meadow's 64-texel cell beside the tuft (`fitSprite`: whole texels a pixel where it fits,
shrunk at the texel's centre where it does not, its foot on the cell's floor, a pack's soft alpha cut at a half), so the
meadow's program and its coverage-kept mip chain wear them unchanged. A plant's card stands its own height - its drawn
height over the lab's mean blade, times the blade's own draw and the patch's (the meadow's 1.25 on a lush patch) - and
which plant a tuft wears is its width byte's, by shares the patch leans: a lush patch more fern and leaf, a poor one more
grass and sedge. The vertex stage's ladder (`ladderPick`, written from the set: `meadowVsEdits(art)`) and `floorPick`
agree at every byte.

**Its colours.** Of the meadow's colour law (MEADOW1: a texel takes the ground's hue as far as it is green) the floor takes
the ground's **light** and never its **hue** (`uArtHue`: the meadow's set 1, the floor's 0): a fern on the jungle's red
earth stays a fern's green. With the hue (2026-10-19's photographs) the tufts took the earth's hue and stood pale pink.

**How thick.** `JUNGLE_FLOOR.plants` where the floor is whole, at the grass row's Full (the row's tiers thin it as they
thin the meadow - the pref's share, `floorDensity`). At 1 a square metre the red earth still showed between the ferns
(2026-10-19's photographs); at 2.5 it was a wall of leaves, and the owner: "Reduce the amount of ground flora. Its a
little too much" (2026-10-19) - thinned to 1.8 (`JUNGLE_FLOOR_JUDGED`, the table's judged shares). There its tufts and
sedge stood 0.88 a square metre, two fifths of the 2.27 the meadow stands everywhere else, and the meadow's own grass
keeps out of the floor (Where, below) - so the jungle read as leaves on bare mud, and the owner: **"Grass isnt showing
within the new jungle region"** (JUNGLE-GRASS, 2026-10-19). Now the floor is two rates (`render/jungleFloorArt.js`):
its **flora** - fern, frond, bush, palmlet, bloom, spike - at the rate the owner judged, plant for plant (a fern stands
as often a square metre as at 1.8), and its **grass** - the tuft and the sedge, in their judged proportion - at the
meadow's own (`JUNGLE_FLOOR_GRASS`: the meadow's blades over the lab's span, three a tuft), more on a poor patch than a
lush one as before: **3.19 plants a square metre** (`JUNGLE_FLOOR_PLANTS_M2`), every share derived from those two. The
meadow's grass stays out: its colour law would take the earth's hue (Its colours, above) and its one hue share is a
uniform its set holds - the floor wears the same tuft at its own hue. Its seed is its own (`JUNGLE_FLOOR.seed`; a field
of the meadow's seed at a lower density stands on a prefix of its spots).

**Where.** A plant stands where the jungle's floor **claims** the point (`jungleHost.floorClaims`): the point's own draw
(`jungleFloorDraw`, an integer hash of its world place at an eighth of a metre - the same on every client and at every
origin) under the layout's share there (`jungleShare`: none 60 m outside the line, whole 480 m inside) - so the carpet
comes in across the edge as the trees do. On DFU's dirt and grass **by their place** - records 1 and 2, whatever their
colour, as the layout reads them (`JUNGLE.ground`) - and on a blend or a place's tile more than half its texels theirs
(the world host's keep with the floor's records, `floorRecordsOf`); never stone, a road, a track, water, a site's floor or
the snow the ground shows. **Not by colour** (2026-10-19, found photographing it): the Rainforest's ground is the Swamp's
(TEXTURE.402), whose grass is an olive mud (61, 60, 40) and whose stone a green moss (44, 63, 38), so the meadow's colour
test took the stone and refused the grass - and the floor stood on the odd patch of dirt, the jungle's grass bare between. The meadow's own grass keeps out of every point the floor claims,
so the two never stand twice: deep in the jungle the floor is the only grass.

**When.** Made the first time the jungle comes within `JUNGLE_FLOOR.near` (760 m: the field's range and the layout's
fringe, with 400 m to spare) of the eye - its pictures read then - and kept; outside the jungle its cells hold nothing. No
ARENA2 picture for any plant, no floor (never a plant stood in another's picture): the meadow stands as it did. With
no meadow (the classic skin, the grass row Off, `?grass=off`) there is no floor either: the flats stand alone. A read or a
build that failed is said once (`console.warn`) and never asked again.

**Paired with the meadow.** The world host's every door to its grass field - a pixel re-read, the burned earth, the
floating origin's shift - reaches the floor's too, by the one handle (`pair`); a new meadow field (a teleport's re-anchor)
is a new floor field. Its draw is the meadow's program under the meadow's frame - its view, light, wind and range
(`drawBeside`, the renderer's stored `frame`).

**Cost.** The field holds the meadow's 394 cells about the eye, each 8,601 blades (3.19 plants a square metre, three
blades a tuft, over a 30 m cell) at 16 bytes: **54 MB of GPU buffers** at the grass row's Full (31 MB at BANTHA2's 1.8 -
JUNGLE-GRASS's grass the difference), beside the meadow's 39 MB - allocated only once the jungle comes near. Its cells are placed a slice a frame as the meadow's are. **Open:** its frame time on a GPU (beside the
jungle's, below).

## The haze

`render/hazeGlsl.js` (the shader's law), `world/jungle/jungleHaze.js` (its numbers and its CPU twin, term for term),
`scenes/jungleHost.js` (each exterior frame's).

**The law.** A layer of humid air on the land: its extinction is whole (`JUNGLE_HAZE.density`, 0.0055 a metre - half the light
at 126 m) up to a **floor** - the canopy's height (`JUNGLE_HAZE.layer`, 28 m) over the ground under the eye, or over the land
about it (the eye's 3x3 of pixels' middles) where that is lower - and falls off by e every `JUNGLE_HAZE.falloff` (90 m) above
it. A ray crosses it for its length less a clear 8 m about the eye; its optical depth is that run times the layer's
**mean density along the ray, exact** for a straight ray through an exponential layer clamped at its floor (`hazeMean`),
and what reaches the eye is exp(-depth). So a valley is the layer's thickest, a ridge above it clears, and from a summit
the haze lies below as a sea.

**How thick, when.** At full share, by the hour (`JUNGLE_HAZE.day`: dawn's mist 1.65, the afternoon 0.82, night 1.25 - read
linearly round the clock), by the weather (`JUNGLE_HAZE.weather`: rain 1.3, thunder 1.42, fog 1.4), and by **drifting banks**
(`hazeDrift`: a value noise 540 m across, the density times 1 +/- 0.24, blown along the wind's way at 1.6 m/s) - the air
thins and thickens as the player walks and waits.

**Eased.** Share, density and floor each follow their target by their own lag (1.4 s, 2.5 s, 3.5 s); a step across the
line, up a cliff or into a bank is a fade. A jump (an eye 250 m from the last frame's: a teleport, a load) snaps. The
state is kept in the WORLD's frame (pixel and metres, the origin's height taken off), never the scene's, so a floating
origin's recentre is no move and a teleport's re-based scene is the jump it is (AUDIT BANTHA1 HOST-2, HOST-3: the
vertical recentre thickened the haze for seconds, and a teleport faded). Off the jungle the state lets go and its
uniforms are ZEROED (HOST-1: the last eased frame's stood on, and its cull with it, for the rest of the session), and
under the sea the air's haze is off (HAZE-7: it stacked on the water's own fog).

**Everywhere it should be.** Every world program fogs by `fogFactorAt`, and `fogFactorAt` is now the weather's fog
(`weatherFogAt`) times the haze - the ground, the flats and both doors' trees, the meshes, the characters, the decals,
the water (whose sea floor - FAR-SEA1's hold - is the weather's half alone: no sea shows through the haze), the grass,
the rain curtains, the banners and flags, the duel wall, the spell sparks, the ships, the serpents, the sea's own fog
passes, and the exterior's glows (Logging's node glow, the aura ring, the spoils, the gate, the rite's smoke, the
Abyss's omen, a foe's telegraph - AUDIT BANTHA1 HAZE-3: they glowed through the haze) - each uploads `uJungleHaze`
beside its fog, and every fog a host hands a pass carries it (`haze: renderer._haze`). The sixteen passes drawn only in
a mode's frame (the Burning Court's, the Abyss's realm, the Elite Breach's halls - each named in the test) never stand
in the jungle, and their beginFrame clears it. The uniform is the jungle's own name (HAZE-1: as `uHaze` it redeclared
the Deadlands' own and the Burning Court would not build). The renderer's own programs upload it only while it is on,
and once as it goes off - kept by the GL program, not its location table, which a world set's install rebuilds (HAZE-2:
a program whose table was rebuilt kept the jungle's air); the passes, the far ring and the sky send theirs with each draw
- a call a pass, cheap, but not none (HAZE-9). A window's view out keeps the street's haze with its fog (HAZE-6). The far ring of both lanes takes
it beside its horizon (`RING_HAZE_GLSL`'s `ringHaze` - `render/horizonHaze.js` stays a leaf). The sky - all four of its passes: the classic panorama, the port's dome, Dynamic Skies'
skybox and the volumetric clouds' composite - takes its sky half (`HAZE_SKY_GLSL`): a ray that never meets the ground
crosses the column above the eye over its rise, so the horizon is the haze's whole colour and the zenith keeps its blue.
Each dome mixes it AFTER its grades (the live event's dread, the Hollow's brass), whose colour it already wears (HAZE-8:
it was graded twice).
The renderer's haze is a FRAME's: `setJungleHaze` arms it, and a beginFrame no exterior frame armed clears it, so an
interior, a dungeon or a panel never inherits the jungle's air; a sprite drawn off the world borrows it off with the fogs.

**Its colour.** The weather's own fog colour (the sky's horizon by the hour) made humid - leaned 42% to its own grey and
tinted toward green, its brightness kept (`hazeColorOf`). The frame's ONE fog colour is the weather's and the haze's
weighed by their optical depths at 300 m (`fogColorWith`): each medium scatters in its own colour in proportion to what
it takes out. The ground, the sky's horizon and the far ring close into that one colour, so no skyline steps.

**What it hides - the performance it buys.** A pixel whose every point sends less than 1/512 of its light through the
haze ALONE is not drawn (`hazeHides`, asked at the world host's pixel gate - terrain, models and flats with it; AUDIT
BANTHA1 HOST-4, HAZE-4: with the weather's fog multiplied in, a linear fog's end at 2.4 km hid the land at the haze's
thin fringe, where the sky then showed, and sea the water still drew). A **bound**, never a guess: the run to the box's nearest point, at the box's top (where the layer is
thinnest - the mean density falls as a ray's far end rises), is the least any ray into it can cross; the test samples
hidden boxes and holds every point of them past the cull. At noon the haze hides the low ground past ~1.3 km (~1.4 km at one, its thinnest hour),
at dawn past ~0.7 km - the 3x3 or the 5x5 of the 121 pixels the default land view streams - while a peak standing out of the haze
still stands. The shadow pass never culls by it. It culls DRAWING, not building: a hidden pixel is still streamed,
laid and held (PERF-3 - the owner's call, below).

## The four hosts

`scenes/world.js` WIRED (the streamed world - the jungle's host and the trees' host built once, the job, the haze before
the fog, the pixel gate, the far ring). `scenes/exterior.js` (the fixed city), `scenes/worldModes.js` (interiors) and
`scenes/dungeonContext.js` (dungeons) FLAGGED (`scenes/jungleHost.js`'s header, Home.md's open flags): none stands the
wilderness the jungle grows in, and each beginFrame of theirs clears the haze.

**HOST-SPLIT.** bootWorld stood at its ceiling. The trees' door and frame came out of it into `scenes/treesHost.js`
(Low Poly Trees' door with its season, the near sets of both doors, the handles' owners) - 26 code lines out, the
jungle's wiring in, the host 21,160 code lines (its ceiling lowered to that). BANTHA2's floor is a module of its own
(`scenes/jungleFloorHost.js`); bootWorld gained its wiring alone (the host made, the floor's records beside the meadow's,
the keep's floor door, the pairing, the update and the draw) and stays under the ceiling.

## Online, switches

**Forced on online** (`onlineLane.js` via the row's `online: true`): the jungle's trees are where Logging's trees stand in
the area, so a room has one jungle. The floor's carpet is drawn alone (no tree, no collision, nothing Logging fells), so
its thickness follows each player's grass row, as the meadow's does. Offline, the Features row `bantha-jungle` (prefs `banthaJungle`, on by default) on the
enhanced skin; the classic skin keeps DFU's own woods. `?jungle=off` the kill door (offline); `?junglehaze=off` stands
the jungle under clear air. Read once, as the world loads.

## Departures from DFU (Port-Ledger A, THE JUNGLE OF BANTHA)

- `DefaultTerrainNature.LayoutNature` scatters each pixel's own climate archive over it (the Rainforest's 500 over most
  of the area, the Mountain's in the Dragontail foothills) as it does anywhere; here the area's tiles are laid by the
  jungle's own law - the owner's trees, the rainforest's palms and floor (archive 500).
- **The owner's area, not a region** (BANTHA2, the owner's call, 2026-10-19): Daggerfall lists Bantha (region 10) and
  paints no pixel of it, and BANTHA1 stood the jungle on Glenpoint (region 18); the jungle is now the area the owner
  painted on Hammerfell's shore - map pixels of seven regions, no region whole.
- **The floor's carpet** (BANTHA2): DFU stands the rainforest's cover as scattered billboards; here a second field of the
  port's grass carpets the ground with the same pictures on crossed cards and the owner's tuft - the flora at the rate the
  owner judged, the grass at the meadow's own (JUNGLE-GRASS: 3.19 plants a square metre) - and the meadow's grass keeps
  out of it.
- **The trails** (JUNGLE-TRAILS): DFU's ground has no paths but the network's roads and tracks; here the jungle wears
  its own trails into its tiles (`world/jungle/jungleTrails.js`), never the network's - the map, the landforms and fast
  travel read only the roads they did.
- DFU's fog is one `RenderSettings.fog` for the world; here a regional height haze multiplies it (and the sky takes it).
- DFU draws every streamed terrain the camera sees; here the haze culls what it hides whole.
- **Winter, as DFU's rainforest** (AUDIT BANTHA1 TREE-4, NAMED): the Rainforest climate is Swamp-based, so in winter its
  ground goes to 403 and wears snow, and the jungle stands on it unchanged - as DFU's palms do. Vanilla Enhanced's
  "Snowless Swamps and Jungles" (SNOWLESS1, `world/climateSwaps.js` `setSnowlessGround`) is the door that takes the snow
  off; a winter law of the jungle's own (or snowless jungle tiles by its share) is the owner's call.

## Verification

`test/world/bantha1_jungle.test.js` (33): the owner's files read (the fan, the mirror, the root, the winding, the bin), the
measures held to the files, every far picture standing on its root, the field and its continuity, the layout's four
storeys and where nothing stands, its own dice and its border, the species' ecology, the haze's law against a fine sum and
its shader twin run in `test/glsl.mjs`, every template in `src/` that calls the haze carrying its block, the cull's bound sampled, the easing, the colour and the sky, the host, the
renderer's two slots and the haze's arming, the door end to end over the real files, the hosts' wiring, the switch - and
AUDIT BANTHA1's (`01-Overview/audits/Audit-Bantha.md`): every program under `src/render` compiled whole, every fogged
pass's haze, the program's own sent state, the walk out, the recentre and the teleport, the cover index's wide grid,
the crown's sun, the node's glow, the groves and the stands across every edge, the neighbour's trunks, the wire by
column, the storeys on a pixel with glades (every canopy tree's species recomputed), the border tile by tile, the trees'
host over a fake door, the ring's haze in the GLSL reader, the sky's controller, the panel, the view out, the domes'
order. `tools/mutants/bantha1.json` (104: 103 dead and one recorded equivalent - the reach test's shortcut). LPT1's and
the moved pins re-aimed by content (`tools/mutants/lpt1_trees.json` and eleven more at the slice; eight lists more at the
audit, sd20c's put back as it was with its pins).

**BANTHA2.** `test/world/bantha2_area.test.js` (4): the area's rows and `banthaAreaHas`, the drawing they came from, the
world's field reading them, the derivation's four laws on a drawn map (High Rock's shore, the coast within reach and
not past it, the lakes and the land left unpainted, the staircase smoothed, the smallest features kept), and with ARENA2
the rows derived again on the freeware's map. `test/world/bantha2_floor.test.js` (11): the plants, a picture as a sprite,
the set, the pick as the GPU runs it, the stages, the colours (the ground's light, never its hue), the floor's ground,
the claim across the edge and at every origin, the host and the wiring; with ARENA2 (11th), the floor's ground on the
freeware's Swamp, Temperate and Mountain archives. `test/render/grassmeadow.test.js`'s colour law
runs the stage against its twin at the hue shares 1, 0 and a half. `tools/mutants/bantha2.json` (48, all dead with
ARENA2 and without); `meadow1.json` and `grasspx.json` re-aimed where the meadow's ladders became the set's.
**Seen in the running game** (2026-10-19, the freeware's data, headless Chromium on SwiftShader, the land view at 1,
`tools/grassLookProbe.mjs` waiting with `UNTIL` for the floor's field whole): Satakalaam's jungle (map pixel 839, 301),
summer at 10:00 - at eye level a carpet of ferns, fronds, broad leaves, palmlets and the owner's tufts in their own greens
under the canopy, thinning to single plants on the mud at a great trunk's foot; looking down, the earth between them. At
2.5 a square metre (the first photographs) a wall of leaves - the owner: "a little too much" - and the floor stood on
the swamp's dirt alone (the ground law above, "Where"): by place, about six times as many tufts stood in the same view.

**JUNGLE-GRASS.** `test/world/junglegrass.test.js` (3): the floor's grass the meadow's own rate, its flora the judged
rate plant for plant, the tuft and the sedge in proportion, the shares whole and the pick agreeing with them;
`tools/mutants/junglegrass.json` (6, all dead), and BANTHA2's density mutant re-aimed at the judged rate (`bantha2.json`,
48 dead with ARENA2). **Seen in the running game** (2026-10-19, the freeware's data, headless Chromium on SwiftShader, the
land view at 1, `tools/grassLookProbe.mjs` with four views from one spot 200-420 m out of Ceradbu, Mournoth, deep in the
area - a new game's Morning Star, the jungle's ground snowless): before, ferns, fronds and bushes over red earth with a
pale tuft here and there; after, the tufts and sedge filling the ground between the same ferns - 153,062 of the floor's
blades in view against 82,253 (a new game's winter takes the meadow's grass under the snow elsewhere; the floor stood
through it). The ground there: 87% DFU's grass record by place, 1.4% its green stone, which the floor stands nothing on
(`__findTiles` over the nine pixels about the village).

**Recorded.** The five pictures are the owner's own (2026-10-18, at AUDIT BANTHA1's opening: "These textures are ours") -
no pixel of them is ARENA2's; the doctrine's SUPPLIED rows say so (`test/tooling/doctrine.test.js`). **Where it stands.** On the freeware's own data (`tools/fetch-data.sh`, `tools/jungleExtent.mjs`, 2026-10-18) region
10, Bantha, holds no pixel of POLITIC.PAK and no place - Daggerfall names it and never paints it - so the jungle stood
nowhere; the owner chose Glenpoint (`JUNGLE_REGIONS` then, `world/jungle/jungleRegion.js`), due north of Daggerfall city -
until BANTHA2 (2026-10-19) stood it on the area the owner painted (Where the jungle is).
**Seen in the running game** (2026-10-18, the freeware's data, headless Chromium on SwiftShader, the land view at 1):
Hearthsly Court, 25 map pixels inside Glenpoint, summer - at 11:00 the manor's fields open ground under the haze and,
every other way, a closed canopy of the owner's trees with the kapok's parasols standing over it and palms in its gaps,
fading into grey-green air within a few hundred metres; at 06:30 the manor all but gone in the dawn's mist; with
`?jungle=off` DFU's conifers under a clear sky. **Open.** The frame time on a GPU (SwiftShader drew a jungle frame in
4-11 s, which says nothing of a GPU's) - `HEADED=1 SCENES=jungle npm run perf`, then again with `JUNGLE=off`.
