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

**One deliberate divergence, recorded - and AUDIT 54 (f2/hosts,
2026-09-03) moved it onto the index it was always about.** The kernel
joins TWO layouts and they differ, both of them DFU's: the TILEMAP is
`JobA.Idx(x, y, tDim)` = `x + y*tDim` (TerrainHelper.cs:170, with
JobHelpers.cs:19-22 `Idx(r, c, dim) = r + c*dim`), and the HEIGHTMAP is
`JobA.Idx(y, x, hDim)` = `y + x*hDim` (TerrainSampler.cs:123;
DefaultTerrainSampler.cs:77-78 takes x from `Col` and y from `Row`) -
which is what `terrainSampler.js:139` writes and what every consumer in
this tree reads. The mod walks the heightmap with x from `Row`, so its
SAMPLE BASE is the transpose; its tile read is its own painter's layout
and needs nothing. In the mod a north-south road smooths an east-west
strip.

This paragraph used to say the correction was on the TILE read, where
`y*tDim + x` **is** his `Idx(x, y, tDim)` - the same expression, so the
correction was a no-op - while the transpose it named sat live on the
height write. Roads are ALWAYS ON in both lanes, so for three audits
every road bed went unsmoothed and a mirrored strip of open ground was
blurred instead. Both pins were blind because both computed their
expected corners from the smoother's own base. Ours now reads the tile
at `y*tDim + x` (unchanged) and the corner base at `x*hDim + y`, and
`test/roadsParity.test.js` asks the question in world terms instead: a
north-south road must move a north-south bed.

## Cleared

- **Data:** the four vendored arrays are byte-identical to the ones
  extracted from the shipped .dfmod (sha256 recorded in the test run).
- **Paint order:** roads, rivers-with-joins, streams, tracks; the first
  to paint a tile wins; a non-zero tile stops every painter. Oracle-
  covered.
- **Corner byte:** `(east & 0x5) | (west & 0x50)`. His InRange guard is
  `index > 0 && index < size` - at x = 999 his east neighbour is the
  next row's x = 0, a wrap; ours clamps by x. Recorded, not replicated:
  a wrap is not a design either.
- **Settings:** SmoothRoads on, RiversAndStreams off, as shipped.
- **Tile orientation:** row 0 south; `x = index % 128`; his `JobA.Col`.

## Standing

The terrain painter is the mod's to the byte on every case the oracle
holds. The four arrays are his to the byte. The smoother is his but for
a corrected transpose. What is not 1:1 and never was in scope: the
travel-map overlay is drawn in our colours through our map, and the two
switches live in code rather than Settings. Rivers and streams are off,
as shipped.
