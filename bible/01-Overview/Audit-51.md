# Audit 51 - 1:1 parity with Basic Roads, by oracle

Mac, 2026-09-02: "Lets do a deep comprehensive audit and ensure 1:1
parity before continuing." Parity is not something to read for; it is
something to MEASURE. This audit's instrument is an oracle:
`tools/roadsOracle.py`, the mod's PaintPath, PaintPathTile,
PaintPathWithSubPathJoins and the job's paint order transliterated line
for line from the MIT C#. It emits what the mod paints for 651 cases -
every road mask, every track mask, every corner byte, random rivers
with streams, mixed pixels, location rects - and `test/roadsParity.
test.js` runs our painter on the same cases and compares byte for byte.

## What the oracle found

**First run: 639 of 651 cases differed.** Two causes, both mine from
the readings-from-a-description era, both surviving the ROADS 23 port
because the port kept my tables:

- **The tables' water column.** His road table paves water - 46 and 47
  in column 0 - and so do the track, stream and river tables (0, the
  water tile). Mine had NO_CHANGE there, from our generator's "water is
  never paved". His data never routes a road across water, so it never
  showed; the columns are his now.
- **Rotate before the zero check.** RotateFlipTile adds 64/128 and only
  THEN does `== 0` become water_temp, so flipped water is 128, not 0xff.
  Mine checked zero first. A flipped river column was 0xff where his is
  128 - the same water to the renderer (`& 0x3f`), a different byte to
  the oracle, and a different byte to the smoother, which keys on 0xff.

**Second run: 11 of 651.** All the location rect. The mod does NOT skip
the rect: a location's own tiles are non-zero and stop every painter by
themselves; the rect's PADDING is painted through by every arm; and then
"Paint roads around locations" - inside PaintPath, roads only, strictly
inside the rect - paves whatever padding is left. THAT is how his towns
ring. ROADS 22 removed the other instance's ring saying "the mod paints
none"; the mod paints one, differently: no edge band, roads only,
rect-bounded, arms through it. Ported as written.

**Third run: 0 of 651.** The painter is his.

## A1 - HIGH, FIXED. The smoother was not his.

His SmoothRoadsJob smooths only tiles that are road (46) or water_temp
(0xff) - not edges, not tracks - and for each, the tile's four corner
samples take a five-point mean of themselves and four orthogonal
neighbours, IN PLACE and in scan order, over [1, hDim-3], skipping the
rect. Mine smoothed every path tile's corners from a copy of the
original heights. Ported.

**No divergence - and the record said there was one, twice (MODS
AUDIT, 2026-09-08).** The kernel joins TWO layouts, both DFU's: the
TILEMAP is `JobA.Idx(x, y, tDim)` = `x + y*tDim` (TerrainHelper.cs:170,
with JobHelpers.cs:19-22 `Idx(r, c, dim) = r + c*dim`), and the
HEIGHTMAP is `JobA.Idx(y, x, hDim)` = `y + x*hDim` (TerrainSampler
.cs:123; DefaultTerrainSampler.cs:77-78 takes x from `Col` and y from
`Row`) - which is what `terrainSampler.js:139` writes and what every
consumer in this tree reads. The mod reads its tile at `Idx(x, y, tDim)`
and its corner base at `Idx(y, x, hDim)`: each index in the layout that
owns it. The port reads the tile at `y*tDim + x` and the base at
`x*hDim + y` - the same two expressions. Byte for byte his.

This section first said the mod's SAMPLE base was "the transpose" and
the port corrected it on the tile read. AUDIT 58 (f2/hosts, 2026-09-03)
then found the PORT's base was `y*hDim + x` - every road bed unsmoothed
and a mirrored east-west strip of open ground blurred, in both lanes -
fixed it to `x*hDim + y`, and kept the story: "the mod's transpose is on
the sample base, and the port corrects it there". It does not and it
never did - `Idx(y, x, hDim)` IS `x*hDim + y`. AUDIT 58's fix made the
port EQUAL to the mod; the divergence it recorded as corrected was a
false entry in the departure record, entrenched by a pin on the
comment's own text (`roadsParity.test.js`). The comment, both bible
pages and the pin now say what the code does: nothing to correct.

**The rect's edge (MODS AUDIT).** His skip is `locationRect.Contains(new
Vector2(x, y))` - Unity's Rect.Contains, min-inclusive and MAX-EXCLUSIVE.
Ours was `x < xMax + 1`: the column `x == xMax` and the row `y == yMax`
were smoothed by the mod and skipped here, one tile column and one tile
row per location. Now `x < rect.xMax`, as the painter's ring test in the
same file always was; pinned at the boundary.

## Cleared

- **Data:** the four vendored arrays are byte-identical to the ones
  extracted from the shipped .dfmod - and, since the MODS AUDIT of
  2026-09-08, to `ajrb/dfunity-mods` master by sha256, PINNED in
  `test/vendorIntegrity.test.js` (this bullet used to say "recorded in
  the test run"; no test carried a hash).
- **Paint order:** roads, rivers-with-joins, streams, tracks; the first
  to paint a tile wins; a non-zero tile stops every painter. Oracle-
  covered.
- **Corner byte:** `(east & 0x5) | (west & 0x50)`. His InRange guard is
  `index > 0 && index < size` - at x = 999 his east neighbour is the
  next row's x = 0, a wrap, and at x = 0 his west neighbour is the
  previous row's x = 999, the same wrap the other way; at the last
  pixel (999, 499) `pathsData[index + 1]` is index 500,000 on a
  500,000-byte array, out of bounds. Ours clamps by x on both sides
  (`roadPainter.js` pathCorners). Recorded, not replicated: a wrap is
  not a design either (the x = 0 side and the overrun added by the
  MODS AUDIT; this bullet had only the x = 999 wrap).
- **Settings:** SmoothRoads on, RiversAndStreams off, as shipped.
- **Tile orientation:** row 0 south; `x = index % 128`; his `JobA.Col`.

## Standing

The terrain painter is the mod's to the byte on every case the oracle
holds - 907 since the MODS AUDIT of 2026-09-08, which found the oracle
and the port sharing one omission: `PaintPathWithSubPathJoins` carried
the corner join and four of the mod's seventy-six centre-join
statements, so the 48 river-and-stream cases passed against a
truncated mod. The other seventy-two are ported into both, generated
from the C# by one script, and 256 river-by-stream cases reach every
arm (`bible/03-World/Roads.md`, MODS AUDIT). The four arrays are his to
the byte, by hash. The smoother is his, with no divergence. What is not
1:1 and never was in scope: the travel-map overlay is drawn in our
colours through our map, and the two switches live in code rather than
Settings. Rivers and streams are off, as shipped.
