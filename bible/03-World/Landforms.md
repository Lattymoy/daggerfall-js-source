# Landforms - the heightmap raised, the roads cut in, the rivers in the land, the towns stood in it, the land rolling, each climate its own land

LANDFORM1-3, 2026-10-06. Mac, with a picture of the Iliac Bay's heightmap - the
bay black, the land grey, the Wrothgarian and Dragontail ranges white: *"Can we
adjust the heightmap to be more of this? and allow roads to carve through
terrian and caverns without breaking anything and rivers to actually have
depth, not just lying flat on land."*

LANDFORM4-5, 2026-10-07. Mac, with a shot of a walled town sunk in a pit, a
straight wall of ground a hundred metres tall round it: *"Whats up with these
steep cliffs?"*, then, of the answer that offered to stand the town on DFU's own
ground: *"I dont care about DFU. I want detailed generation, rolling hills,
varied terrian. This isnt about being 1:1"* (LANDFORM4 and LANDFORM5, below).
Then, asked whether that varies between environments: *"Shit, dude go all out
with this. I trust you"* (LANDFORM6, below).

The port's own terrain, behind the Features row `landforms` (Enhanced, World;
on by default; FORCED ON ONLINE; `?landforms=off` the kill door, offline). On
the classic skin, and with the row off, every height is DFU's to the bit. The
code is `world/landforms.js`; the Ledger row is `01-Overview/Port-Ledger.md`,
section A, LANDFORMS.

## The picture is WOODS.WLD's small heightmap

The image is 2000 x 1000: the 1000 x 500 small heightmap the sampler reads at
BASE_HEIGHT_SCALE, upscaled and stretched (its top 2% clip to white). Read as
data it says what the in-game ground already says - the lowlands' median and
the ranges' shapes are the same map - but in the game a range rises 1.5 km over
20 km and reads as rolling country, and on the picture it reads as mountains.
"More of this" is that map standing taller in the world. The picture itself is
a render of game data and does not enter the tree (Port-Doctrine, A RENDER OF
GAME DATA IS GAME DATA): every height here is derived on the player's machine
from the player's own WOODS.WLD.

## THE LAW: AT OR UNDER THE KNEE, A HEIGHT IS DFU'S

`LANDFORM_KNEE` is the beach line with its jitter (SCALED_BEACH_ELEVATION +
BEACH_JITTER, 41.5 kernel units), the highest height `generateTileData` can
still call beach. Every height at or under it is returned exactly as the kernel
made it; every height over it stays over it (a cut never takes ground under
the smaller of its own height and `LANDFORM_FLOOR`, half a unit over the knee,
clear of the classifier's float32 round trip). So the sea, the beach, every
tile class and every reader that only asks "is it water" stand where they
stood: the Deep Waters bake (its threshold is the ocean's), its carve (only
cells at the sea's height), the roads' router and the travel map's sea (raw
bytes), LW-DRY, the spawned dungeons' dry gate (kept on DFU's kernel - its
admissions do not move).

THE LANDFORMS MOVE THE GROUND, NEVER A TILE (AUDIT LANDFORMS D3). The knee
holds for the kernel's samples; a location's blend (`blendLocationTerrain`)
then pulls its whole pixel toward the pixel's mean, and the landforms move that
mean - a road's bed and a river's channel by centimetres, a massif behind a
town by up to 268 m (Chesterbrugh) - so a beach sample near a town crossed the
beach line where DFU's did not: 359 tiles in 97 of the 314 coastal location
pixels turned between sand and land on the real data. A location's tiles are
classified on DFU's own samples through DFU's own blend, which the kernel writes
in the same pass (`generateSamples`' `classic`): 0 of the 314 differ now, the
painter and the location's own tiles included, and where a tile parts from the
shaped ground it parts by at most 2.2 m (the Dunynak Excavation; 313 of the 359
by under 10 cm). The Deep Waters bake reads the same DFU blend
(`pixelWaterSampler`), so its water and the tiles' are one by construction.

NATURE ASKS THE BEACH OF THE SAME BLEND (AUDIT LANDFORMS II H2). DFU's nature
refuses a tile whose sample lies under the beach line, and it asked that of the
shaped blend while the tiles asked DFU's: 85 tiles in 43 of the 351 coastal
location pixels crossed the line, the gathering nodes' door flipped at 79, and
DFU's scatter refuses between its chance roll and its next draw, so one flip
reshuffled every later flat of the pixel. The kernel's DFU blend - smoothed
under the roads as the tiles are, and levelled by a World of Daggerfall site as
the ground DFU's nature reads is (WOD2) - rides beside the pixel as `beach`
(`terrainGen.js`), and the scatter, the woods, the ecotone's border tiles and
the gathering nodes' door (`natureStandsAt`, the herb and mine hosts) ask it:
0 of the 351 move. The flats still stand on the shaped ground (H3).

## ONE FUNCTION OF WORLD POSITION, INSIDE THE KERNEL

The shaper rides `sampleKernel`'s new `landform` argument
(`world/terrainSampler.js`), so every reader of the kernel takes the same
ground: the pixel's own samples, the ghost rows its edge normals read (EV4), a
promotion's restride (PERF-EXT26, on the worker or this thread), the gate's
beacon (GATE-SEEN, `gateGroundAt`). Nothing the shaper reads is a pixel's own:
its inputs are the sample's world position, WOODS.WLD, and the road network
every terrain kernel already holds - so a sample on a pixel's edge is the same
number from both pixels that share it, and the pin says so for every shared
edge and corner, bit for bit. Basic Roads' own smoother cannot do that (it
writes samples 1..127 of the painted tiles alone, and every bed it smooths
returns to raw ground at every pixel edge), so the mod's SmoothRoads still runs
after, as the mod runs it, over beds that are already level.

The kernel's two bicubic terms are factored out as `kernelTerms` (the same
arithmetic in the same order: the classic kernel is bit-identical, checked
against the commit before over 255,690 samples), so the macro height a path is
graded to is the kernel's own, never a second copy of DFU's interpolation.

## LANDFORM1 - THE HEIGHTMAP, RAISED

`reliefLift(low)`: the kernel's small-heightmap term alone (`low`, 8 x the
bicubic byte) lifts the sample - nothing up to 200 units over the knee (a byte
of about 30, the median land on the picture), then `0.9 * e` eased in by a
smoothstep to 900 over it (a byte of about 118). Only that term is lifted: the
large heightmap's hills and the ground noise keep DFU's scale, so the massifs
grow and the footing under a walker is DFU's (the ground noise lifted with
them is 25-metre spikes). The shaped samples have no ceiling at 1: a raised
mountain stands over the reference's normalising height instead of flattening
against it.

