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
plus the most the lift adds (2416 units, about 3,020 m). Real ground never
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
again. The fields a save asks are kept, the last 32 (F3).

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
  frame, and the re-stand.
- `scenes/worldModes.js` - its own heights NOT WIRED, by design (AUDIT LANDFORMS C1): the heights the world host hands
  it are DFU's frame already, and its interior cache is in the building's frame. A legacy cache (raw scene positions,
  written before TERRAIN-SCALE1 carried the frame) is stood again through the world host's `restandSceneHeight` - the
  re-stand, the lift with it (AUDIT LANDFORMS II J13: this line said NOT WIRED alone).
- `scenes/dungeonContext.js` - NOT WIRED, by design: the camps left standing outside reach its save through the world
  host's `outerCampsSave`, in DFU's frame.
- `scenes/exterior.js` - NOT WIRED, by design: the fixed-city bench runs no terrain kernel at all (no tile pipeline,
  Roads.md's MODS AUDIT); it stands its one city on the location's flat ground - DFU's ground, which is the frame
  every record is written in.

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
  percentile 10.7 -> 10.9%.
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
  row on is Mac's call (AUDIT LANDFORMS A2).
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
