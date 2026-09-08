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
draws the pixel's own terrain surface again - positions, normals,
indices, the far ring's strided twin included - lifted `WATER_LIFT`
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
shape (8, 9, 23, 33-36: town docks and moats) has no known geometry
and takes no water: the classic tile stands there, said so in the
module. The coverage inside a tile is the bilinear blend of its four
corners - the diagonal the shore tile's own art follows - feathered by
`SHORE_SOFTNESS` and discarded past the feather.

**The shading**, in the engine's own palette space (no sRGB anywhere):

- The normal is the gradient of three wave trains - one down the
  eased wind, two crossing it - with amplitudes on the wind's strength
  off a calm floor (the row's own scale, `systems/wind.js`: the same
  vector the cloud deck is drawn with and the mills turn on; null is
  calm), and under rain two fine trains that pock the surface with the
  front's intensity. Every train fades with the distance from the eye
  on its own wavelength's scale, so the far sea keeps the swell and
  nothing aliases into moire.
- The body of the water is the classic water texel (layer 0, scrolled
  at the dungeon water's rate), tinted deep, and lit by `TERRAIN_FS`'s
  own law term for term - ambient, the sun scaled and shadowed by the
  cloud deck (`_csLoc.water`: VC4's recorded gap, closed), the moon -
  so it sits in the frame the land beside it is lit in.
- Schlick's Fresnel (F0 0.02), capped at 0.72 because a sea is never a
  flat mirror, mixes that toward the reflected sky: the dome's own
  zenith and horizon this frame (`sky.waterSky()` on the shared sky
  object - the enhanced state's two colours; the mod's fog colour and
  fill; null under the classic sky, which draws no surface), leaning
  toward the zenith the way a rough sea integrates.
- The sun's and the moon's Blinn-Phong glints, the sun's under the
  cloud shadow.
- The alpha is the opacity (0.82) raised toward grazing by the same
  Fresnel, times the shore feather. The fog every world pass takes.

**The draw state.** `drawWater`'s (blend, no depth write, no cull)
plus a polygon offset (-1, -2) and `LEQUAL`: a world-space lift is
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
A pixel whose tilemap carries no water never enters the pass
(`tilemapHasWater`, decided at the build); a town without a water tile
never does.

## Found on the way: the ocean was beach

The water lab's first render put the sea at sand. Through the port's
own pipeline, a heightmap clamped to the ocean elevation gave
`generateTileData` ZERO water corners in 16641. The sampler stores
`scaledHeight / MaxTerrainHeight` in a Float32Array and the job
multiplies it back: in C# every step is a float and
`27.2f / 1539f * 1539f` rounds back to `27.2f`, so `<=` holds; in JS the
product is a double - `fround(27.2 / 1539) * 1539 = 27.20000077` -
and against the double 27.2 the compare failed for every clamped sea
sample. Every sea corner fell through to the beach band, and every
ocean tile this port ever drew was dirt. The height is rounded to
float32 and compared against float32 thresholds now, which is the
arithmetic the reference does (`world/terrainTiles.js`; pinned ungated
in `test/terrain.test.js`).

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

`tools/waterProbe.mjs` (port 5239, `/tmp/water-*.png`): nine claims,
each a shot against a shot - the pass changes the water and leaves the
sky alone; the surface moves; a gale varies more than a calm; a rainy
sea differs from a dry one; the sun glints toward the sun and not
away from it; midnight is dark and still water; an overcast sea is
less blue than a sunny one; no page or GL errors. 9/9. Three more
shots for the eye: the shore up close, the river and the lake, the
rain up close.

## What it does not do

No point lights on the water (a dock's lantern does not reflect), no
refraction or depth-tinted shallows (no depth texture), no foam, no
underwater view (DFU has no exterior submersion), no wake. The dungeon
keeps its own plane. Not seen on a real GPU or with ARENA2 - Mac's eye
is the next gate; the amplitudes, the tint and the cap are the lab's
sliders' to tune.