THE LIFT FADES BESIDE THE SEA (AUDIT LANDFORMS II I1, 2026-10-07; Mac, of the
rim: *"Is it too steep?"*, then *"Go ahead and do whatever you feel is most
detailed"*). The lift steepens a slope by up to 2.8 times, most where the land
already rises fastest - and nowhere does it rise faster than out of the sea.
Menevia's plateau stands bytes of 75 a pixel from the sea: lifted, its rim
stood at 70 degrees, a road down it dropped a walker 95 m (450 HP), and seven
of its 28 locations took falls on a run downhill that DFU's ground never gives
(124 approaches of 5,376, the worst 373 m, at the Dunynak Excavation). Every
51 m grade over 63 degrees the lift made new on the real data lay within three
map pixels of a sea byte, none further in. So the lift is faded by the sea's
distance: a byte node within a pixel of a sea byte (one whose `low` stands at
or under the knee - the beach line's own byte, 5, and under) keeps none of it,
one three pixels in keeps all of it, a smoothstep between (`cliff`,
`cliffFadeAt`) - in 1024ths, so the kernel's cubic over the nodes is exact and
a pixel's edge is one number from both pixels - and each sample reads its
nodes' fades through the kernel's own bicubic window, as `low` reads their
bytes. The rim stands as DFU stands it and the plateau behind it rises to its
whole lift; the far ring and the travel view fade a node's lift the same.
Measured on the real data: the pixels whose steepest 51 m grade passes 63, 68
and 72 degrees are DFU's own count again (52, 29 and 4; unfaded 116, 60 and
29), and only eleven more than DFU's pass 56 degrees, all inland; lane I's 24
journeys along the rim's and the Dragontail's roads bill nothing at x1 or
x100; none of the 28 rim locations takes a fall on a run in from its edge that
DFU's ground does not give; straight down the fall line from 54 rim pixels,
250 damaging runs of 10,056 against DFU's own 223 (1,267 unfaded), the worst
fall DFU's own 166 m (280 m unfaded) - the rest a road's bench across DFU's own
cliff (RESIDUES). A fade from one to four pixels changed none of those counts
and moved the lift at 909 pixels' centres where this one moves it at 570.

THE CEILING (2026-10-07, found on the real WOODS.WLD). The shaper is handed
DFU's height as DFU stands it - clamped at MAX_TERRAIN_HEIGHT, 1539 - and the
lift is level past the heightmap's 7-bit top (`low` 8 x 127, the byte DFU's
ceiling is built on), so nothing stands over `LANDFORM_CEILING`, DFU's ceiling
plus the most the lift adds (2416 units, about 3,020 m) - and since LANDFORM5
the tallest hill, `HILLS_TOP` (since LANDFORM6 the mountains', 128 units: 2544,
about 3,180 m). The numbers below are the lift's, the hills left out. Real ground never
reaches either: its bytes stop at 109 (at (963, 442), read raw - AUDIT
LANDFORMS D13) and DFU's kernel never meets its own
ceiling on them. WOODS.WLD's one byte over 127 does - a 255 at map pixel
(470, 355), in the sea off Tigonus (the "High Rock sea coast" region), among
bytes of 2 to 15. DFU's kernel stands it as a 1.9 km pillar, flat at its
ceiling, over the four pixels that share that corner; unclamped and lifted it
was a 5.1 km needle. Unfaded it stood at the landforms' ceiling as DFU stands
it at its own; a sea byte lies a diagonal step from it, so beside the sea it
keeps a ninth of the lift (THE LIFT FADES BESIDE THE SEA, above) - about 2.46 km,
DFU's 1.92 - and the re-stand's lift stays exactly what the landforms added
there too. A road graded across it is graded to DFU's macro as DFU stands it.
Whether the pillar should stand at all is a separate question (it is DFU's).

On a stand-in heightmap made from the picture (scratch only, nothing kept):
the land's median 459 m unchanged, the 90th percentile 1,180 -> 1,567 m, the
peaks 1,924 -> about 3,000 m; the steepest macro slope 11 -> 20 degrees.

THE FAR RING takes the same lift (`render/farRing.js` ringHeight's `relief`,
`reliefByteHeight`): it reads the byte the streamed kernel's `low` is
interpolated from, so the horizon's massifs rise by the lift the ground they
hand over to rises by. The travel view past the built grid reads it too. (The
ring leaves out the large heightmap's term and stands a byte at its pixel's
centre, as it did - EV8's own law, a residue below.)

## LANDFORM2 - THE ROADS ARE CUT IN

A road or a track is graded to the kernel's macro height (both bicubic terms,
the lift, no ground noise) read at the nearest point of its centre line. The
centre line is the network's own - roadNetwork.js's compass mask, each arm from
a pixel's centre to its edge or corner, the cardinal arm down the seam of tiles
63 and 64 and the diagonal down x == y, as the painter paints them - so the cut
runs under the painted tiles. Each arm's grade is a profile of 65 points along
it, read off the kernel terms of the pixel the arm belongs to (so the two
pixels on a seam read one profile).

THE CROSS-SECTION, per layer (`LANDFORM_DIALS`; distances in samples of 6.4 m,
heights in kernel units of 1.25 m): a level floor out to `flat`; a bank over
`bank` to its TOP - the smooth land, or for a river or a stream `drop` over its
floor where the land lies lower (a levee); then the land again, its ground noise
with it, over the `verge`. So a road on a hillside is cut into it with a bank up
to the land, and on its low side filled with a bank down to it over the same
width (AUDIT LANDFORMS E1: it was a level shelf the bank's whole width, the
levee's rule with a `drop` of 0 - a bed 32 m wide on a hillside, and fills to
11 m on the real WOODS.WLD where 4 m now stand). A BANK IS NEVER A LAUNCH RAMP
(AUDIT LANDFORMS II I2): level across, a bed on a steep hillside stood its banks
about twice the hillside's grade - 72 degrees and 19 m tall on a 53-degree
hillside at (627, 282) - and a run straight down across one launched into falls
of 20 to 49 m where DFU's ground is safe. A road's or a track's floor and bank
are held within what its bank climbs at `bankGrade` (half a grade) over the
smooth land, 4.3 m for a track and 5.3 m for a road; a river's or a stream's
floor never (its water is level). Where a level bed would stand further off its
hillside than that, the bed leans with it: 2 of 300 straight roads sampled on
the real data, the most 0.98 m across the painted tiles. Near a centre or a bend the
arms grade a sample together (inverse-square weights on the squared distance,
so the nearest is all but alone and a bend's inside is a blend, never a step),
and an arm the sample lies BEYOND the end of stands down over one sample - a
straight road is two arms meeting at every centre and pixel edge, and the one
alongside grades it (the road is level across to the float).

| layer | flat | bank | verge | drop |
|---|---|---|---|---|
| stream | 1 | 1.25 | 4 | 0.8 (1 m) |
| river | 2 | 1.5 | 6 | 1.92 (2.4 m) |
| track | 1.25 | 2 | 5 | 0 |
| road | 1.25 | 2.5 | 6 | 0 |

The layers lerp in paint order, the last winning (roadPainter.js paints road,
river, stream, track - the first painter to write a tile keeps it): a road over
a river is a causeway. A CHANNEL IS THE WATER'S (AUDIT LANDFORMS E2): where a
sample lies in a river's or a stream's channel - its floor, and its bank by how
far up it - a road stands there on its own bed alone, the causeway's top, and
its bank and verge give way to the channel. They refilled it: on the real
WOODS.WLD the painted water climbed up to 19 m out of its floor beside 629
crossings and riverside roads (55,096 wet corners lifted half a metre or more).
A TRACK OVER WATER IS A FORD (AUDIT LANDFORMS II J1): the painter paints the
water across a track, so a track gives way to the channel on its own bed too.
It stood a causeway there, and 7,674 wet corners on a track's bed stood half a
metre or more over their channel's floor, the worst 7.87 m - most of the
11,191 the first audit left and called the road's. What stands over a floor now
is the road's own edge row (RESIDUES).
Each layer's reach is its flat, bank and verge (under ten
samples), well inside the 3 x 3 pixels a shaper gathers its arms from. Within
`coast` (12 units) over the knee every cut fades in from nothing, so a path run
down to the beach meets it without a step.

"CAVERNS": the ground is a heightfield and cannot hold a tunnel. A road meets a
ridge's own relief (the ground noise, and the shoulder of a hillside) with a
cut, and a hollow with an embankment; a road over a whole range still climbs
it. A tunnel through a mountain is a separate thing to build - a hole in the
heightfield, a mesh and a collider - and is not this slice.

## LANDFORM3 - THE RIVERS LIE IN THE LAND

Basic Roads' rivers and streams take the same cut, dropped under the land: the
water's floor flat across the whole painted width (a river's two centre tiles
and its banks, a stream's two tiles), a bank on the high side, a levee on the
low side never lower than the land at the river's own centre line. WATER1's
film - the ground's own triangles, lifted a hand's breadth - therefore lies
flat in a channel with banks above it instead of on the field. The player swims
on that film as DFU swims them (MAC2's law: the swim is where the surface is
drawn), so nothing about water changes but where it lies.

Rivers are cut where they are PAINTED and nowhere else (the network's
`water`, RiversAndStreams - a channel with no water in it is a ditch): the job
carries no river switch of its own, so the painter's switch is the cut's.

ONLINE TOO (2026-10-06, Mac, asked whether the channels should reach a room:
*"Yes rivers should be online"*). This slice first kept them out: the river
switch was each player's own online (`systems/onlineLane.js`: "a river paints
tiles and never moves a height"), and a channel one player cut and another did
not would stand two players on two floors. A river cut into the land IS ground,
so the switch is the room's now - in `ONLINE_ROOM_MOD_KEYS` beside Enabled and
SmoothRoads, the roads' own reason - and the room's rivers are ON, past the
mod's shipped off: a room that held the mod's default would have no rivers at
all. It is the one key the room forces past its default, named so in
`test/modsonline.test.js`. The old sentence was true of Basic Roads' smoother
and still is (its pin still measures it); it is the landforms' kernel that
moves the height. Offline the switch stays the player's, off as the mod ships
it, and the online sync (UXB1-E) copies the room's on home with the rest.

WATER2 (THE BASIN, 07-Rendering/Water-Arc.md) was reverted on 2026-09-12 with a
lesson: the eye was never in the loop. It lowered the drawn ground under a
surface that kept the old height, and the game stood on neither. This slice
moves the ground everything reads - the collider, the nature, the grass and the
film alike - and draws nothing new.

## LANDFORM4 - A TOWN STANDS IN ITS LAND

WHAT THE SHOT SHOWED. DFU levels a location after the kernel
(`blendLocationTerrain`, BlendLocationTerrainJob verbatim): its rect to the
mean of its whole pixel, and a linear ramp from the rect's edge back to raw
ground by the pixel's edge - so the whole rise between a town and the land round
it is taken inside one pixel, over the band the rect leaves (about 30 samples,
190 m, beside a 4x4 town; about 13, 85 m, beside a 6x6). DFU's own ground on a
hillside already stood that ramp steep; LANDFORM1's lift steepens a slope by up
to 2.8 times, and the ramp stood as a wall. On a synthetic upland like the
shot's (bytes rising 5 a pixel, lifted), the steepest 51 m grade round a 4x4
town was 39 degrees, round a 6x6 53, on land whose own steepest is 24. The
shot's own town is almost certainly Kalunnunu (754, 279; AUDIT LANDFORMS III
lens D), a 6x7 walled city in Lainlyn's rainforest four pixels from the
Sepulcher of Stadezeon - and there the lift is nothing (bytes of 14-19): its
wall was DFU's own south ramp, 48 degrees, 120 m over 19 samples, which
LANDFORM1-3 left as it was. Pulled, that ramp falls to about 18 degrees.

