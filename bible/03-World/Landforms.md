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

On a stand-in heightmap made from the picture (scratch only, nothing kept):
the land's median 459 m unchanged, the 90th percentile 1,180 -> 1,567 m, the
peaks 1,924 -> about 3,000 m; the steepest macro slope 11 -> 20 degrees.

THE FAR RING takes the same lift (`render/farRing.js` ringHeight's `relief`,
`reliefByteHeight`): it reads the same byte at a pixel's centre the streamed
kernel's `low` comes from, so the horizon stands the massifs the ground it
hands over to stands. The travel view past the built grid reads it too.

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
`bank` up to its TOP - the smooth land, or `drop` over the floor where the land
lies lower; then the land again, its ground noise with it, over the `verge`. So
a road on a hillside is cut into it with a bank up to the land, and on its low
side runs a level shoulder and an embankment down. Near a centre or a bend the
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
is a causeway. Each layer's reach is its flat, bank and verge (under ten
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

Rivers are cut only where they are PAINTED (the network's `water`,
RiversAndStreams - a channel with no water in it is a ditch), and NEVER
ONLINE: the river switch is each player's own there (`systems/onlineLane.js`,
"a river paints tiles and never moves a height"), so the host hands the job
`rivers: false` online and that sentence stays true. Roads and tracks are cut
online: the room already agrees on its network (Enabled and SmoothRoads are the
room's).

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
- Online, the room's memory (WORLD1) carries heights with no stamp, as it
  carried no terrain scale. The row is forced on for every player at once and
  a room forgets when it empties, so its heights change ground together, at
  the deploy.
- NOT SEEN IN THE GAME. The container this was built in carries no ARENA2;
  the shapes were checked on the picture as a stand-in heightmap and on the
  real Basic Roads network, never on the real WOODS.WLD. WATER2's lesson
  stands: Mac's eye in the real game before the merge.

## Pins

`test/landform.test.js` - the knee (every sample of eleven coastal pixels, the
classifier's tiles equal, no step where a road or a river meets the beach, the
shaper at its worst), the lift and the ring, every seam and ghost row, the road
graded level to the macro height and the land untouched past its verge, the
river's floor and its levee, the causeway, rivers off and online, the build's
edge normals, a point's lift against the real pipeline in a town, the re-stand
both ways, the stamps, the switch, the host's wiring, the worker byte for byte.
`tools/mutants/landform.json` - 35 mutants, 34 dead and 1 recorded equivalent
(the knee's early return: the coast fade is zero at the knee, so it is the law
said plainly and a fast path for the sea). The TERRAIN-SCALE1, PERF-EXT26 and
EV4 pins that read the lines the slice changed now read the new lines.
