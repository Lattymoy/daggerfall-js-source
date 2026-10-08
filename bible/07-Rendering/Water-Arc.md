# Enhanced water (WATER1, 2026-09-08)

**Mac (2026-09-08): "I now want to develop proper water shader for the
oceans/rivers/ponds of daggerfall."** Ledger section A, row WATER1.

## What Daggerfall draws

Water is record 0 of the terrain tileset. Every producer of the
128x128 tilemap writes it the same way: the ocean by height
(`world/terrainTiles.js` `generateTileData`, the sampler having clamped
the sea flat at `SCALED_OCEAN_ELEVATION`), the shoreline by marching
squares (`assignTiles` and `createLookupTable`, DFU's `AssignTilesJob`),
rivers and streams by the road painter (`world/roadPainter.js`, the
same records with the same rotate and flip bits), and a town's ponds
and moats by the RMB's own ground tiles (a zero tile stored as the
`0xFF` sentinel and converted back). And the terrain pass draws it
exactly as it draws dirt: one opaque layer of the tile array,
Lambert-lit, unmoving (`render/renderer.js` `TERRAIN_FS`, the verbatim
`Daggerfall/TilemapTextureArray` decode). DFU draws it flat; classic
palette-cycled the tile. The only water shader in the engine was the
dungeon's plane (`drawWater`: a scrolled classic texel, a tint, a blend).