THE LAW. Every one of the game's own locations is a SITE (`landformSites`):
its footprint - the block grid from its tile origin with setLocationTiles' own
clearance, read off the map table alone (`locationFootprintRect`,
terrainTiles.js, beside setLocationTiles; its rect is the stamped tiles' and
lies inside) - four bytes a pixel, made once on the main thread as the world
mounts and handed to both kernels (`TerrainGenClient.setLandformTables`, the
worker's `landform-tables` message, beside LANDFORM6's climates) before the
first pixel is asked of either. The game's own rows alone (HUB1's), each as
MAPS.BSA holds it: a mod's addition and a spawn never move the ground, and a row
a town pack serves in its place is read again past the world-data door
(`MapsFile.locationReplaced`, `readClassicLocation` - AUDIT LANDFORMS III B1:
Beautiful Villages resizes 3,240 grids and Beautiful Cities 120, and a client
whose pack failed to load stood the wild ground round them up to 120 m off its
room's), so every client of a room stands on one. Inside the shaper each site pulls the ground
toward its LEVEL (`pullTo`): weight 1 inside its rect, easing to 0 at its reach
past it (1 - smoothstep), the land keeping the product of (1 - weight) and the
rest going to the sites' levels, each weighted by its weight to the fourth. A
pull UP is eased in by how far the land stands over the knee toward the level
(smoothstep of (land - knee) / (level - knee) - AUDIT LANDFORMS III A1): at the
beach line the land is DFU's, and a sample beside it was pulled whole to a
coastal town's level - walls at the beach round 85 real coastal pixels over
50 m past DFU's own step, 149 m beside Penwold. Eased, a coast's land rises to a
town no more than 1.69 times as steeply as it rises on its own (0 such walls
over 5 m now, the worst 2.0 m). So a rect's land at or over its level stands at
it, and land under it is raised by the ease - high over the knee all but
whole (on the upland below within a tenth of a unit), on a strand part way.
The reach is `reach` (40 samples) plus `per` (3) times the rect's half-extent,
never more than `most` (124 - so no further than the pixels beside the site's
own): 70 samples (450 m) round a 1x1, 94 round a 2x2, the most round a 4x4 and
over. The LEVEL (`siteLevel`) is the mean of the site's pixel's land on a coarse
grid (every 8 samples, its edges included): DFU's kernel, the lift faded as the
shaper fades it, the hills - no path's cut, no water's valley and no site's
pull, so it is one number however the network stands - on its own climate's
land (LANDFORM6; AUDIT LANDFORMS III C2 pinned it: on the woodlands' hills a
Mountain site's level moved a median 18.6 m, 110 m at most), and its LAND's
alone, the samples over the knee (AUDIT LANDFORMS III D4): DFU's blend averages
the sea and the beach into the town after the kernel, and a level that had
counted them already pulled a coastal town's land down to a sea-dragged mean
that the blend dragged again - six real coastal towns stood under the beach
line, 13 m under DFU's own (Gothcroft 45.0 m, DFU 58.3), none now. DFU's own blend still
runs after the kernel, still the location's, and finds its pixel all but level
at that mean (the 6x6 below stands within 3 m of its level). A road's profile
is pulled too, so a road comes into a town on its level; the ground noise is
levelled by the share the pull takes. A site whose pixel has no land on the
grid (a site in the sea) stands at the whole pixel's mean, under the knee, and
pulls the land beside it down no further than LANDFORM_FLOOR, as a cut is held. The pull is a pure function of world position and the sites:
the sites about a pixel are gathered in one global order (pixel row, then
column), so a seam is one number from both pixels.

Measured on that synthetic upland (`test/landform45.test.js`): round the 4x4
town 24.1 degrees on land of 24.3, round the 6x6 22.9 on 23.5, round a 2x2
hamlet 23.6 on 23.6 (walled: 39.4, 53.4, 28.5). ON THE REAL DATA (AUDIT
LANDFORMS III, the freeware ARENA2 in scratch): of 60 towns of 3x3 blocks or
more, 56 stand within a degree of their bare land's steepest 51 m grade; four
do not (walled / pulled / bare: Wadijirius 64 / 39 / 30, Akhera-Korom 38 / 16 /
12, Crossley 31 / 34 / 31, Singwick 22 / 24 / 22) - a level town on a steep
mountainside has to give its rise back to the land within its reach (124
samples, 794 m), and on the steepest it gives it back a few degrees steeper than
the land's own (RESIDUES).

## LANDFORM5 - THE LAND ROLLS

A field of hills over every land sample (`hillsAt`), a pure function of world
position (x east, y north, in samples - a seam is one number from both pixels)
and the land's own macro height:

- THE SHAPE: three octaves of the port's Perlin noise (wavelengths 300, 125 and
  50 samples - 1.9 km, 800 m, 320 m - weighted 1, 0.36, 0.1), their domain
  pushed about by a warp of 80 samples over 520, so the hills wander rather than
  sit on the noise's grid; the sum held to -1..1. The two slow fields - the
  region and the warp - are read at the nodes of a 16-sample lattice on world
  positions and bilinearly between (`HILL_NODE`, `hillLattice`: a pixel's shaper
  makes its own nodes once, and a point off them makes the same nodes where it
  is asked, so no number changes with who asks); the octaves at the sample.
- THE HEIGHT: a REGION field (wavelength 2,400 samples, about 15 km) sets it
  between a land's `low` where the country lies near flat and its `high` where
  it rolls hardest; on the high ground it stands up to the land's `upland` times
  that, fully by 700 units of the small heightmap's term over the knee. The
  woodlands' (these rolling hills; every land's before LANDFORM6, and every
  sample's with no climate table): 4 to 48 units (5 to 60 m), 1.6 on the high
  ground, 76.8 units (96 m) at the most. Across 13 km squares of the synthetic
  world the field's span runs from a few units to over three times as much.
- THE KNEE: eased in from nothing over `coast` (1.25) times the land's tallest
  hill of its height over the knee - 96 units for the woodlands - so a hill or a
  dale is always smaller than that height (at most 0.9 of it): nothing the hills
  touch crosses the beach line, and the sea, the beach and every tile class
  stand where they stood (THE LAW above).
- A RIVER CUTS ITS VALLEY (AUDIT LANDFORMS III C1, `carve`): within `valley`
  of a painted river's centre line (120 samples, 770 m; a stream's 96) the
  hills ease down to the deepest dale their land can stand (`hillsAt`'s `out`,
  the lands' tallest hill there) by 1 - smoothstep of the distance, never above
  the hills themselves and never under that dale - so the water lies under every
  hill across its valley, its floor flat a little way either side, its walls
  rising to the land's own hills; where a stream meets a river the deeper carve
  wins. The centre lines are the network's own arms from the 5x5 of pixels
  round a pixel, the nearest taken: a seam is one number from both pixels. The
  first law stilled the hills to nothing along the water (`waterFade`), and
  where its land was a dale the river stood over it on an embankment: on the
  real map 215 of 2,882 inland water pixels stood over every dry neighbour by
  more than 10 m, the worst 77 m (the foothills' wrong centre, A2, much of it).
  Now on the synthetic world no dry sample lies further under its river than on
  DFU's own land (`test/auditlandforms3.test.js`), and on the real map the river
  centres over their lowest dry neighbour by more than 10 m are 266 (1,612 with
  the stilling and the stale centres) - under DFU's own land's 957 (the hills off). Only where rivers
  are cut (the network's `water`); with them off the hills stand there too.
- THE PATHS RIDE THEM: a road's and a track's profile is the land with its hills
  (carved into the water's valleys, and the sites' pull), so a road follows the
  hills and cuts only the ground noise, as before.
- THE SITES LEVEL THEM: a town's pull takes its hills with the rest of its land.

Steepest 51 m grade of the hills alone on the high ground: about 7 degrees -
rolling, never a cliff; on a sea cliff's rim they leave DFU's grade as it was
(1.082 against 1.079, AUDIT LANDFORMS II I1's pin). The path laws' own pins
read their cuts on the land without the hills (`createLandforms`' `hills:
false`, which no kernel of the game passes) - taking a river away now gives its
valley's hills back, which is the valley, not the cut.

COST, measured on the synthetic world in this container: the kernel's pass over
a pixel 5.5 ms without the hills, 9.4 ms with them - the three octaves a
sample, about 200 ns; the lattice halved the slow fields' share (11.8 ms read at
every sample) - and a whole job with the network about 17-18 ms. On the real
data (AUDIT LANDFORMS III lens D, on the audit's snapshot, three probes on the
other cores): a whole job a median 19-26 ms by climate against DFU's 10.5-11.9
(about twice), the first pass of a pixel up to 108 ms; the kernel alone 13-21
ms against DFU's 5-8 (the foothills the worst) - over this page's synthetic
numbers.
It runs on the terrain worker, off the frame. A site's level (289 kernel
reads, about 0.3 ms on the real data) is kept per world and climate table,
4,096 of them, the longest kept let go first (AUDIT LANDFORMS III R7: they were
all let go at once) - with 15,251 sites a level a long walk left behind is
asked again. LANDFORM6's costs are its own (below).

## LANDFORM6 - THE LAND WEARS ITS CLIMATE

Every climate's land wears its own hills (`LANDFORM_DIALS.lands`, one entry a
land; CLIMATE.PAK's ten values each name one, any other value the woodlands').
Each land's height is LANDFORM5's law with its own `low`, `high` and `upland`;
its SHAPE is its own (`shapeRaw`), centred on its own field so the land's mean
height is untouched (`LAND_NORMS`, by land: each land's mean and spread measured
over its own shape's field with its own dials, nine in ten of its points inside
-1..1 - the deserts and the knolls share shapes and keep their own spreads;
every land's mean hill within 3 in 100 of its height - AUDIT LANDFORMS III A2:
the mountain woods' centre was the ridgelines' before RIDGED_NORM was set, and
stood every mountain wood 13-18 m low, mostly dales; the haunted woods' 3 m
high) and
held inside -1..1 without a
crease (`saturate`: itself to 0.6, easing toward 1 past it, so a summit or a
valley floor a shape overreaches rounds off instead of being cut flat):

| land | climate | shape | height (units) | on the synthetic field (10 km, 51 m grades) |
|---|---|---|---|---|
| woodlands | Woodlands (231) | rolling: LANDFORM5's octaves | 4-48 x 1.6 | 88 m across; p99 5 deg |
| mountain woods | MountainWoods (230) | foothills: half rolling, half ridgelines | 8-56 x 1.6 | 191 m; p99 16 deg |
| mountain | Mountain (226) | ridgelines | 16-80 x 1.6 | 260 m; p99 24, at most 37 deg |
| desert | Desert (224), the Alik'r | dune seas, mesas where the rock field rises past 0.3 | 6-26 x 1.3 | 52 m; p99 23 deg |
| desert2 | Desert2 (225), Dak'fron | the same, mesas from -0.1: far more rock | 6-30 x 1.3 | 58 m; p99 17 deg |
| rainforest | Rainforest (227) | karst towers over plains | 8-50 x 1.4 | 86 m; at most 44 deg |
| subtropical | Subtropical (229) | soft broad domes over a roll | 6-44 x 1.4 | 110 m; at most 29 deg |
| swamp | Swamp (228) | hummocks: broad shallow hollows, low mounds | 2-6 | 14 m; p99 2 deg |
| haunted | HauntedWoodlands (232) | broken: a roll gashed by ravines, studded with crags | 6-40 x 1.5 | 126 m; p99 25 deg |
| ocean | Ocean (223): no land pixel of the real map after the boot's coastal dilation (44 before it - AUDIT LANDFORMS III R4) | rolling, low | 2-24 x 1.6 | 44 m; p99 3 deg |

THE SHAPES:

- RIDGELINES (`ridgeline`, `ridged`): a ridged multifractal - each octave
  folded about zero, so the noise's zero lines stand as crests, and squared, so
  its far reaches fall away as valleys; the finer octaves ride the high ground
  of the coarser, so ridges carry spurs and valleys stay smooth; only the first
  crest is sharp (`softAbs` rounds the others). The ridges are stretched 2.2
  times along a TREND, so a range keeps its line for kilometres - one of two
  trends (`RANGE_A`, `RANGE_B`), the slow rock field choosing and blending
  between them, so ranges turn between massifs. The first pass, isotropic,
  stood closed crater rims (the noise's zero lines close on themselves); the
  stretch made them ranges.
- DUNES (`dunes`): crests across a fixed wind (`DUNE_WIND`, a little south of
  west), 64 samples (410 m) apart; each a long windward rise over 72% of the
  spacing and a short slip face over the rest - a cosine either side of the
  crest, so neither crest nor trough is a crease (`cosPi`, below). The phase is pushed about
  (along and across the wind, never so fast it runs backward) so the crests
  wander, fork and break, and a slower field thins them to bare pans between
  dune trains; a broad swell under them. On the field crests cross a line run
  downwind twice as often as one run across it, and the slip face falls twice
  as steeply as the windward face rises.
- MESAS (`mesas`): two flat-topped tiers with steep sides, cut where the noise
  crosses two levels; a desert's sand gives way to them where the slow ROCK
  field (a fourth lattice value, 17 km) rises past the land's `rockFrom` - 0.3
  for the Alik'r, mostly sand; -0.1 for Dak'fron, mostly rock (about five
  times the flat-topped high ground on the field: 0.023 against 0.004).
- KNOLLS (`knollField`, `knolls`): one hill to a cell of `cell` samples, a
  `fill` of the cells holding one, each at its own place, girth, height and lean
  (an ellipse to 1.6 to 1, turned its own way - an integer hash of its cell,
  `cellHash`, world-placed), its side `edge` of its radius wide, a dome on its
  top, the broad ones the taller; where two meet the taller stands. The slow
  rock field gathers them - tall in clusters, low mounds between - as a height,
  never whether one stands, so none is ever cut through. The rainforest's are
  karst towers (cells of 120, edge 0.88); the subtropics' soft broad domes
  (cells of 210, edge 1, over a roll of their own). The first pass thresholded a
  noise and stood sausages; the cells stood towers.
- HUMMOCKS (`hummocks`): three soft octaves at long wavelengths and a few metres
  - a swamp is flat ground.
- BROKEN (`broken`): a rolling land read through twice the warp, gashed by
  ravines - narrow V cuts along a twisted noise's zero lines, three quarters of
  the land's height deep - and studded with crags; it cuts down more than it
  stands up.

THE BORDERS (`landShares`): a node at every map pixel's centre wears its pixel's
climate (at the shaper's own span - AUDIT LANDFORMS III A7), read through a
smoothstep-weighted bilinear, so a land holds whole over its own pixels and gives way to its neighbour's
across about a pixel; where lands share a sample their hills are summed by their
shares, each land's own height and shape, and the ease over the knee by the
shares' tallest hills. A pixel in from a border a land's hills are its own to the
bit; across the border the blend adds the shares' slope times the two lands'
difference to their grades - on 1,000 real border strips its steepest 51 m grade
passed both lands' own in 104, by 5.4 degrees at the most (woodlands into
mountains at (592, 31); AUDIT LANDFORMS III A3: this said within the steeper
land's own). The climates are a table (`landformClimates`, CLIMATE.PAK's value for every
pixel, read after the boot's coastal dilation), made once on the main thread and
posted to the worker beside the sites (`TerrainGenClient.setLandformTables`, the
worker's `landform-tables`); every kernel reads the same climates, so every seam
is one number from both pixels and every client of a room stands one ground.
Nothing here reads a climate's season, weather or nature - the shape is the
climate's own, all year.

ONE FLOAT IN EVERY ENGINE (AUDIT LANDFORMS III A8): the cosine, sine and
exponential the shapes take - the dunes' faces, a knoll's turn, the saturation -
are series of correctly rounded steps (`cosPi`, `sinPi`, `expNeg`, within
4.5e-16 of V8's own), and no source of the ground (the kernel, the landforms,
the jobs, a town's tiles) asks an engine's own `Math.cos`, `Math.exp` or `**`,
which the language leaves each engine to approximate. LANDFORM6 had brought them
in, the first ground to ask one; a save stood in one browser and read in another
read its hills a few ulps apart.

THE STEEPEST: no land's 51 m grade passes 45 degrees on the field (the mountains
37, the rainforest's towers 44, the haunted woods' ravines 40, the dunes' slip
faces 33). Each first pass stood steeper - slip faces at 59, mesa walls at 53,
towers at 57 - and was softened (the dunes spaced wider and lower, the mesas'
sides widened, the towers' sides 0.88 of their radius and their height tied to
their girth).

COST (the synthetic world, this container): the kernel's pass over a pixel 9.6
ms in a swamp, 10.1 in the mountains, 10.9 on the coasts, 11.4-12.5 in the
deserts, 11.6 in the woodlands (0.9 ms more than with no table), 12.7-13.5 in
the haunted woods, the rainforest, the subtropics and the foothills, and 14.8
at the worst border (a checkerboard of two lands, every sample blended). The
knolls ask only the cells a knoll can reach from the sample's side, and reject a
cell on its circle before any trigonometry; the climate lookup reads its four
nodes without a closure. Against LANDFORM5's 9.4-10.4. On the real data the
kernel stood 13-21 ms a pixel (LANDFORM5, above).

ON THE REAL GROUND (AUDIT LANDFORMS III lens D, on the audit's snapshot) the
lands' hills ride DFU's slopes and the lift, so a grade the field never shows
stands where they add: the steepest 51 m grade over a town's 3x3, a median 11.9
degrees (DFU 8.8, LANDFORM1-3 9.1), 56.8 at the 99th percentile (39.9, 45.2),
69 towns' 3x3 over 45 degrees (18, 37); the mountains' median 15.6 -> 26.9
degrees, the haunted woods' 7.4 -> 18.4, the rainforest's 8.3 -> 16.9, the
deserts' 7.1 -> 15.9. The body follows it: straight down the fall line at
Cudeh-Hassi (57 degrees) and Hollech no damaging run - the falls lens D found
were the knee's walls (A1) alone. The roads ride them too: the grade along 50
straight road pixels a climate at the 95th percentile, LANDFORM1-3 -> shipped,
the deserts 6.6 -> 16.5%, the haunted woods 6.7 -> 15.6, the rainforest 9.1 ->
13.9, the mountains 21.0 -> 34.0 (the worst a desert road at 25 degrees, a
mountain track at 44) - which LANDFORM7 eases (below).

WHERE THE STEEPNESS COMES FROM (measured for LANDFORM7, the final code): not
the hills stacking on DFU's slopes. Over the 300 steepest pixels of the map (by
their bytes' rise) the share of 51 m grades over 45 degrees is 2.19% on the bare
land (LANDFORM1-3) and 2.53% with the hills, the steepest 79 degrees either way;
over 300 random land pixels no grade passes 45 with the hills or without, and at
every grade of the bare land the median grade with the hills is the bare's own
(24.1 -> 24.0 degrees where the bare land stands 20-30). The hills add their
roughness evenly; the steep ground is DFU's and the lift's, and a mountain's own
ridgelines (24 degrees at the 99th percentile on flat ground, by design). The
lens's town figures are the steepest sample over nine pixels. Hills shrunk by
the land's slope would have taken the detail off the steep ground for a third of
a point of grades over 45 degrees, and were not made; where the hills did bite
was the roads.

## LANDFORM7 - A ROAD EASES THE HILLS

(2026-10-08, Mac, of the hills on the real ground: *"Do your thing"*.) A road's
profile is the land with its hills, so a road climbed every hill the country
wore: the grade along a straight road at the 95th percentile, on the real map
and the vendored network, rose from the bare land's 7.5% to 18.5% in the
deserts, 7.2 to 15.6 in the haunted woods, 8.4 to 15.5 in the mountain woods,
8.5 to 14.7 in the rainforest, 22.6 to 28.8 in the mountains.

THE LAW (`easeAt`, `LANDFORM_DIALS.ease`): within `road` samples (40, 256 m) of
a road's centre line, `track` (28, 179 m) of a track's, the hills ease down to
`keep` (0.35) of themselves on the line - 1 - smoothstep of the distance, the
nearest way's where two reach - so a road and its verges lie on the smooth
ground through the country and the hills rise again beside it, a road through a
dune sea a gentle corridor, over a ridge a saddle. The road's profile reads the
eased land like any sample, so the cut is the same cut on it. Before the
valleys' carve (AUDIT LANDFORMS III C1), which takes a river to its dale
whatever a road does: where a road crosses a river the water's floor is the
floor without the road, to the bit. The arms are the 3x3's - a sample, or a
profile point a sample reads (within two samples of a shared edge), lies nearer
no arm of a pixel two off than 116 samples - and the nearest is order-free, so a
seam is one number from both pixels. A pull, a level and the far ring take none
of it (a site's level is one number however the network stands).

ON THE REAL MAP (the freeware ARENA2 and the vendored network, in scratch): the
grade along a straight road at the 95th percentile now 9.9% in the deserts
(bare 7.5), 8.9 in the haunted woods (7.2), 10.8 in the mountain woods (8.4),
10.1 in the rainforest (8.5), 24.1 in the mountains (22.6), 7.6 in Dak'fron
(6.9); the woodlands, the subtropics and the swamps all but unmoved (their hills
were already gentle along the roads). The steepest 51 m step along any road
read, a mountain road at (602, 4): 37.5 degrees (36.2 before, 31.5 bare). THE
SEAMS: 247,680 shared edge samples beside 240 road and track pixels and their
neighbours - 0 differ. COST: a whole job on a road or track pixel 22.0 -> 22.2
ms (median of 120, the arms of the 3x3 read once a pixel). The towns' band and
the coast unmoved: the steepest 51 m grade round 3,444 towns over 35/45/55/63
degrees 33/9/3/0, the steps over 10/20/30 m at 914 coastal sites 24/3/0. NOT
SEEN IN THE RUNNING GAME - Mac's eye.

## THE SAVES: EVERY HEIGHT IN DFU'S FRAME

TERRAIN-SCALE1's re-stand, given a second arm (AUDIT LANDFORMS C1/B4). Every
exterior height a record carries - the save's player, piles, torches, camps,
foes, guards and inside pools, the exterior scene cache, the ship's remembered
deck, the recall anchor, a dungeon save's camps left outside - is written in
DFU's frame: the landforms' lift at the record's own spot (`landformLiftAt`)
taken off as it is written (`groundFrameHeight`, `groundFrameNative`,
`campToRecord`) and put back on as it is read (`restandHeight`), whatever the
row says. A record says nothing of the row - no stamp, SAVE_VERSION 1 - and a
build without the row (a desktop copy that has not updated, the site after a
revert) reads a landforms save as it always read one, every height over its own
ground. The slice's first cut stamped `landforms: true` on lifted heights, and
every such build would have dropped the character by the lift: over 25 m (a fall
billing 100 HP) at 30% of the land, 184 m at the 90th percentile of the towns.

The lift is the field the row puts there, taken through the location's own
blend (`blendLocationTerrain` over the field - the blend is linear in the
samples), so a town's levelled ground is exact. For a pixel not built yet - a
load stands its records before their pixels stream in: its camps anywhere in
the world, a neighbour's piles and guards - the rect is the one its build will
stamp: the location's own, asked of the index, or online the spawn its roll
stands (`_liftLocationAt`, the Overworld's side-effect-free probe, declared
beside `_locationToBuild` before the boot's load - it was bound after it, and
online that load is the only one: AUDIT LANDFORMS II F1, a camp by a spawn's
door drifting 24 m a session). It was the wild lift there (AUDIT LANDFORMS B1):
up to 203 m off a location's levelled ground (Tamarilyn Coven; 1,036 of 15,251
locations over a metre at the rect's centre), into a camp that is never stood
again. The fields a save asks are kept, the last 32 (F3). With LANDFORM4-6 a
town's field costs more on the main thread - a city's a median 21 ms, up to
61-100 ms with its sites' levels cold, nine town pixels about 190 ms (F3
measured 146 ms before them; AUDIT LANDFORMS III lens D, on the snapshot).

The field is the kernel's own shaped ground less DFU's over the network this
thread holds (AUDIT LANDFORMS B2): the lift with a road's cut and fill and a
river's channel, asked of the two kernels a sample at a time in the wild and in
one pass through a town's blend (the kernel writes DFU's samples beside the
shaped ones, `generateSamples`' `classic`), made again once the network lands.
It was the lift alone, and across a change of the row - the one-time stand of
every save from before it, or a landforms save read with the row off - a record
by a path took the cut's difference with it: on the real data up to 29.8 m over
a road's cut on a hillside (a fall billing over 120 HP), and over 5 m at 555 of
the 701,841 samples the cuts move. Now a record goes out and comes back exactly within a
build, and across a change of the row it lands within 1.6 m over and 2.0 m
under its ground in the wild (the mod's SmoothRoads, which smooths DFU's own
road and not the level bed; 99th percentile 0.07 m) and within 0.9 m in a town.
Not followed: World of Daggerfall's flatten. A body under its ground the
collider lifts. The interior cache is in its building's frame and moves with
the ground.

WHAT LIES ON THE GROUND RIDES THE NETWORK'S LANDING (AUDIT LANDFORMS II G1/G2).
When Basic Roads' arrays land after a pixel's first build - online through
C3's retry, a slow boot, offline a failed fetch - ROADS 25 rebuilds the pixel,
and the landing moves the ground by metres now (14.2% of the samples of all
52,229 path pixels, the worst 30.1 m). Piles, torches, camps and corpses kept
their stood height (only HCC's carts were stood again, DISC20-C) and the next
save kept the offset: a pile 27.98 m in the air at (795, 191); the player the
season hold kept standing there fell the cut, 118 HP. A torn pixel's samples
are kept until its rebuild publishes (`_groundBefore`, the last 64), and then
every pile, torch, own camp, corpse, foe and guard on it - and the player,
when grounded - rides the new ground less the old at its spot (`groundMoved`
on the five pools, `rideGround`); a deck camp rides its deck, and a fall under
way keeps its own (FALL-KEPT). The rides are bound once the pools and the player
stand: read from the publish itself they were a dead zone in the boot's first
build, which the network lands inside on most boots (AUDIT LANDFORMS II K1 - a
headless boot died on it before the push).

## THE FOUR HOSTS

- `scenes/world.js` - WIRED: the switch read once at the mount, the job's `landform`, the promotion's and the
  restride's ghost rows, the gate's beacon, the far ring and the travel view, every record's height written in DFU's
  frame, and the re-stand. LANDFORM4-6: the sites and the climates made once at the location index's fill and handed to
  both kernels (`setLandformTables`), and carried by this thread's own landforms (`landformsHere` - the gate, the
  re-stand) and its restride; the far ring and the travel view take neither (RESIDUES). LANDFORM7 adds no wiring: the
  ease reads the network every one of those landforms already holds.
- `scenes/worldModes.js` - its own heights NOT WIRED, by design (AUDIT LANDFORMS C1): the heights the world host hands
  it are DFU's frame already, and its interior cache is in the building's frame. A legacy cache (raw scene positions,
  written before TERRAIN-SCALE1 carried the frame) is stood again through the world host's `restandSceneHeight` - the
  re-stand, the lift with it (AUDIT LANDFORMS II J13: this line said NOT WIRED alone) - and since LANDFORM4-6 the pull
  and the hills with it, the same field (and LANDFORM7's eased hills beside a road).
- `scenes/dungeonContext.js` - NOT WIRED, by design: the camps left standing outside reach its save through the world
  host's `outerCampsSave`, in DFU's frame. LANDFORM4-6 change nothing here: the pull and the hills are in the frame's
  field like the lift; LANDFORM7's ease the same.
- `scenes/exterior.js` - NOT WIRED, by design: the fixed-city bench runs no terrain kernel at all (no tile pipeline,
  Roads.md's MODS AUDIT); it stands its one city on the location's flat ground - DFU's ground, which is the frame
  every record is written in. LANDFORM4-7 the same: no kernel, no sites, no climates, no roads eased.

## ON THE REAL WOODS.WLD (2026-10-07)

Measured on the freeware data (`tools/fetch-data.sh`) and the vendored Basic
Roads network, in scratch, with the slice's own functions:

- THE KNEE: 400 coastal pixels, 6,656,400 samples (1,632,017 at or under the
  knee) - 0 violations. THE SEAMS: 38,700 shared edge samples beside path
  pixels - 0 differ. Re-measured with AUDIT LANDFORMS II's fixes in, the same,
  and wider: every coastal path pixel (9,712; 161,617,392 samples, 27,780,627 at
  or under the knee) 0 violations and 0 tiles; 530,706 shared edge samples beside
  2,057 path pixels and 20,570 ghost-row samples, 0 differ.
- THE RELIEF, one sample at each land pixel's centre (319,785 pixels): the
  median 484 m unchanged; the 75th percentile 786 -> 834 m, the 90th 1,109 ->
  1,352 m, the 99th 1,369 -> 1,867 m; the highest real ground 1,689 -> 2,673 m
  (the Dragontail summit, pixel (943, 470), thirteen pixels from the sea);
  45.7% of the land lifted by more than a metre (with the lift faded beside the
  sea, AUDIT LANDFORMS II I1 - unfaded the 90th was 1,353 m and 45.8%). Over
  the whole Bay at two samples a pixel, only the glitch's four samples moved
  with THE CEILING.
- THE ROADS, 300 straight road and track pixels (re-measured with AUDIT
  LANDFORMS II's fixes in): the bed's tilt across its painted tiles median
  0.57 -> 0.00 m, 95th percentile 2.27 -> 0.00 m, worst 9.66 -> 0.98 m (two beds
  the bank hold leans on the steepest hillsides, I2 - 0.02 m without it); the cut
  under the centre line median 0.8 m, worst 2.2 m (the ground noise taken away);
  a fill's height median 0.3 m, worst 3.9 m (5.9 m before the hold, 12.8 m with
  the level shelf); the grade along the road median 2.8% either way, 95th
  percentile 10.7 -> 10.9% (LANDFORM1-3's; LANDFORM5-6's hills steepen it by
  climate - THE STEEPEST, ON THE REAL GROUND, above).
- THE PAINTED WATER, every river and stream pixel (3,048): every wet corner
  over the coast fade lies on its channel's flat floor - bends, junctions,
  joins and mouths alike - but the row a water tile shares with a road's own
  bed. Re-measured by height (AUDIT LANDFORMS II J1 - the check this line first
  stood on judged a corner by its distance from the centre line) at all 487
  river and stream pixels a road or a track crosses: 0 of the 7,742 corners on a
  track's bed off the floor, 0 elsewhere, and 3,303 of the 3,346 on a road's own
  bed half a metre or more over it, the worst 3.99 m (RESIDUES).
- THE RIVERS, 199 straight inland river pixels: the floor level across its
  painted width (median spread 0.00 m), 2.2 m under the lower bank top (median;
  95th percentile 2.7 m).
- THE TILES (AUDIT LANDFORMS D3), every location pixel with sea or beach in it
  (314), the whole pipeline with its painter: 0 tiles differ from DFU's (359 in
  97 did, before).
- THE COAST'S NATURE (AUDIT LANDFORMS II H2), every coastal location pixel
  (351): 0 tiles where nature's beach answer moves from DFU's (85 in 43 did).
- THE RE-STAND (AUDIT LANDFORMS B2, measured with the first audit's fixes), a
  record moved across a change of the row by the field, against the whole
  pipeline's two grounds: at the 701,841
  samples the cuts move in 300 lifted path pixels, median 0.00 m, 99th
  percentile 0.07 m, worst 1.6 m over and 2.0 m under (the lift alone: median
  0.5 m over, 99th percentile 3.1 m, worst 29.8 m over and 28.6 m under); at
  every sample of 997 location pixels a path crosses, within 0.9 m. A field
  costs a town 7 ms (one kernel pass) and a record in the wild its four
  samples.

## RESIDUES, NAMED

- NOT SEEN IN THE RUNNING GAME (LANDFORM4-6). AUDIT LANDFORMS III measured the
  laws on the real data - the freeware ARENA2 and the vendored network, in
  scratch, never in the repository: the knee, the seams, the walls round coastal
  towns, the river valleys, the centring, the borders, the towns' grades - but
  the tables in LANDFORM6 are still the synthetic field's, and the field shot's
  own town, the real lands' look and the real frame cost are Mac's eye before
  the merge - WATER2's lesson.
- A LEVEL TOWN ON A STEEP MOUNTAINSIDE (LANDFORM4, AUDIT LANDFORMS III C7): the
  rise a town's level takes out of its land is given back within its reach
  (124 samples, 794 m), so on the steepest ground the land round a big town is
  a few degrees steeper than the bare land - 4 of 60 real towns of 3x3 blocks or
  more by over a degree (Crossley 34 on 31, Singwick 24 on 22; Wadijirius and
  Akhera-Korom steeper than their bare land and far gentler than DFU's walls).
  A wider reach would need the 7x7 of pixels round a sample and would level
  more of the land; left for Mac's eye.
- A CLIMATE'S LAND STANDS ON ITS PIXELS (LANDFORM6): a desert pixel's dunes run
  as far as its pixel's climate says, blended a pixel either side - not as far
  as the tiles' ecotone blends a border (ECOTONE1's own law), so a dune can
  stand on a border tile its neighbour's climate paints.
- THE FAR RING TAKES NEITHER THE HILLS NOR A SITE'S PULL (LANDFORM4-6): it
  stands a pixel's byte at its centre with the lift (EV8's law, below), and the
  travel view past the built grid the same. The hills average to nothing over a
  pixel, and a pull is within a pixel of its site; at the ring's distance both
  are under its own gap to the streamed ground.
- A SITE IS ONE OF THE GAME'S OWN ROWS (LANDFORM4): a world-data mod's added
  location, a spawned dungeon and a World of Daggerfall camp pull nothing - they
  keep DFU's blend inside their pixel alone, the wall it stands the lift's. The
  rows are HUB1's so every client stands on one ground, each as MAPS.BSA holds
  it (AUDIT LANDFORMS III B1): a town pack that resizes a grid - Beautiful
  Villages 3,240 of them, Beautiful Cities 120 - pulls the land to the classic
  footprint, and DFU's blend levels the pack's own rect inside its pixel, so a
  village the pack enlarged stands a pull flat smaller than its town.
- A SITE'S RECT IS ITS BLOCK GRID (LANDFORM4), read off the map table; the
  stamped tiles' rect (setLocationTiles) lies inside it, so a site whose blocks
  stamp less than their grid is levelled a little past its tiles.
- THE NETWORK'S LANDING MOVES MORE GROUND (LANDFORM5): a river's valley reaches
  120 samples round its centre line and a stream's 96 (AUDIT LANDFORMS III R1:
  this said "a third of a pixel" of the stilling, which reached half a pixel
  whole and faded out by 120), so when Basic Roads' arrays land after a pixel's
  first build, the ground there moves by its valley as well as its channel -
  and beside a road or a track by its eased hills (LANDFORM7: within 40
  samples of a road's line, 28 of a track's). WHAT LIES ON THE GROUND RIDES THE NETWORK'S LANDING
  (G1/G2, above) carries it; the counts measured there are the cuts' alone.
- TWO BUILDS IN ONE ROOM (C2, below) now part by the hills and the pulls as
  well as the lift, until the older side reloads.

- Deep Waters' cap repaints a coastal pixel's above-sea water tiles as land
  (DW-B), so a river channel crossing a coastal pixel can show dry there - as
  the painted river already vanished there. The coast fade makes most of it
  nothing.
- World of Daggerfall's flatten lerps a whole pixel toward its site's mean by
  1/(d+1) after the kernel; a site is refused on a road or track pixel, never
  on a river's, so a channel beside a camp is filled a little toward it.
- `FALL_CARRY_MAX` (player/motor.js) still bounds a torn save's carried fall by
  DFU's tallest drop, 1,923.75 m; a fall from a raised summit is longer, and
  bills more HP than any character has either way.
- At the far ring classes (stride 2 and 4) a cut a few samples wide is
  sampled, not drawn - a painted road was already so.
- The far ring (EV8) stands a pixel's byte at the pixel's centre with no
  large-heightmap term, so the streamed ground stands a median 213 m over the
  ring's vertex with the row off and 212 m with it on (AUDIT LANDFORMS): the
  lift scales that gap and opens none. The extremes widen with the relief
  (726 -> 1,174 m), which is the ring's own law at taller heights.
- TWO BUILDS IN ONE ROOM (AUDIT LANDFORMS C2). Nothing keeps builds apart
  online: `worldRoom` carries no ground tag, the relay reads no client build,
  a deploy reloads no open tab (updateNotice.js), and the macOS and portable
  desktop copies never update themselves. A player on a build without the row
  and one with it share a room on two grounds - each draws the other at the
  sender's height (interiors ride the exterior frame), so in a town they part
  by the town's lift: at the location pixels median 0 m, 75th percentile
  10.9 m, 90th 184 m, 99th 492 m (97 of 410 cities over 10 m, Makilliweyn about
  390 m) - until the old tab reloads or the old copy updates. No earlier ground
  slice kept builds apart either (TERRAIN-SCALE1, WOD1, WD3, DW-A..D bumped
  nothing; a RELAY_VERSION bump restarts the relay and the old tabs reconnect
  into the same rooms). Real separation is a relay change - a ground law in
  the world hello, GATE_BRAIN_MIN's shape, or a tag in `worldRoom` - and
  Mac's call. The room's memory (WORLD1) holds dungeon and building places
  only, no exterior height.
- A RECORD BY A PATH, ACROSS A CHANGE OF THE ROW (THE SAVES, above): the mod's
  SmoothRoads smooths DFU's own road and not the landforms' level bed, so a
  record on a road from before the row lands within 1.6 m over or 2.0 m under
  it; World of Daggerfall's flatten is not followed either.
- OW-MOUNTAINS judges a travel route's open step on raw bytes
  (`systems/travelRoute.js` openStepBlocked: 16 bytes, 160 m between pixel
  centres, DFU's slopes); with the row on, 251 of the 839,697 steps it admits
  outside the Mountain climate rise more than 160 m on the lifted ground (the
  worst 390 m, (803, 212) -> (804, 212), about 25 degrees). It said "No
  failure traced - the slope limit is 70 degrees": there is no slope limit on
  the ground (the collider stands a body on the floor at any grade), and lane I
  traced failures on the lifted ground - I3 and the Menevia rim, both fixed
  since (AUDIT LANDFORMS II I5, I3, I1). Whether it should read `reliefByteHeight` with the
  row on is Mac's call (AUDIT LANDFORMS A2). Moot since 2026-10-08: the owner retired
  OW-MOUNTAINS in the Wrothgarian zone's merge (MOUNTAINS WALKABLE - openStepBlocked
  refuses no step, `11-Multiplayer/Wild-Zone.md` section 19).
- Come Sail Away's `Terrain.SampleHeight` (world/terrainSurface.js
  `unityHeightmapStep`) still caps the ground at DFU's 1,923.75 m, the one
  reader that keeps a ceiling at 1; 0.85% of land samples stand over it, where
  no boat goes (AUDIT LANDFORMS N1).
- A CAUSEWAY'S WALL. Inside a channel a road stands on its own bed alone and
  its bank gives way to the channel (E2), so the ground drops from the
  causeway's top to the channel's floor within a sample, which the heightfield
  draws as a steep bank: the biggest step between neighbouring samples at the
  487 pixels where a road or a track meets a river or a stream, median 2.1 m,
  90th percentile 3.7 m, the worst 14.2 m at (173, 91), where DFU's own ground
  steps 6.2 m; over 3 m at 117 of them (DFU's ground, 17). (AUDIT LANDFORMS II
  I4: this said "about 2.4 m over 6.4 m", the median alone.) And the one row of
  water a tile shares with the causeway's bed climbs to it: 3,303 wet corners
  half a metre or more over their floor, the worst 3.99 m (J1).
- A ROAD'S BENCH ON DFU'S OWN CLIFF (AUDIT LANDFORMS II I1). With the lift
  faded beside the sea, Menevia's rim is DFU's own cliff, and DFU's ground
  bills 223 of 10,056 runs straight down its fall line from 54 rim pixels.
  The landforms bill 250: at three pixels by the Silver Hedgehog Pub a road's
  level bench cut across the face catches a body running down it and launches
  it a little further over the same cliff (the worst 101 m beside DFU's 95).
  With no network those pixels are DFU's run for run; a wider fade changes
  none of them.
- THE RETRY'S WINDOW (AUDIT LANDFORMS II G3). Online, while C3's retry asks
  Basic Roads again (555 s of backoff over twelve tries, each file's fetch a
  failed ask after 30 s now), a client stands roadless beside peers on the
  network: a peer on a road drawn sunk a median 0.77 m (7.21 m at worst), one
  wading a river drawn under the ground a median 2.04 m - until the arrays land.
- THE READ SIDE (AUDIT LANDFORMS II H1). THE ONE CONSTRUCTION SEAM sweeps every
  world.js line that writes an exterior height out of the frame; the lines that
  put one back on (`restandHeight`) are the same shape and are not swept, and a
  host outside world.js hands world.js its heights (THE FOUR HOSTS).
- THE SNOW DECK (AUDIT LANDFORMS II I6). 0.83% of land samples stand over the
  snow cloud deck's top (`render/volumetricClouds.js`, 2,000 m), so a summit in
  snow shows a clear sky over it.
- NOT SEEN BY A PLAYER. The shapes were measured on the real WOODS.WLD and the
  real Basic Roads network (ON THE REAL WOODS.WLD, above) and looked at as
  renders of a stand-in heightmap made from the picture; AUDIT LANDFORMS II
  booted the running game headless on the real data (SwiftShader) and drove a
  save across the row both ways - every load on its ground - but no one has
  walked it on a real GPU. WATER2's lesson stands: Mac's eye in the real game
  before the merge.

## AUDIT LANDFORMS (2026-10-07)

Mac: *"Dont worry about it. Instead let's do just an audit and ensure this is
perfect"* - the record is `01-Overview/Audit-Landforms.md`. It changed these
laws of this page, each above where it lives:

- a road's low bank falls to the land (E1) and a channel is the water's (E2) -
  LANDFORM2;
- the landforms move the ground, never a tile: a location's tiles are DFU's
  own blend's (D3) - THE LAW;
- every height a record carries is in DFU's frame, no stamp (C1/B4); a pixel
  not built yet takes its location's own lift (B1); and the field follows the
  cuts (B2) - THE SAVES;
- online a failed fetch of Basic Roads' arrays is asked again before the port's
  own network stands in (C3, `Roads.md`), and the ground's online note names the
  rivers (C4);
- the version skew online is named (C2) - RESIDUES.

## AUDIT LANDFORMS II (2026-10-07)

Mac: *"Do another deep audit on this"* - the record is
`01-Overview/Audit-Landforms.md`, AUDIT LANDFORMS II. It changed these laws of
this page, each above where it lives:

- a track over water is a ford (J1), and a bank is never a launch ramp (I2) -
  LANDFORM2;
- nature asks the beach line of DFU's own blend, as the tiles do (H2) - THE
  LAW;
- the probe a pixel not built yet is asked of is bound before the boot's load
  (F1), the fields a save asks are kept (F3), and what lies on the ground rides
  the network's landing (G1/G2) - THE SAVES;
- a Travel Options journey follows its road (I3: `player/collider.js`'s floor
  arm reaches as far down as the slope limit allows over a substep's own run),
  and a Basic Roads fetch is a failed ask after 30 s (G3, `Roads.md`);
- the lift fades beside the sea (I1, Mac: *"Is it too steep?"*, then *"Go
  ahead"*) - LANDFORM1, THE CEILING with it;
- worldModes' legacy cache is named (J13) - THE FOUR HOSTS; the causeway's wall
  and its edge row (I4, J1), the retry's window (G3), the read side (H1), the
  snow deck (I6) and a road's bench on DFU's own cliff (I1) - RESIDUES; the
  real data re-measured with every fix in - ON THE REAL WOODS.WLD.

## Pins

`test/landform.test.js` - the knee (every sample of eleven coastal pixels, the
classifier's tiles equal, no step where a road or a river meets the beach, the
shaper at its worst; the floor half a unit over it, AUDIT LANDFORMS II J4), the
lift and the ring (the top byte 1.9 x its own term),
every seam and ghost row, the road graded level to the macro height along the
whole arm and the land untouched past its verge, the river's floor and its
levee, the causeway, rivers off and the room's switch online, the build's edge
normals, a point's lift against the real pipeline in a town, a record's height
DFU's frame both ways and no stamp anywhere, the switch, the host's wiring, the
worker byte for byte, and THE CEILING (a glitch byte in a lowland, a road graded
across it). `test/auditlandforms.test.js` - the audit's own (its record:
`01-Overview/Audit-Landforms.md`), THE LAW WRITTEN OUT among them: a second
statement of the shaper, equal to it at every sample of the fixture's bend,
junction, ends, crossing and shore; and AUDIT LANDFORMS II's - the ford and the
stream's crossings and join (the fixture's new track, stream and road), the
bank hold on a steep hillside, a journey at the road rate, what lies on the
ground riding the network's landing, the fetch's timeout, nature's beach and
its ground, THE ONE CONSTRUCTION SEAM, and the lift faded beside a sea cliff
(the rim as DFU stands it, the whole lift three pixels in, a road over it, the
ring, every seam across the fade). `tools/mutants/landform.json` - 36
mutants, all dead; `tools/mutants/auditlandforms.json` - 159, 153 dead and 6
recorded equivalent. The TERRAIN-SCALE1, PERF-EXT26 and EV4 pins that read the lines the
slice changed now read the new lines.
