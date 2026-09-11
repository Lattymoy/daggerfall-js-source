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

`render/waterSurface.js` and `drawWaterSurface` in `render/renderer.js`.
Enhanced skin only, switch `enhancedWater` (on by default, its row in
the enhanced pane), `?water=off` the kill door. The classic lane and
the terrain pass are untouched.

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

No point-light GLINTS on the water (a dock's lantern lights the surface
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
random-field round trip in `test/water2.test.js` proves the wet set
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

**Pinned** in `test/water2.test.js` (5); WATER1's pins in
`test/water.test.js` moved to the basin's shapes. Not seen on a GPU
or with ARENA2 - the lab (`water.html`) carves the same basin, and
`npm run perf` measures what it costs (nothing per frame: the walk and
the carve are at the build).

## WATER3 - THE SWELL AND THE FOAM (2026-09-11)

**Mac: "waves, shorelines".** WATER1's waves were a normal map: the
gradient of three trains, lit as slopes on a flat sheet. The sheet
moves now. The vertex shader rides `swellHeight`, which is the
INTEGRAL of the fragment's `waveGradient` train for train - a gradient
term `A cos(k x + w t)` is a height `A / k sin(k x + w t)`, the same
crossing rotations, the same distance fade on the same scale - so the
surface the eye sees heave and the slopes it is lit by are one field
(`test/water3.test.js` reads both shaders and holds the six numbers of
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

**Pinned** in `test/water3.test.js` (4). Not seen on a GPU; the lab
carries it.
