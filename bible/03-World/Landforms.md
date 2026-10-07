# Landforms - the heightmap raised, the roads cut in, the rivers in the land

LANDFORM1-3, 2026-10-06. Mac, with a picture of the Iliac Bay's heightmap - the
bay black, the land grey, the Wrothgarian and Dragontail ranges white: *"Can we
adjust the heightmap to be more of this? and allow roads to carve through
terrian and caverns without breaking anything and rivers to actually have
depth, not just lying flat on land."*

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

THE CEILING (2026-10-07, found on the real WOODS.WLD). The shaper is handed
DFU's height as DFU stands it - clamped at MAX_TERRAIN_HEIGHT, 1539 - and the
lift is level past the heightmap's 7-bit top (`low` 8 x 127, the byte DFU's
ceiling is built on), so nothing stands over `LANDFORM_CEILING`, DFU's ceiling
plus the most the lift adds (2416 units, about 3,020 m). Real ground never
reaches either: its bytes stop at 110 and DFU's kernel never meets its own
ceiling on them. WOODS.WLD's one byte over 127 does - a 255 at map pixel
(470, 355), in the sea off Tigonus (the "High Rock sea coast" region), among
bytes of 2 to 15. DFU's kernel stands it as a 1.9 km pillar, flat at its
ceiling, over the four pixels that share that corner; unclamped and lifted it
was a 5.1 km needle. Now it stands at the landforms' ceiling as DFU stands it
at its own, and the re-stand's lift stays exactly what the landforms added
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
11 m on the real WOODS.WLD where 4 m now stand). Near a centre or a bend the
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

The layers lerp in paint order, the last winning (roadPainter.js: the first
painter to write a tile keeps it, and roads paint first): a road over a river
is a causeway. A CHANNEL IS THE WATER'S (AUDIT LANDFORMS E2): where a sample
lies in a river's or a stream's channel - its floor, and its bank by how far up
it - a road or a track stands there on its own bed alone, the causeway's top,
and its bank and verge give way to the channel. They refilled it: on the real
WOODS.WLD the painted water climbed up to 19 m out of its floor beside 629
crossings and riverside roads (55,096 wet corners lifted half a metre or more;
11,191 now, every one a corner a water tile shares with the road's own bed - the
one row of water against the causeway, which a heightfield cannot hold level).
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

## THE SAVES STAND AGAIN ON THE OTHER GROUND

TERRAIN-SCALE1's re-stand, given a second arm. Every record that carries a
`terrainScale` now carries `landforms: true` when it was written on the
landforms (the save, the dungeon's save through the mode machine, the exterior
scene cache, the ship's remembered deck, the recall anchor), and a record
without it was written on DFU's - which is every save from before the row.
`restandHeight(y, x, z, was, wasLand)` takes the landforms' lift at the record's
own spot off or on (`landformLiftAt`, world/landforms.js `landformLift`): the
lift field taken through the location's own blend (`blendLocationTerrain`
over the field - the blend is linear in the samples), so a town's levelled
ground is exact, and the wild is the lift at the point. Not followed: a cut's
few metres along a path, and World of Daggerfall's flatten; a body that ends
under its ground the collider lifts (the floor beneath everything). The
interior cache is in its building's frame and moves with the ground.

## THE FOUR HOSTS

- `scenes/world.js` - WIRED: the switch read once at the mount, the job's `landform`, the promotion's and the
  restride's ghost rows, the gate's beacon, the far ring and the travel view, the save's stamp, and the re-stand.
- `scenes/worldModes.js` - WIRED: hands the stamp to the dungeon it mounts (`landforms: host.landforms`); its own
  interior cache is in the building's frame and needs none.
- `scenes/dungeonContext.js` - WIRED: its save carries the world host's stamp (the camps left standing outside are
  exterior heights).
- `scenes/exterior.js` - NOT WIRED, by design: the fixed-city bench runs no terrain kernel at all (no tile pipeline,
  Roads.md's MODS AUDIT); it stands its one city on the location's flat ground, so its saves carry no stamp - DFU's
  ground, which is the ground it stands on.

## ON THE REAL WOODS.WLD (2026-10-07)

Measured on the freeware data (`tools/fetch-data.sh`) and the vendored Basic
Roads network, in scratch, with the slice's own functions:

- THE KNEE: 400 coastal pixels, 6,656,400 samples (1,632,017 at or under the
  knee) - 0 violations. THE SEAMS: 38,700 shared edge samples beside path
  pixels - 0 differ.
- THE RELIEF, one sample at each land pixel's centre (319,785 pixels): the
  median 484 m unchanged; the 75th percentile 786 -> 834 m, the 90th 1,109 ->
  1,353 m, the 99th 1,369 -> 1,867 m; the highest real ground 1,689 -> 2,673 m
  (the Dragontail summit, pixel (943, 470)); 45.8% of the land lifted by more
  than a metre. Over the whole Bay at two samples a pixel, only the glitch's
  four samples moved with THE CEILING.
- THE ROADS, 300 straight road and track pixels (AUDIT LANDFORMS re-measured
  them, E1 in): the bed's tilt across its painted tiles median 0.54 -> 0.00 m,
  95th percentile 1.90 -> 0.00 m, worst 8.0 -> 0.00 m; the cut under the centre
  line median 0.8 m, worst 2.0 m (the ground noise taken away); a fill's height
  median 0.3 m, worst 5.9 m (it was 0.6 and 12.8 m with the level shelf); the
  grade along the road median 2.8% either way, 95th percentile 10.7 -> 10.9%.
- THE PAINTED WATER, every river and stream pixel (3,048): every wet corner
  over the coast fade lies on its channel's flat floor - bends, junctions,
  joins and mouths alike.
- THE RIVERS, 199 straight inland river pixels: the floor level across its
  painted width (median spread 0.00 m), 2.2 m under the lower bank top (median;
  95th percentile 2.7 m).

## RESIDUES, NAMED

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
- Online, the room's memory (WORLD1) carries heights with no stamp, as it
  carried no terrain scale. The row and the river switch are forced on for
  every player at once and a room forgets when it empties, so its heights
  change ground together, at the deploy.
- NOT SEEN IN THE GAME. The container this was built in carries no ARENA2;
  the shapes were checked on the picture as a stand-in heightmap and on the
  real Basic Roads network, never on the real WOODS.WLD. WATER2's lesson
  stands: Mac's eye in the real game before the merge.

## AUDIT LANDFORMS (2026-10-07)

Mac: *"Dont worry about it. Instead let's do just an audit and ensure this is
perfect"* - the record is `01-Overview/Audit-Landforms.md`. It changed two laws
of this page: a road's low bank falls to the land (E1), and a channel is the
water's (E2) - both above, in LANDFORM2.

## Pins

`test/landform.test.js` - the knee (every sample of eleven coastal pixels, the
classifier's tiles equal, no step where a road or a river meets the beach, the
shaper at its worst), the lift and the ring, every seam and ghost row, the road
graded level to the macro height and the land untouched past its verge, the
river's floor and its levee, the causeway, rivers off and the room's switch
online, the build's edge normals, a point's lift against the real pipeline in a town, the re-stand
both ways, the stamps, the switch, the host's wiring, the worker byte for byte,
and THE CEILING (a glitch byte in a lowland, a road graded across it).
`tools/mutants/landform.json` - 40 mutants, 39 dead and 1 recorded equivalent
(the knee's early return: the coast fade is zero at the knee, so it is the law
said plainly and a fast path for the sea). The TERRAIN-SCALE1, PERF-EXT26 and
EV4 pins that read the lines the slice changed now read the new lines.