The map before the design (the explorer's, 2026-09-08): no depth
texture anywhere; the sky never rendered to a texture; shaders inline
in one file, shared blocks by interpolation; the sea a constant 40.8
world units where rivers and ponds sit at terrain height; no exterior
water surface height in the game model (`player/exteriorSurface.js`:
DFU has no submersion outdoors); VC4's cloud shadow reaching neither
the grass nor the water; two exterior hosts to wire.

## The departure

**Superseded by WATER-NEXT 2-4 (below; AUDIT WATER-NEXT M4).** What this
section and "What it does not do" describe is WATER1 as it shipped: the
water is now its own sheet over a carved bed, the terrain pass paints the
bed, and the surface refracts, foams and ripples. The record below is
WATER1's.

`render/waterSurface.js` and `drawWaterSurface` in `render/renderer.js`.
Enhanced skin only, switch `enhancedWater` (on by default, its row in
the enhanced pane), `?water=off` the kill door. The classic lane and
the terrain pass were untouched.

**The geometry is the terrain's.** There is no water mesh. The pass
draws the pixel's own terrain surface again - the same positions and
normals, through an index set of its own (`buildWaterIndices`: the
quads whose tiles carry any water corner, the far ring's strided twin
included, its skirt never - the audit's M4 and L5: the first cut drew
the whole 32,768-triangle grid for one stream tile and the skirt as a
forty-unit curtain of water at a coast) - lifted `WATER_LIFT`
(0.08) above the ground, alpha-blended, depth-tested and never
depth-written, both faces. The fragment shader discards every texel
that is not water. So the ocean is flat because the terrain under it
is flat, a river follows its slope because its tiles do, a town pond
sits at the town's ground, and nothing here tells the game where a
water surface is.

**Which texel is water.** A 256-entry table of WATER CORNERS, indexed
by the converted tile byte the terrain pass decodes (record << 2 |
transform), packed eight nibbles to a uint into `uvec4 uWaterMask[8]`.
Record 0 is all four corners under every transform (the painter writes
rotated water: 64, 128, 192). The shore records are the marching
squares' transitions, and the table INVERTS `createLookupTable`: a
shape's bits name the corners that are dirt, the table maps that shape
to a record plus its rotate and flip bits, so the byte a shape wrote
gets the shape's water corners back - in the tilemap's own frame, which
is the frame the bilinear coverage samples in. The river painter writes
the same records with the same bits, and its water-grass (20-22, 49)
and water-stone (30-32, 50) columns are the water-dirt shapes' twins, so
they take the same corners. A record the producers never write as a
shape (8, 23, 33-36: town docks, moats and puddles) has no known
geometry, and is one of DFU's own shallow-water tiles
(`PlayerMotor.OnShallowWaterTile`, :551-563: "the water design takes
up the majority of the texture"), so the surface covers it whole (MAC2,
2026-09-11 - before that the classic tile stood there and a town
puddle did not read as water); record 9 is not in DFU's list and keeps
the classic tile. The coverage inside a tile is the bilinear blend of its four
corners - the diagonal the shore tile's own art follows - feathered by
`SHORE_SOFTNESS` and discarded past the feather. MAC2 (2026-09-11)
lifted the table into `world/waterCorners.js`, a leaf the render pass
and the player's feet share: the exterior surface model reads the same
corners at the feet's fraction, and where the coverage is at or past
the shader's 0.5 diagonal the player SWIMS - Mac's departure over
DFU's record law, in which a stream, a bank, a shore or a moat is waded
(Ledger A: THE PLAYER SWIMS WHERE THE SURFACE IS DRAWN). The picture and
the physics come from one table now, so they cannot disagree.

**The shading**, in the engine's own palette space (no sRGB anywhere):

- The normal is the gradient of three wave trains - one down the
  eased wind, two crossing it by ROTATION (the audit's H3: the first cut
  added a fixed unit vector to the wind, which was collinear at one
  heading and the zero vector, a NaN sea, at its opposite) - with
  amplitudes on the wind's strength
  off a calm floor (the row's own scale, `systems/wind.js`: the same
  vector the cloud deck is drawn with and the mills turn on; null is
  calm), and under rain two fine trains that pock the surface with the
  front's intensity. Every train fades with the distance from the eye
  on its own wavelength's scale, so the far sea keeps the swell and
  nothing aliases into moire.
- The body of the water is the classic water texel (layer 0, scrolled
  at the dungeon water's rate), tinted deep, and lit by `TERRAIN_FS`'s
  own law term for term - ambient, the sun scaled and shadowed by the
  cloud deck (`_csLoc.water`: VC4's recorded gap, closed), the moon, the
  sixteen point lights and the player's indirect light (the audit's M2:
  the first cut had the first three and called it term for term) - so
  it sits in the frame the land beside it is lit in, with no seam at the
  shore under a torch.
- Schlick's Fresnel (F0 0.02), capped at 0.72 because a sea is never a
  flat mirror, mixes that toward the reflected sky: the dome's own
  zenith and horizon this frame (`sky.waterSky()` on the shared sky
  object - the enhanced state's two colours; under the mod a zenith
  derived from its one colour, darker and bluer; null under the classic
  sky, which draws no surface), leaning
  toward the zenith the way a rough sea integrates.
- The sun's and the moon's Blinn-Phong glints, the sun's under the
  cloud shadow.
- The alpha is the opacity (0.94; 0.82 until MAC2 asked for darker,
  less see-through water, when the tint went from 0.62/0.78/0.86 to
  0.36/0.50/0.60 with it) raised toward grazing by the same
  Fresnel, times the shore feather. The fog every world pass takes.

**The draw state.** `drawWater`'s (blend, no depth write, no cull)
plus a polygon offset of the constant term only (0, -2 - the audit's
M3: a slope factor scales with the surface's own depth slope, hundreds
of units per pixel at a grazing view, enough to pull the water over a
far shore) and `LEQUAL`: a world-space lift is
worth less depth the farther it is - at 800 units a 24-bit buffer
resolves about the lift itself - and the surface is the ground's own
triangles, so its depth is never farther than the ground's at the same
pixel and an equal depth is the surface, not the tile. Every bit of
state is put back after the draw.

**The slot.** In both exterior hosts, after every opaque pass of the
pixel (the ground, the models, the mills, the arrows) and before the
first flat - so the surface blends over the land it lies on and every
sprite, missile, drop and the arms draw over it. One uniform set a
frame from `waterUniforms`: the clock, the eased wind, the rain
(`fx.intensity` when the front is rain or a storm), the dome's colours.
A pixel whose tilemap carries no water never enters the pass (its
index set is null, decided at the build and again at a restride); a
town without a water tile inside its real extent never does.

## Found on the way: no corner anywhere was water

The water lab's first render put the sea at sand. Through the port's
own pipeline, a heightmap clamped to the ocean elevation gave
`generateTileData` ZERO water corners in 16641 - and since every
sampler output is at least the clamped float and rounding is monotone,
the one value the Float32Array can hold at the clamp is the one whose
double product overshoots: under the old compare no corner in any
pixel, land or sea, could ever be water. Not the ocean alone - lakes,
coastal shallows and the whole water-land transition set (the records
the shore table inverts) were unreachable in every pixel. The only
exterior water a shipped build ever drew was a town's own record-0
tiles through the `0xFF` sentinel, and the river painter's, which is
off by default (`RiversAndStreams`). The sampler stores
`scaledHeight / MaxTerrainHeight` in a Float32Array and the job
multiplies it back: in C# every step is a float and
`27.2f / 1539f * 1539f` rounds back to `27.2f`, so `<=` holds; in JS the
product is a double - `fround(27.2 / 1539) * 1539 = 27.20000077` -
and against the double 27.2 the compare failed for every clamped sea
sample. Every sea corner fell through to the beach band, and every
ocean tile this port ever drew was dirt. The height is rounded to
float32 and compared against float32 thresholds now, which is the
arithmetic the reference does (`world/terrainTiles.js`; pinned ungated
in `test/terrain.test.js`). The audit's lane B then took the rest of
the class: the beach jitter is float32 per operation as
`Unity.Mathematics.Random.NextFloat(min, max)` is (the double form
differed from the reference in 17% of draws by an ulp and moved the
tile threshold itself for 1% of corners), the nature scatter's twin
compare is float32, and `SCALED_OCEAN_ELEVATION` is the float
`3.4f * 8` is in C# - one value of the ocean elevation in the port.
LW-DRY (2026-10-05) gave the job's height and its water compare one
home (`terrainTiles.js` `sampleHeight`, `isWaterHeight`), which the
living world's dry ground reads as well (`world/dryGround.js`: a road
party's camp, halt and fallen stand where no water shows); PIN MOVED:
`terrain`. AUDIT LW-DRY (the same day): the nature scatter's three
beach reads (`terrainNature.js`) still wrote the product out
themselves - they read `sampleHeight` now, and `terrain` pins it.

Two consequences to know. A location on a pixel where every sample
clamps has its whole rect flattened to the clamp and stamped only
within its bounds, so its clearance ring is now record 0 - the player
there swims, splashes and takes no fall damage, which is DFU's own
behaviour through the same job, unobserved until Mac's ARENA2 sees it.
And the port carries three definitions of "water" that now show at the
boundary: the travel map's byte rule (`overworldModel.js`, byte <= 3),
the road router's beach-line byte (`roadsProducer.js WATER_BYTE`), and
the per-corner rule here; each is documented as its own law.

## The lab and the probe

`water.html` -> `src/tools/waterLab.js`: a synthetic pixel (an island
in the sea, a lake below sea level, a river marched through the
marching squares on a corner-grid path) drawn with the game's own
terrain and water programs under the enhanced dome, tiled three by
three so the sea reaches the horizon, with the hour, the weather, the
wind, the rain, the view and the eye's height on sliders; `?still`,
`?t=`, `?water=off`, `?nosky`, `?z=` for the probe and the eye. Two
lessons the lab taught: a dynamic component index on a `uvec4`
answered zero on ANGLE/SwiftShader (the lookup selects by compare
now), and the lab drew nothing until its projection was mirrored the
way every host's is - the renderer's front face is clockwise under
`mirrorProjectionX` (mat4's handedness law), and unmirrored every
ground face was culled; what the first shots called the sea and the
island were the dome's ground colour and the island's back faces.

`tools/waterProbe.mjs` (port 5239, `/tmp/water-*.png`): ten claims,
each a shot against a shot - the pass changes the water and leaves the
sky alone; the surface moves; a gale varies more than a calm; a rainy
sea differs from a dry one; the sun glints toward the sun and not
away from it; midnight is dark and still water; an overcast sea is
less blue than a sunny one; no page or GL errors; and the shore - a
band holding both sand and sea, wetted in part and not whole, more
than the bare tiles wet it (the audit's M5: the first nine read open
sea only, where the table answers whole). 10/10. Three more shots for
the eye: the shore up close, the river and the lake, the rain up close.

## What it does not do

(WATER1's, as it shipped - AUDIT WATER-NEXT M4: WATER-NEXT 2-4 below draws refraction, foam and wakes.) No point-light GLINTS on the water (a dock's lantern lights the surface
as it lights the bank, and is not mirrored in it), no
refraction, no foam, no underwater view (DFU has no exterior
submersion), no wake. (Depth-tinted shallows: WATER2 below, off the
bed's own depth rather than a depth texture.) The dungeon keeps its
own plane. Not seen on a real GPU or with ARENA2 - Mac's eye is the
next gate; the amplitudes, the tint and the cap are the lab's sliders'
to tune.

## The audit (WATER-AUDIT, 2026-09-08)

**Mac: "do an audit on this."** Two adversarial lanes, read-only, each
finding grounded in a line; every finding verified against the code
before it was taken.

**Lane A - the pass.** Taken: H3 (the crossing wave trains were a fixed
unit vector added to the wind - collinear at heading -53 degrees, the
zero vector and a NaN sea at +127; rotations now); M1 (the Fresnel dot
clamped before `pow`); M2 (the point lights and the indirect light on
the water); M3 (the polygon offset's slope factor dropped); M4 and L5
(the water's own index set - a wet-quad subset of the terrain layout,
no skirt: a stream pixel pays a few hundred triangles, not 32,768, and
the far ring's coast has no curtain); M5 (the probe's tenth check, the
shore band); L1 (the fixed city asks over its real extent - its padding
is zero, and zero is water); L2 (`uTileDim`); L3 (a zenith derived from
the mod's one colour); L4 (the painter's water records pinned inside
the table's families); H1 and H2 (the corner table was pinned against
the lookup it was built from - a tautology; it is pinned through the
producer now: a random water-dirt corner field through `assignTiles`
and `convertTilemap`, every cell's corners asked back in the tilemap's
frame, the frame itself pinned on the grid and the upload, and an
inverted table shown to fail). Refuted by the reviewer and left: the
depth-func restore, the cull and blend restores, the deck's stamp per
frame, the cloud shadow under the floating origin, `uCamPos`'s frame,
the per-tile scroll's continuity, `_visible` and the pixel matrix, the
scope of `fx`/`precipMode`/`now`, the pack's indexing, the program's
lifetime, the river painter's orientation bits (traced: the same law as
the marching squares), the town's zero tile (genuine RMB water, drawn
by DFU too). Noted and left: L6 (a saddle's centre is half-alpha - the
art's two water triangles meet there) and L7 (a texture-bind count).

**Lane B - the ocean fix.** The claim true and the arithmetic right;
the residues taken above (the jitter, the nature compare, the one
constant). Refuted: the Daggerfall-city histogram pins (the pixel's
lowest sample is nine times the clamp), the grass (never on the sea,
three ways), rivers and the map's byte rule at the boundary, the far
ring's tiles (the stride never reaches the tile job), and the second
half of the terrain pin (a guard against an over-broad fix, not a
mutation killer - said so now).

## WATER2 - THE BASIN (2026-09-11)

**REVERTED (2026-09-12, Mac: "Lets honestly revert to our original implementation before the depth") - see THE REVERT below. Kept here as the record of what was tried.**

**Mac: "Ponds, rivers, oceans, and any source of water should receive
actually detailed water details like waves, shorelines, ponds not
sitting like a texture and having depth in the ground (same for
rivers)."** WATER1 drew the water as the ground's own triangles lifted
a hand's breadth: a pond was a film on a field, a river a blue road,
the shore the tile art's diagonal. Water lies IN the ground.

**The bed.** `render/waterBasin.js`. A grid vertex is in water when
every tile that meets its corner says that corner is water (WATER1's
corner table; a corner one tile calls dirt is the shore). A
breadth-first walk from every dry vertex gives each wet one its ring
distance to the bank, capped at `BASIN_RAMP` (4 vertices, 25.6 units),
and `basinProfile` eases it into a bowl - a quarter circle, steep off
the bank and flat in the middle - times `BASIN_DEPTH` (5 units, a
tile being 6.4). A one-tile stream is a trough 1.9 deep at its banks,
a lake a bowl, the sea a beach that falls away over four vertices.
`carveBasin` lowers the ground pass's vertices by that depth in place,
recomputes the normals of every vertex the carve reaches with
`buildTerrainGrid`'s own kernel (the bank is lit as the slope it now
is), and re-hangs the far ring's skirt from the carved edge. The
random-field round trip in `test/water2.test.js` (DELETED) proves the wet set
IS the corner field, every vertex.

**The surface** is no longer the ground's triangles: `waterMesh` takes
the grid's positions AS THEY STOOD before the carve, so the surface
stays where the ground was, and under each vertex the bed's depth in
units, which is attribute 1 of a water surface that now owns its
buffers (`createWaterSurface(positions, depths, indices)`). The hosts
build the water first and upload the carved ground after - the build
and the restride in world.js, the lab - and the town's flat sheet sits
at `TOWN_WATER_DEPTH` (2.5: a moat or a dock has no grid to carve).

**The shoreline is where the bed rises to meet the surface.** The
fragment reads the interpolated depth - exact, because the carve is
linear over the same triangle - and fades the surface to nothing over
the last `SHORE_DEPTH` (0.35) of it; the art's diagonal only bounds
it. The body tends to `DEEP_COLOR` by Beer-Lambert in the depth
(`WATER_ABSORB` 0.45: nine tenths lost at full depth), mixed in BEFORE
the light so a deep pool at midnight is black and not blue, and its
opacity climbs from `SHALLOW_OPACITY` (0.30, the bed's texel seen
through a clear film) to `WATER_OPACITY` where it is deep. The lift,
the polygon offset and LEQUAL stay for the hand's breadth where the
bed comes up to the surface.

**What the game never sees.** world.js's `heightAt` reads the pixel's
SAMPLES, and the carve touches only the uploaded positions: the player
swims on a water tile at the height DFU swims at, foes and flats stand
where they stood. The one thing that can look wrong is a nature flat
DFU places on a shore tile's dirt half at a vertex the carve reached
(a tree a few hand's breadths above a bank) - left for the eye.
A pixel seam under water can show a bed step of up to half the depth
where the nearest bank is across the seam, under at least one ring of
water; the surface above hides most of it.

**Pinned** in `test/water2.test.js` (DELETED) (5); WATER1's pins in
`test/water.test.js` moved to the basin's shapes. Not seen on a GPU
or with ARENA2 - the lab (`water.html`) carves the same basin, and
`npm run perf` measures what it costs (nothing per frame: the walk and
the carve are at the build).

## WATER3 - THE SWELL AND THE FOAM (2026-09-11)

**REVERTED (2026-09-12, Mac: "Lets honestly revert to our original implementation before the depth") - see THE REVERT below. Kept here as the record of what was tried.**

**Mac: "waves, shorelines".** WATER1's waves were a normal map: the
gradient of three trains, lit as slopes on a flat sheet. The sheet
moves now. The vertex shader rides `swellHeight`, which is the
INTEGRAL of the fragment's `waveGradient` train for train - a gradient
term `A cos(k x + w t)` is a height `A / k sin(k x + w t)`, the same
crossing rotations, the same distance fade on the same scale - so the
surface the eye sees heave and the slopes it is lit by are one field
(`test/water3.test.js` (DELETED) reads both shaders and holds the six numbers of
each train equal). The rain's fine trains are not ridden: pocks are a
texture on the water, not a sea. Over a bed shallower than
`SWELL_DEPTH` (1 unit) the ride scales down to nothing, so the sheet
never lifts off the shoreline WATER2 fades it at. On the long train at
a gale the swell is 0.2 units; at a calm 0.07.

**The foam** has two sources and one lace. The SHORE: where the bed
rises through the last `FOAM_DEPTH` (1.2, widened to twice that on a
gale) of water the surface breaks on it - a band along every bank that
breathes with a slow sine and is cut by a value noise drawn along the
wind, so it moves as the water does. The CRESTS: where the field's
slope is steep enough to break (the gradient's length past 0.16),
which only a strong wind reaches, gated by the wind's strength so a
calm pond has none. Foam is lit white by the ground's own ambient,
sun and moon, fades with distance before it aliases, and is not glass:
the alpha rises to it. No texture and no table - the lace is a hash.

**Pinned** in `test/water3.test.js` (DELETED) (4). Not seen on a GPU; the lab
carries it.

## WATER4 - THE ART'S OWN WATER (2026-09-11)

**REVERTED (2026-09-12, Mac: "Lets honestly revert to our original implementation before the depth") - see THE REVERT below. Kept here as the record of what was tried.**

**Mac: "I noticed with the water, its still not taking into account
all the water textures that are on land, and its not traced well, just
square. Water is also still way too see through."** Three faults, one
cause. WATER1 decided what is water by CORNER: a 256-entry table
(`world/waterCorners.js`) names which corners of a record stand in
water and the shader blends the four. So every shore was a straight
diagonal or a straight edge (the square tracing), and a record whose
water reaches no corner - the puddle in the middle of a dirt tile, the
pond's inner bank the painters never write as a shape - drew no water
at all (the water textures on land). The glass was a number: WATER2
set the shallows at 0.30.

**The art decides.** `world/waterArt.js`. Every terrain record is a
64x64 indexed bitmap, and record 0 - the water tile - is painted in
nothing but water, so its palette indices ARE the archive's water.
`buildWaterArt` reads the archive's bitmaps once (both hosts do it
beside the tile array, and the renderer keeps it there:
`uploadWaterArt`, `waterArtOf`) and mints, per record, a 16x16 grid of
box-averaged "is water" (`ART_GRID`: four texels a cell, so a dithered
shore is a fraction and not a checker), uploaded as one R8 texture 16
wide and 16 x records tall, LINEAR. The shader (`uWaterArt`,
`uWaterArtOn`) reads the tile byte for the record and its turn exactly
as TERRAIN_FS does - the same `ROT`/`TRANS`, character for character,
gated in `test/water4.test.js` (DELETED) - and samples the record's cells
bilinearly, a half-cell in from its edges so no neighbour record
bleeds, then feathers the shore on `ART_SHORE` (0.2 to 0.6: low, so
half-water reads as water and not as lace). The shore is the record's
own outline now, traced between cells at 0.4 units. Without an
archive's art (the tests, `?noart` in the lab) the corner table draws
as before: the fallback arm, not a retirement.

**Two more tables off the same art**, by converted byte: `any` (does
the record draw water at all - a quad enters the pass on it, a town
enters the pass on it: `buildWaterIndices`, `tilemapRectHasWater`) and
`corners` (WATER1's four bits read off the art through the turn, wet
at `ART_WET`, the ramp's midpoint - the basin carves by them,
`basinDepths`, exactly as it carved by the hand-made table). A puddle
no corner reaches has a quad and no basin: its sheet lies flat on the
ground (`flatDepths`, where WATER2 answered null and drew nothing),
and the shader gives it a bed of its own - `depth = max(vDepth,
SHORE_DEPTH * edge)` - so the shoreline ramp keeps it, the
Beer-Lambert loss reads it, and the foam, which still reads the carved
bed, breaks no surf on it.

**The feet.** MAC2's law stands - the player swims where the surface
is drawn - and the surface is the art's, so `feetWaterCoverage` takes
the archive's art from the hosts' ground sample and answers the art's
coverage under the feet THROUGH the shader's own ramp (`artShore`): it
crosses 0.5 where the eye sees the water begin. The player swims in
the puddle the art paints; on its dirt DFU's record law answers as
before.

**The glass.** `SHALLOW_OPACITY` 0.30 to 0.80. The bed shows through
the shallows; it does not show them up.

**Pinned** in `test/water4.test.js` (DELETED) (6): the leaf executes on
synthetic bitmaps (the palette off record 0, the grid, the four turns
as GLSL's column-major mat2 applies them, the bilinear, the clamp, the
tables, the ramp, the feet through `exteriorSurfaces`), with mutants
(the turns swapped, the set inverted); the shader, the renderer, both
hosts and the lab are text-pinned. The lab paints its own art off the
corner table (the archive's bitmaps are not in it), so the probe's ten
checks run through the art path: 10/10 on this change. Not seen on a
real GPU with a real archive - Mac's eye is the gate.

## WATER5 - PER TEXEL, AND THE DISTANCE TO THE SHORE (2026-09-11)

**REVERTED (2026-09-12, Mac: "Lets honestly revert to our original implementation before the depth") - see THE REVERT below. Kept here as the record of what was tried.**

**Mac, of WATER4's trace: "It's still not a perfect trace. What can we
do to make sure this is perfect."** WATER4 could not be perfect by
construction: it averaged the art into 4x4-texel cells and blended
between them, so anything finer than 0.4 units smeared, corners
rounded, and the shore landed where 40% of a cell was water rather
than on the art's edge. Two other shorelines still competed with the
art: WATER2's depth ramp faded the water near dry vertices, and
WATER3's foam followed the basin's corner geometry. The classic art is
pixels; a perfect trace is per pixel.

**Per texel.** `world/waterArt.js` now mints a 64x64 mask per record
- a texel is water or it is not - and from it a SIGNED DISTANCE FIELD:
every texel's Euclidean distance to the shore in texels (Felzenszwalb's
transform, exact), positive in the water, negative on the dry, ±0.5 on
the two texels either side of the shore so the field crosses zero ON
the texel boundary, clamped at `SDF_RANGE` (8 texels), ±8 throughout
for a record with no shore. Encoded to a byte about 128. The renderer
uploads it as a `TEXTURE_2D_ARRAY` of the tile array's own shape (64 x
64 x records, R8, LINEAR, CLAMP), and the shader reads it at the very
uv TERRAIN_FS draws the record's texel by - the same `ROT`/`TRANS`, the
same clamp the tiles have - so the water's decision and the ground's
texel come from one address. The edge is the field's zero crossing,
feathered over one screen pixel of the field (`fwidth`): on the art's
outline at any distance, no shimmer, and a diagonal of pixel stairs
reads as one smooth line. No ramp of its own and no bed ramp in the
art arm: the art is the shoreline's one authority. The foam band is
`FOAM_TEXELS` (6, widened on a wind) of the same distance, so the surf
sits on the outline; the corner arm keeps WATER2's ramp and WATER3's
band, untouched. A puddle's bed is the shoreline's depth as before.

**The palette, widened by colour.** A texel is water if its index is
one of record 0's, or - with the palette to read - if its colour sits
within `WATER_COLOUR_TOLERANCE` (24, Euclidean RGB) of one of record
0's colours, so a shore record's lighter or darker blue counts and a
brown does not. Not seen on a real archive from here, so:

**The mask view.** `?water=mask` in either host and in the lab paints
the mask magenta over the ground - the water exactly where the art is
read as water, nothing else. That is the gate for "perfect": the eye
on the overlay, texel by texel; `WATER_COLOUR_TOLERANCE` is the dial if
a blue is missed or a brown caught.

**The feet** read the same field, texel-exact (NEAREST, as the ground
samples its own texel): at or past the shore the texel is water and the
player swims - a puddle, a one-texel stream.

**Pinned** in `test/water4.test.js` (DELETED) (4, rewritten for the per-texel
leaf: a one-texel stream survives whole, the reads step from texel to
texel with no blend, the tables, the feet) and `test/water5.test.js` (DELETED)
(5: the field's numbers with mutants - the sign flipped, the byte's
centre moved - the palette widening, the shader arm with no ramp of
its own, the renderer's array upload and its unit-3 fallback, the
hosts' and the lab's mask view, the probe's check). The probe gains a
shot in the mask view: the whole sea magenta, part of the shore band,
none of the sky.

## THE REVERT (2026-09-12)

**Mac: "Lets honestly revert to our original implementation before
the depth."** Four slices in one day - the basin (WATER2), the swell
and the foam (WATER3), the art's own water (WATER4) and its per-texel
field (WATER5) - and the water did not read better for them. The
surface is WATER1's again, as the audit left it: the pixel's own
terrain grid drawn a second time, lifted, every non-water texel
discarded, the shore the corner table's diagonal feathered by
`SHORE_SOFTNESS`, the waves a normal map on the eased wind, the sky by
Fresnel, the sun's and the moon's glints, the deck's shadow, rain.

**What stays**, because Mac asked for each of them on their own:
MAC2's look - `WATER_OPACITY` 0.94 and the darker `WATER_TINT` on the
one-opacity surface ("darker and not as see through"); MAC2's puddle
records in the corner table (`SHALLOW_WHOLE`: the docks, moats and
puddles drawn whole - "some puddle areas don't register as water");
and MAC2's law that the player swims where the surface is drawn
(`player/exteriorSurface.js` reads the same corner table; Ledger A
row). The corner table's one home is still `world/waterCorners.js`.

**What went.** `render/waterBasin.js` and `world/waterArt.js` are
deleted; the water surface rides the terrain's own buffers again
(`createWaterSurface(terrain, indices)`), the town draws its ground
quad again; the shader has no depth attribute, no swell, no foam, no
art sampler and no mask view; the swim law takes no art. The lab and
the probe are WATER1's (10 checks). `test/water2..5.test.js` (DELETED) are
deleted with their subjects; `test/water.test.js` is WATER1's suite
with MAC2's pins. The Ledger rows THE BASIN and THE WATER IS THE
ART'S are struck.

**The lesson**, for the next arc that wants "more": the eye was never
in the loop. Every one of the four slices was seen only in the lab,
on synthetic art, and each was judged after it merged. A look change
wants a shot from the real game before it lands, not a probe number.

## WATER-NPC - THE TOWNSFOLK WALK AROUND IT (2026-09-15)

**Mac, from live play: "NPCs arent water aware and will walk into
it."** They were not, and the reason is that the port is *correct*.

`world/cityNavigation.js` is DFU's `CityNavigation.cs` character for
character, and its `GetTileWeight` gives weight 0 - never walk - to
seven ground records, read straight off DFU's `TileTypes` enum:

    Water, WaterDirtEdge1/2, WaterGrassEdge1/2, WaterStoneEdge1/2
    = 0, 5, 6, 20, 21, 30, 31

The enum knows **two** edges per shore family. Each family actually
has **four** members - the edge and the corner are in the enum, the
three-corner and the saddle are not - and the shallow-whole records
(the docks, moats and puddles MAC2 put in the corner table) belong to
no family at all. Twelve records were water to the draw and dry land
to the pathing:

    7, 8, 22, 23, 32, 33, 34, 35, 36, 48, 49, 50

**DFU contradicts itself about this**, which is what settles the
question of whether the seven are a deliberate design or an
oversight. `PlayerMotor.OnShallowWaterTile` (:551-563) wades the
PLAYER through records 8, 23, 33-36 and 49 - and `GetTileWeight`
walks the TOWNSFOLK over the very same records dry-shod. The same
codebase calls them water in one file and ground in the other.

**The departure, enhanced lane only**, under WATER1's one switch
(`waterSwitchOn()`, `enhancedWater`, `?water=off`): the enhanced arm
of `tileWeight` asks the port's **own** water table -
`WATER_MASK_TABLE` in `world/waterCorners.js`, the same table
`render/waterSurface.js` draws from and `player/exteriorSurface.js`
swims the player by. `WATER_RECORDS_ENHANCED` is **derived** from it
at module load (every record with any water corner under any of its
four transforms), never listed; a hand-written roster is exactly how
DFU's seven came to be wrong, and a second enumeration of the water
family is the one thing this arc must not grow.

So MAC2's principle now covers the third consumer: **the picture, the
physics and the pathing cannot disagree by construction.** Wherever
the enhanced pass draws water, a wandering NPC will not walk into it.

**What is untouched.** The classic lane keeps DFU's seven exactly -
the departure is a single `if` ahead of the verbatim switch, so the
switch is still readable as the verbatim thing it is. Both exterior
hosts (`scenes/world.js`, `scenes/exterior.js`) pass the same switch
through `setBlockData`; the dungeon and interior navgrids have no
tile law and take nothing.

**Pinned** in `test/waternpc.test.js` (4): the classic lane against
DFU's seven and against the twelve staying weight 7 there; the
enhanced family recomputed from the corner table rather than listed;
DFU's own `OnShallowWaterTile` contradiction as the reason; and both
hosts swept for the same switch, because a departure gated in one
host and not the other is the four-hosts trap wearing a new coat.
Ledger A row: WATER1, extended.

**Still open: WATER-A.** Mac's other half of the same report - "in
towns some textures are still the old square panels instead of our
new animated water" - is *not* this. The terrain-water chain was read
end to end and is sound: the 0xFF location-zero sentinel converts back
to record 0 (`world/terrainSurface.js`, `convertTile`), the conversion
happens before the stamp and not after, and the enhanced pass's record
set is a strict superset of DFU's. The remaining hypothesis is that
the panels are not terrain at all but RMB **model or flat** geometry -
a block's own water prop, drawn by the model pass, which the water
surface never sees because it draws over the terrain grid alone.
Confirming it needs either ARENA2 data (not in this container) or the
name of a town where Mac sees it.

## WATER-DRAW1 - THE DRAW AND THE FEET ARE NOT THE SAME QUESTION (2026-09-19)

Mac, with a screenshot: *"It shows some textures not taking the water
tile. Sometimes water tiles will be on their own as 1 tile. (Might be
because it registers as ground or some waterbeds are just 1 tile."*

The picture is a town pond. Every tile in it shimmers except one, which
sits there as a flat blue square with a muddy bed showing through — the
terrain pass's own tile, with no water drawn over it. The fragment
shader's first statement says why:

```glsl
uint corners = waterCorners(data);
if (corners == 0u) discard;
```

**Where the zero came from.** The whole-tile half of the corner table is
`SHALLOW_WHOLE`, and `SHALLOW_WHOLE` is `PlayerMotor.OnShallowWaterTile`
(:551-563) — a list DFU uses to decide whether the PLAYER'S FEET are in
shallow water. DFU never drew a water surface at all, so that list was
never a drawing list. WATER1 made it one, and inherited its omissions
whole. Record 9 is the omission that shows: it sits inside the
water-dirt group (5-8 are the marching shapes and the first shallow
variant), its art is a water tile, and DFU's motor does not name it — so
the enhanced pass refused to draw it and the terrain's flat tile is what
you see.

**Two tables now, and the split is the point.** `WATER_MASK_TABLE` is
unchanged and is the LAW's: what the player swims in
(`player/exteriorSurface.js`) and what a town's own navigation refuses to
walk (`world/cityNavigation.js`) are DFU's answers and stay verbatim —
adding record 9 there would have changed the physics to fix a picture.
`WATER_DRAW_MASK_TABLE` is the ENHANCED PASS's: the law's table plus
`SHALLOW_DRAWN`. The pass, the shader's packed uniform, the water lab and
the grass placer's wet test all take the draw's; the feet and the
navigation take the law's. A pin holds that `SHALLOW_DRAWN` is the WHOLE
of the difference between them, so neither can drift into the other.

**Said plainly: this list is read off a screenshot, not off ARENA2**,
which this container does not have. Record 9 is the one record in 0-55
that is water art and covered by neither the shore families nor DFU's
motor list, so it is the one candidate the code can name from here.
`window.__tileHere()` prints the record under the player, its transform,
and both answers — the draw's and the feet's — so the next tile that
looks wrong reports itself as a number instead of a screenshot, and goes
on that line.

**The second half of the report stands as written and is NOT a bug.**
"Sometimes water tiles will be on their own as 1 tile" is DFU's own,
recorded at `world/terrainSurface.js:"- 0 for the 0xFF"`: `setLocationTiles` stores a
town ground tile that encodes as zero as the 0xFF sentinel, `convertTile`
restores it to record 0, and record 0 IS water — so a town tile that
happened to encode as zero reads as a one-tile pond to every consumer.
Mac's own guess ("some waterbeds are just 1 tile") is the right one. The
port keeps it.

**Pinned** in `test/grasspath.test.js` (2), with `test/water.test.js`
holding the law's table unmoved.

## WATER-D1 - THE DUNGEON WATER WAS DRAWN AFTER THE FRAME HAD BEEN RESOLVED (2026-09-21)

LostMyLeg, on Discord: *"Everytime you go into a dungeon you can see 2
Watertiles/textures floating around per player, the console says 2 Water
in every dungeon those need to be excluded for all dungeons. Spawned
dungeons already have this guard in so it doesnt happen in them right
now."* And the report that produced that guard the day before (AIWATER,
Mac's patch): a spawn's water *"shown well below the floor, in patches,
reading like a no-clip glitch."*

**The level was never wrong.** DFU's law was fetched and read again
rather than trusted from memory: `Billboard.SetRDBResourceData` writes
`WaterLevel = -8 * SoundIndex` (10000 for a zero) off a start marker's
flat resource, `DaggerfallDungeon.FindMarkers` takes `StartMarkers[0]`
for every block, and `RDBLayout.AddWater` stands a plane the size of the
block at `level * -1 * GlobalScale`. That is `world/rdbLayout.js:"let waterLevel ="`
and the quad `scenes/dungeonContext.js` mints, line for line, and R7's
corpus pins (32 of 187 blocks watered, Maorn's Guard's three levels)
have held it since August. The "2 Water" the console prints is the count
of watered blocks in the dungeon just entered - two of them, in the
dungeons he tried - and it is the right count.

**The order was wrong, and only on the lane.** Both dungeon hosts called
`renderer.drawWater` AFTER `dungeonContext.drawFoes` returned. `drawFoes`
ends with the weapon overlay and the HUD, and those are SCREEN QUADS -
and since EL3 (2026-09-17) a screen quad is where the enhanced-lighting
lane ends the world pass and RESOLVES its frame target to the canvas
(`Renderer.drawScreenQuad` -> `_compositeAir`: the lane's framebuffer is
unbound, `_frameFbo` is null). A water quad drawn after that lands on
the DEFAULT framebuffer, whose depth buffer holds no world at all - the
frame's depth went into the lane's own target - so the plane passed the
depth test everywhere and was painted over the resolved picture: through
every wall, under every floor, wherever the player stood. "Floating
around", "well below the floor, in patches", "no-clip". On the classic
set there is no lane and no resolve, the default depth buffer IS the
world's, and the very same call order was correct - which is why the
plane drew right for a month and wrong from the day EL3 shipped, and
why a spawn (a clone of a real dungeon's blocks, drawn by the same
host) showed it "every time".

**The fix is a move, not a guard.** The draw is a world draw, so it
lives INSIDE `drawFoes` now - after the last world billboard (the foes,
the drops, the missiles), before the weapon overlay - the one frame
function both hosts call, exactly where the exterior's water surface
has always been drawn (inside the world pass, long before the HUD).
Each host names the water tile's archive once, at the build
(`ctx.setWaterArchive`), the colour has one home (`DUNGEON_WATER_COLOR`
in the context; both hosts carried the literal), and the scroll clock
is the context's own `dt` sum on the one rate. The AIWATER skip for a
spawned dungeon stands as Mac's patch wrote it; its cause is this one,
so it is his call whether a spawn gets its water back.

**Pinned** in `test/waterd1.test.js` (4): the renderer's own contract on
a recording GL - with the lane and the air up, a `drawWater` before the
first screen quad draws with the frame target bound and the same call
after it draws on the canvas (the mechanism the defect rode, so a future
host that draws after the overlay is caught by the reason and not the
symptom); the ORDER inside `drawFoes`, derived - every `renderer.draw*`
in the body precedes the overlay call, and the water is among them,
after the last billboards; no scene file but the context calls
`drawWater` and both hosts name the tile at the build; the colour's one
home and the level law untouched. `test/water.test.js`'s two host pins
re-aimed at the context. Mutants: `tools/mutants/waterd1.json`, 10, 10
dead - among them the defect put back as a SECOND draw after the
overlay, a host regrowing its own draw, and the screen quad no longer
resolving the frame.


## WATER-PUDDLE - THE PUDDLE IS THE ART'S (2026-09-25)

Mac: *"fixing any and all issues (especially with ingame puddles and
tiles in towns that are one square)"*.

**What was on screen.** Standing in Bubumbaret (the Sentinel desert,
pixel 416,376), `window.__findTiles` put the camera over a record-23
tile (byte 94, flipped): a pool painted in the sand, and over it the
enhanced pass's full 6.4 m square of shimmering water, edge to edge. It
was not that tile. Every record the corner table calls whole without
knowing its shape did the same - DFU's shallow-water records (8, 23,
33-36: the docks, moats and puddles, `SHALLOW_WHOLE`) and WATER-DRAW1's
record 9 (`SHALLOW_DRAWN`). Their corners are all four because WATER1
had no geometry for them (MAC2 took them whole from
`PlayerMotor.OnShallowWaterTile`), so the pass covered the tile, not the
water on it. That is the "one square" in the towns: a census of every
RMB block's ground (a scratch script, not committed) found only TWO lone
record-0 tiles in all the data - DFU's own sentinel tiles, WATER-DRAW1's
second half, kept - and the rest of the lone squares are these records.

**WATER-DRAW1 corrected.** It added record 9 as "water art" from a
screenshot, with no ARENA2 in the container; it said so. The art (in
the container now) disagrees for most of the Bay: record 9 carries no
water at all in the desert, the woods, and every winter set; a strip in
the mountains and about a fifth of the tile in the swamp. Drawn whole,
it was a square of water on sand or grass.

**The rule: the record's own texels.** `world/puddleMask.js` reads each
of the seven records' texels: water where the colour sits within 24
(Euclidean RGB) of one of the water tile's own colours - WATER5's rule,
reverted with the basin, back for these records alone; every other tile
keeps WATER1's corner table and its look. The texel answer is cleaned
into shapes (4-connected patches under 32 texels: a wet speck in the
sand dries, a dry fleck inside a pool fills, a dry patch at the tile's
edge is the neighbour's ground and stays). The answer rides in the
ALPHA of that record's layer of the ground tile array - every reader of
the array takes `.rgb` (`TERRAIN_FS`, the enhanced terrain, the water's
own texel), so the alpha was the free channel, and the array's mip
chain carries the mask into the distance with no second texture. The
layer is COPIED before it is written. Both hosts write it before the
upload (`renderer.uploadTileArray(groundArchive, markPuddleWater(layers))`).

In the pass, a puddle record's fragment reads that alpha at the
record's own texel, turned the way `TERRAIN_FS` turns the tile
(`PUDDLE_ROT`/`PUDDLE_TRANS`, the same four matrices, pinned against the
terrain's), softened through `smoothstep(0.3, 0.7, a)` and multiplied
into the shore feather: the shimmer now sits in the pool the art paints
and the sand round it is sand.

Measured on the art (the share of a tile the mask calls water, one
archive per climate the terrain reaches - the rain sets, +2, are
reachable only by hand, `world/climateSwaps.js` A1):

| Archive | 8 | 9 | 23 | 33 | 34 | 35 | 36 |
|---|---|---|---|---|---|---|---|
| 2 desert | .20 | 0 | .32 | .28 | .42 | .53 | .48 |
| 102 mountain | .24 | .13 | .82 | .83 | .56 | .86 | .71 |
| 103 mountain winter | .30 | 0 | .10 | .49 | .49 | .42 | .56 |
| 302 temperate | .24 | 0 | .57 | .50 | .45 | .63 | .49 |
| 303 temperate winter | .23 | 0 | .36 | .29 | .45 | .52 | .44 |
| 402 swamp | .86 | .22 | .76 | .70 | .75 | .73 | .77 |
| 403 swamp winter | .50 | 0 | .20 | .20 | .55 | .73 | .52 |

Before this slice every cell was 1. Recorded, not hidden: in a rain set
the wet ground sits inside the tolerance of the dark water (mountain
rain's shallow records read nearly whole), so a hand-picked rain season
draws them as the pass did before - no worse, and not reachable in play.

**The feet are not asked.** Where the player wades stays DFU's
`OnShallowWaterTile` - the whole tile; `WATER_MASK_TABLE` is untouched
and WATER-DRAW1's split holds (the draw and the law are two questions).
The navigation keeps the law's table too. The GRASS follows the picture
(GRASS-WET1: a blade in a puddle is a picture, not a physics): it asked
the draw's corners and refused the whole tile, which would have left the
dry ground of every puddle tile bald - a lawn with a 6.4 m hole in it
wherever record 9 is grass art. It now asks the same mask for a puddle
record (`puddleWetAt`, the pass's turn on the CPU, pinned against the
shader's matrices), from the layers the pass uploads.

**The probe.** `window.__findTiles(records, max = 40)` lists the built
tiles of the given records - pixel, record, byte, and the world
position on the ground - so a shot can stand over one; `__tileHere()`
now says `artWet` too, the mask under the eye. Seen in play at
Bubumbaret: the record-23 tile is its painted pool with the water inside
the rim, and the town's record-9 tiles are their own ground. The before and
after shots are renders of game data and stay out of the repo.

**Pinned** in `test/waterpuddle.test.js` (6): the list and the
tolerance; the colour rule texel-exact (24 water, 25 dry), the speck
dropped, the fleck filled, record 9 in grass dry, the copy; `cleanMask`'s
edge law; the shader's record test, its alpha read through the turn and
the turn matrices against `TERRAIN_FS`'s, both hosts' upload, the feet
still whole; the CPU's turn against the shader's, texel for texel, and
the grass placer asking it; and, with ARENA2, the desert puddle a pool (not the tile)
and the desert's and the woods' record 9 dry. Mutants (21, 21 dead):
`tools/mutants/waterpuddle.json`.

## PUDDLE-DRY - A TOWN'S PUDDLES ARE DRY GROUND (2026-10-07)

Mac: *"removing the water puddles entirely from town layouts"*; asked,
"Puddles only" (the moats and the docks' water stay) and "Both skins".
Port-Ledger section A, row PUDDLE-DRY.

**What a puddle is, measured.** A census of BLOCKS.BSA (a scratch script
over every RMB block's 16x16 ground, not committed; the figures are
pinned with ARENA2 in `test/puddledry.test.js`): 920 blocks, 1,311
patches of water - 4-connected, a tile counted wet where the draw's table
(`WATER_DRAW_MASK_TABLE`) gives it any water corner, so a pond's shore
ring is part of its pond. 674 patches are ONE tile: 632 of them DFU's
shallow-water art (records 8: 141, 9: 353, 23: 138 - a pool painted on
sand or grass, WATER-PUDDLE's "one square"), the rest a lone shore
corner or edge, two lone record-0 tiles (WATER-DRAW1's sentinel tiles)
and a few records 33 and 36. The rest are laid-out water: a water heart
in its shore ring, a garden pond, a hard-edged basin of two to four
open-water tiles (a trough, a fountain's bowl), a shore ring round a
statue, the castles' moats (a CASTAA block's runs to 202 tiles with its
ring), Sentinel's harbour.

**The rule** (`world/puddleDry.js` dryPuddles): a patch is a puddle when
it is one tile, or every tile of it is shallow-water art
(`PUDDLE_RECORDS`: SHALLOW_WHOLE and SHALLOW_DRAWN, one list). Each of
its tiles takes the ground most of its eight dry neighbours stand on, the
byte whole (its turn and flip with it), a tie to the first in the walk's
order; a wet neighbour and a random marker are no ground; a puddle with
no dry neighbour is left. 700 patches dried, 611 kept (686 and 560 since
WATER-DRAW2, below: the islands joined their ponds). Daggerfall city's
61 puddle tiles (records 8: 17, 9: 33, 23: 11) became 31 dirt, 11 road,
10 grass, 6 of record 11, 2 of 47 and 1 of 10 - the terrain test's city
histogram moved with them.

**One door.** It runs where a block is served - `formats/blocksFile.js`
getBlock, BLOCKS.BSA's block and a world-data mod's - once a ground. So
every reader of the ground sees one ground with no puddle law of its own:
the streamed stamp (`terrainTiles.js` setLocationTiles), the fixed town
(`scenes/exterior.js`), the streamed town's tilemap (`scenes/world.js`),
the layout (`rmbLayout.js` buildGroundTilemap), the townsfolk's paths
(`cityNavigation.js`), the town map (`ui/inkTown.js`); the feet
(`exteriorSurface.js`, PUDDLE-RAIN's whole-tile swim gone with the tile),
the grass (GRASS-WET1) and the water pass follow. `readClassicBlock` (a
mod's diff base) keeps the file's bytes. Both skins: the classic town
loses its puddles too, the departure Mac chose so the two never
disagree. WATER-PUDDLE's art mask stays for the shallow art that still
meets a pond.

**Pinned** in `test/puddledry.test.js` (7), its fixtures the block
reader's own ground decode: the list; a pool in the sand is sand, the
byte whole, a wet neighbour never taken; a patch of art and a lone tile
of anything wet dried; a pond in its ring, a basin and art meeting a
shore kept; once a ground, never from nothing; the one door by source;
with ARENA2, every block served with no puddle, 686 dried, 560 kept (PIN
MOVED by WATER-DRAW2), a
moat whole. Moved: `test/terrain.test.js`'s Daggerfall city histogram and
`test/rr3b_worlddata.test.js`'s GetBlock pin (PIN MOVED). Mutants (12,
12 dead): `tools/mutants/puddledry.json` - the first run's two survivors
were a redundant sentinel ternary (taken out: `convertTile` answers
record 0 for the zero byte either way) and a wet diagonal neighbour no
pin offered (pinned).

## WATER-NEXT - THE OVERHAUL, AS DECIDED (2026-10-07)

Mac: *"overhauling the water to appear as real translucent water with
proper waves and shoreline interactivity completely replacing our current
water implementation"*; asked: the new water is the ENHANCED skin's (the
classic skin keeps DFU's flat tile - the doctrine; AUDIT WATER-NEXT m3: the skin, not the lighting lane); the waves modest and
the weather's (calm lakes and rivers, a sea's swell that grows in a
storm); the gameplay's water line fixed. The plan, a pull request a phase,
each landed on a shot from the real game (THE REVERT's lesson):

1. **PUDDLE-DRY** (above) - shipped first, apart from the renderer.
2. **The surface.** One water renderer for WATER1's terrain water and
   Deep Waters' sea top alike: a tessellated surface of its own, summed
   Gerstner waves moving it; the frame's opaque colour and depth copied
   after the opaque passes, so the water refracts what is under it,
   darkens with depth (absorption) and meets the ground softly; Fresnel
   over the sky. Behind the `enhanced-water` row; its cost measured on
   the game page against PERF-EXT13's pass, with a cheaper setting for a
   weak GPU.
3. **The shore and the beds.** Foam where the water is shallow, the
   swell running up a beach, the breakers built from the same waves
   (Come Sail Away's sprite breakers retired for it); a shallow bed
   carved under a lake, pond or moat, whose ground today sits at the
   surface - clear water must have something under it (the sea has Deep
   Waters' floor, the rivers LANDFORM3's channel).
4. **The ripples.** A ripple field round the camera - the player's, a
   boat's and a creature's wakes, wading rings and splashes.

**What does not move.** Every reader of water as play keeps its line:
the feet (`exteriorSurface.js`), `onExteriorWater`, fishing, climbing,
the swim motor, the townsfolk's paths, Deep Waters' swim, the boats'
`WaterLevel` (a boat bobs on the waves' own function, drawn only), the
dungeon's level. WATER2-5's revert is the warning: a look is landed on
the game page, not the lab.

## WATER-NEXT 2 - THE SURFACE: A SHEET THAT MOVES, A BODY THAT SWALLOWS LIGHT, A BED UNDER IT (2026-10-07)

Mac: *"real translucent water with proper waves and shoreline interactivity completely replacing our current water
implementation"*, then *"keep building within this pr"* and *"You have autonomy"*. Enhanced skin only (asked); the
classic skin draws DFU's flat tile as it did (AUDIT WATER-NEXT m3: the skin - the Enhanced skin on the classic lighting
lane draws the new water, its blend arm). Every step was judged on shots of the real game
(`tools/waterLookProbe.mjs`, Daggerfall's moat and Sentinel's palace pool and harbour, headless on SwiftShader with
the player's own ARENA2 - the renders stay out of the tree), THE REVERT's lesson.

**The bed** (`world/waterBed.js`). A grid vertex is wet when every tile meeting it calls that corner water (the
draw's corner table; a tile past the map's edge is no vote, so a river is not dammed at a pixel's seam); its distance
to the bank is a 3-4 chamfer; its depth a smoothstep to `BED_DEPTH` (4) over `BED_RAMP` (19.2, three tiles). The
first cut eased OUT (steep off the bank) and the real moat showed why not: a tile from the bank was already 2.2 deep
and the shallows were a sliver; the smoothstep leaves a shelf a unit deep a tile out. `carveBed` lowers a COPY of
the grid the ground uploads and re-lights the slopes it made (a strided grid's skirt goes down with its edge); the
SHEET keeps the grid as it stood, the bed's depth on attribute 1 (`renderer.createWaterSheet`). DRAWN ONLY: world.js
`heightAt` reads the samples, the fixed town's feet the tilemap and the flat ground - the player swims, foes stand
and flats are seated where DFU has them. The streamed world carves at the build and at a restride and keeps the bed
for Deep Waters' re-index (`dwWaterSurface`); the fixed town lays DFU's one ground quad as a grid of its tiles
(`flatGrid`) so its moats and ponds have a bed; the lab carves as the hosts do. A grid with no wet vertex (a one-tile
stream) has no bed: its sheet rides the terrain's own buffer and attribute 1 is the constant `NO_BED_DEPTH` (1.2) -
shallow, tinted, never a shore.

**The bed's face** (`render/waterBedGlsl.js`). The second shot of the moat was as blue as the first, and the reason
was under the water: the carved ground still wore Daggerfall's WATER TILE, so the look through clear water was a
look at more painted water. Where the enhanced water lies (`renderer.waterBed`, set by both hosts from `waterOn`;
the classic skin never sets it) each water texel of the ground - the corner table's coverage, feathered as the
water's shore - takes the climate's dirt (record 1, the same texel turned the same way) darkened to silt; a puddle
record keeps its art. Both terrain programs take the text (TERRAIN_FS and the lane's EL_TERRAIN_FS, decoded).

**The swell** (`render/waterSurface.js` SWELL_TRAINS, SWELL_GLSL, swellAt). Three trains - down the wind, +31 and
-43 degrees off it - of 48, 31 and 25.6 units (none shorter than four of the sheet's cells), at deep water's own
speed (omega = sqrt(g k)), their height the wind's: `SWELL_CALM` 0.05 to `SWELL_GALE` 0.34 ("modest,
weather-driven", as asked). The vertex shader lifts the sheet by it, faded over the bank (`SWELL_DEPTH` 2.5: water
never lifts off its shore); the fragment shader lights the same field's slope per pixel, with WATER1's finer trains
and the rain over it; `swellAt` is the same sum for the CPU. The open sea (Deep Waters' sheets: merged rectangles,
no vertices to move) takes the swell as slope only.

**The body and the look through it.** Water swallows light, red first: Beer-Lambert, `exp(-WATER_ABSORB * path)`,
`WATER_ABSORB` (0.55, 0.30, 0.22) a unit. What is swallowed is replaced by the water's own colour - the climate's
water texel averaged by its mip chain, tinted, lit by the ground's light (the sun's share softened: light goes INTO
water). Under the lane the frame's colour and depth are copied ONCE a frame before the first water draw
(`AirPass.snapshotUnderWater`, one blit into the frame's own formats; `Renderer.captureUnderWater`; units 7 and 6,
rebound every draw as the billboards rebind 6): the path is the scene's own depth behind the surface (never less
than the bed's), the look is pushed by the slope (by more the deeper, less the farther off) and never takes what
stands in front of the water (a pushed look nearer than the surface takes the straight one). Without a copy (the
classic lane's frame) the blend makes the same sum: the bed is drawn under the sheet, and the sheet's alpha is the
share the water hides. Schlick's Fresnel over the sky (capped at 0.85), the sun's, the moon's and the lamps' glints
(WATER-LIT1), the fog (DW-C's too). The first real boot found `uOpen` an int whose default precision differs between
the stages (no program built, no frame drawn): the fragment stage declares `precision highp int`.

**The open sea.** From above, Iliac Puddle No More's surface sheets are drawn by the same program (`uOpen`: no
tilemap, no bed attribute - the path is the depth copy's, the floor the mod carved), in the mod's own place in the
frame (`Renderer.drawSeaSurfaces`, world.js drawDeepWatersSurfaces), coloured by the camera's climate's water under
the mod's Top Color; from under it, the mod's own underside as before. The first shots of the open sea (Sentinel's
harbour) found three things the mod's own near-opaque top had hidden, each fixed: the integer tilemap sampler's unit
left holding another pass's texture for the sea's rows (WebGL refuses the draw, read or not - 74 errors a boot; the
unit is emptied for them); the mod's fake water column on its floor (COLUMN_GLSL, the depth the classic set never had,
its surface texture tiled 128 times) showing through clear water as moire and taking the column twice - off under the
enhanced water (`columnOn`), which measures the column itself; and the sheets' 6.4-unit cells drawing a staircase over
the beach - the open sea now fades where it covers no water, so the shore is where its plane meets the sand.

**What it costs, and the Simple tier.** Under the lane the copy is one blit of the frame's colour and depth a frame,
and the water's fragments read up to seven more texels (the copy, its depth twice, the ripple field's four taps - AUDIT
WATER-NEXT m11); SwiftShader's
milliseconds are nobody's, so the cost on a real GPU is not measured here. The plan's cheaper setting is the
`water-quality` row (Features, the Enhanced kind, the player's online): Full by default; Simple takes no copy and keeps no
ripple field (`renderer.waterSimple`) - the bed, the swell, the foam and the body stand, and the blend does the looking
through, as on the classic lane's frame.

## WATER-NEXT 3 - THE SHORE (2026-10-07)

Foam where the water runs out: over the band `FOAM_DEPTH` (0.22) deep - wider in a wind - whose edge rides the
swell's own height (`FOAM_RUNUP` 2.2: the crest pushes it up the bank, the trough draws it back), cut into lace by a
two-octave noise drifting down the wind; on open water in a strong wind the steep crests whiten (`CREST_SLOPE`).
Lit by the light the water is; opaque where it lies; no glint through it. The first shot (Sentinel's pool) drew a
solid white rim round a calm pool - the band was 0.55 deep and the lace's threshold let the whole band through; the
band is narrower and the lace a thread now, thicker only in the shallowest water and a wind. Come Sail Away's sprite
breakers are retired under the enhanced water (`csaDrawWaves`): it breaks on its own shore, and the breakers - opaque,
written into the depth a hand over the sea - were what the clear water then showed as its ground, a striped sea.

## WATER-NEXT 4 - THE RIPPLES (2026-10-07)

`world/waterRipples.js`: a damped wave equation (`RIPPLE_DAMPING` 0.975 a step) on a 96-cell grid 48 units across
round the camera, stepped at a fixed 30 Hz (a stalled frame runs four steps at most), sliding with the eye a whole
cell at a time so a wake stays where it was left, its edge still water, asleep when still. Stirred where a body
moves in the water (`stirOf`: a still swimmer's bob, a wader's wake growing with speed to a cap) - the player, by the
footsteps' own on-water answer, and every boat afloat (Come Sail Away's). The renderer uploads it (R8, 128 still
water, `RIPPLE_SCALE` a step) only when it moved, on unit 1 - the billboards' emission unit, whose shadow it forgets
after the bind - and the water adds its slope inside the field, faded at the field's edge. Drawn only.

**Pinned**: `test/waterbed.test.js` (6), `test/waterripples.test.js` (6), `test/waternext.test.js` (8); WATER1's pins
moved to the new shapes (`water.test.js`, `waterlit1`, `dwc_fog`, `perfextb`, `perfsun_fragment`, `grain1_terrainmip`,
`ft6_water`, `terrainworker`, `dwe_decorations` - each PIN MOVED; `rr3b` is PUDDLE-DRY's, above - AUDIT WATER-NEXT m1/m4). Mutants: `tools/mutants/waternext.json`, all dead (the first run's four
survivors - the chamfer's diagonal, the byte bias after a step, unit 1's shadow pinned on a twin line, the gale pinned
against itself - each pinned).

## AUDIT WATER-NEXT (2026-10-07) - THE WATER AUDITED, ITS COST MEASURED

Mac: *"I want you to do a comprehensive audit ensuring this is perfection and performance is unaffected"*. Three lenses
(the GL and the shader; the hosts and the world's lifecycle; the record and the pins) and a performance lens measured
against main; the findings, the fixes and what is recorded are `01-Overview/Audit-WATER-NEXT.md`. What moved in the laws
above:

- **The bed is the kernel's** (P1). `terrainGen.js restrideGrid` carves it with the grid it builds - the build's, the
  promotion's and the restride's, on the terrain worker - and the host uploads what it answers (`bed`: the depths, the
  sheet's depths, the carved ground, the seam's halo). WATER-NEXT 2 had carved on the host's thread at every build and
  restride: 0.3 ms for a pixel with no water, 1-2 ms for a coast's.
- **Deep Waters' cap carves it** (H1). The bed is carved from the TileMap the water draws from (`bedBytesOf`: the cap's
  where it patched one): a tile the cap repaints is ground (it was a dry pit four units deep), and a tile it clips votes
  dry, so the bed meets the mod's floor, fitted to the shore, at the clip's edge. `dwRecarve` carves again from the grid
  as it stood when the cap lands or lifts.
- **A seam is carved alike from both sides** (F2). A near grid's bed reads `BED_HALO_TILES` (4) of each neighbour's
  tiles past its edge, classified and marched by the neighbour's own law (`terrainTiles.js tileDataAt`, `marchTile`)
  from the kernel's ghost samples; a stamped or painted neighbour tile (a town, a road, a river) is not in its kernel,
  and a strided grid's skirt closes its own seams.
- **The sheet has its own depths** (H2, `sheetDepthsOf`): the carve's depth where the carve reaches, its bank 0, and
  `SHEET_NO_BED` (`-NO_BED_DEPTH`) over ground never carved - tinted water that takes no swell (its troughs had gone
  under the ground in a fair wind).
- **The composition is premultiplied** (G1/G3): what is seen through the water is fogged once, as its bank is; a glint
  and the foam are the same strength with or without the copy.
- **The sea takes its own copy** (G2), after the flats and the people it may stand in front of.
- **The ripple field** sleeps again after a slide (its edge held still - M1), slides nothing asleep (P2), is placed
  where its bytes were packed (G13), is stirred by a hull only under way (`BOAT_WAKE_SPEED`, P3) and by the outdoor
  swimmer's own flag (F4), and runs in the fixed town too through the hosts' one stir (`createRippleStir`, m12). THE
  FOUR HOSTS: the streaming world and the fixed town draw the enhanced water and stir its field; the interiors
  (`worldModes.js`) and the dungeons (`dungeonContext.js`) draw no enhanced water - their pools are the classic plane.
- `WATER_OPACITY` and the sheet's `scroll` retired (m6): nothing drew them.

## WATER-DRAW2 - THE DRAW'S TABLE KNOWS THE WATER ART (2026-10-07)

Mac, with a phone screenshot of a winter town - a pond of WATER-NEXT's water and in it two flat blue squares, each
round a white island: *"Is there a reason these fucking patches still remain after our most recent water changes?"*

**The reason.** The squares are record 19 (water round an island of grass) and record 4 (round dirt; 29 is the stone
one) - snow islands in winter. Neither is a marching shape nor in DFU's `OnShallowWaterTile` list, so the corner table
(`world/waterCorners.js`) gave them no water corner - and every water law of the day asks that table. PUDDLE-DRY's
census never counted them; WATER-NEXT's bed would not carve under them, its silt left them their painted water, its
sheet stopped at their edges and its foam ringed them. The pond was the new water and the island tile in it DFU's
painted tile, flat. Reproduced in the real game: Daggerfall city in winter (`tools/waterLookProbe.mjs`,
`season=winter`, the first record-19 tile `__findTiles` names on pixel 207,213) - the square in the pond, as in the
field.

**Every gap, measured on the art.** WATER-PUDDLE's colour rule (record 0's own colours within 24, `cleanMask`'s shapes)
read at each corner of every record at every turn, through the pass's own turn (`turnFraction`) - a corner is water
where half its quarter-tile square is. In the four climates the rule reads cleanly (the desert, the woods and the two
winters; the mountain's and the swamp's summer grounds sit inside the water's tolerance, as WATER-PUDDLE found) the
method agrees with every shore entry the table already held. Where the art paints water at a corner in all four and
the table said dry, three kinds, each laid in BLOCKS.BSA:

| Kind | Records | The art's corners | In the 920 RMB blocks | In the world's 15,251 locations |
|---|---|---|---|---|
| water round an island | 4, 19, 29 | all four (the desert's 4: three - its sand reaches a corner) | 1,071 | 52,755 |
| a ground of two or three kinds with water in one corner | 37, 38, 40, 41, 43, 44 | record 7's one corner, turn for turn | 76 | 5,836 |
| a saddle laid half turned | 48, 49, 50 at turns 2 and 3 | the diagonal of turns 0 and 1 | 138 | 10,191 |

The marching table writes a saddle's two diagonals at turns 0 and 1 only; a block that sets the flip bit asks for turn
2 or 3, which nothing wrote. 10,302 of the 15,251 locations lay at least one of the three. Almost all of them sit in
ponds: FIGHAA02's garden pond inside its paving (207 towns lay that block), the graveyards' ponds, the farms'.

**The rule** (`buildWaterMaskTable(true)`): an island whole, a corner record 7's, a saddle's turns 2 and 3 its 0 and
1. The DRAW's table alone, as WATER-DRAW1's record 9: DFU walks the player over all of them dry, so the law's table -
the feet, the townsfolk's paths - is byte for byte what it was. Every reader of the draw follows with no law of its
own: the bed carves under them, the silt covers them, the sheet and the foam take them in, and the grass leaves a
corner tile as it leaves a shore tile (GRASS-WET1). The classic skin draws DFU's tile as before. THE FOUR HOSTS: the
streaming world (`scenes/world.js`) and the fixed town (`scenes/exterior.js`, `buildWaterIndices` and its `flatGrid`
bed) take the new entries through the table they already read; the interiors (`worldModes.js`) and the dungeons
(`dungeonContext.js`) draw no enhanced water and stand on no RMB ground. In the Enhanced skin an island is the pond's
water: the island DFU paints goes under the silt with the painted water. It could not stand:
the bed is carved at the tiles' corners, so an island kept by its art would sit below the sheet in a hole the art's
mask cut.

**PUDDLE-DRY follows.** Its patches are the draw's water, so the islands joined their ponds: six lone island tiles
dry, and twenty tiles of ponds an island had cut apart (FARMAA03's shore edges among them) are no longer dried as lone
slivers - PUDDLE-DRY had been punching holes in those ponds. A puddle beside an island no longer takes the island's byte
as its ground: twice a dried sliver had taken its neighbour's water art (SENT0's record 6 made a record 4, FARMAA09's
record 32 a record 43). The census, pinned
with ARENA2: 1,246 patches (1,311 before), 660 of one tile (674), 686 dried and 560 kept (700 and 611), 720 tiles dried
(734), the CASTAA25 moat still 202. Daggerfall city's histogram does not move.

**Seen.** The same pose before and after (renders of game data, kept outside the tree): before, the island square flat
in the pond; after, one pond, its middle deeper now that no island bounds it.

**Recorded, not fixed here.** 285 tiles of puddle art are still served, each in a patch PUDDLE-DRY keeps, and 248 of
them meet their pond only across a dry edge - the shore tile beside them has its water on its far side - so they read
as puddles. The blue pool at the left of the after shot is one: Daggerfall city's last record 23, beside a record-22
corner whose water faces away. A connectivity that asks the corners on the shared edge would dry 199 record-23 tiles,
20 of record 8, 13 of 9 and 9 of 33; measured on every block it also parts 26 blocks' largest water by a fifth or more
(CASTAA27's moat, 168 tiles to 87) and dries 28 shore edges with them. That is a rule for Mac to choose, not one to
ride in on this fix.

**Pinned** in `test/waterdraw2.test.js` (5): the lists, and the table at every turn as literals; the law's table
untouched; PUDDLE-DRY on the block reader's own ground (a lone island, corner and half-turned saddle dried; an island
with its shore kept; art meeting a corner kept; a pool among islands made grass, never an island); the sheet and the
bed over a pond of islands; and, with ARENA2, no record and turn the art paints water at a corner in every clean
climate left dry, the corners and the saddles exactly the art's (36), and what BLOCKS.BSA lays. PIN MOVED:
`test/grasspath.test.js`'s WATER-DRAW1 difference (SHALLOW_DRAWN and WATER-DRAW2's three, a saddle only half
turned) and `test/puddledry.test.js`'s census. Mutants: `tools/mutants/waterdraw2.json` (9, all dead).
