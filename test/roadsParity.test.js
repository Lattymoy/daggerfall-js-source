// AUDIT 51: 1:1 PARITY WITH BASIC ROADS, BY ORACLE. tools/roadsOracle.py
// is PaintPath transliterated from the mod's C# line for line; its
// fixture holds the tilemap the MOD paints for 651 cases - every road
// mask, every track mask, every corner byte, random rivers with
// streams, mixed pixels, and location rects. Our painter runs the same
// cases and must match BYTE FOR BYTE. A difference is a parity bug by
// definition, and the message names the first tile that differs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { paintRoads, TILE } from '../src/world/roadPainter.js';

const oracle = JSON.parse(readFileSync(new URL('./fixtures/roads-oracle.json', import.meta.url), 'utf8'));

function quadrants() {
  const td = new Uint8Array(129 * 129);
  for (let y = 0; y < 129; y++) for (let x = 0; x < 129; x++) td[y * 129 + x] = y < 64 ? (x < 64 ? TILE.dirt : TILE.grass) : (x < 64 ? TILE.stone : TILE.water);
  return td;
}
const expand = (rle) => { const out = new Uint8Array(128 * 128); let i = 0; for (const [v, n] of rle) { out.fill(v, i, i + n); i += n; } return out; };

test('AUDIT 51: our painter matches the mod\u2019s PaintPath byte for byte over 651 cases', () => {
  let checked = 0; const diffs = [];
  for (const { case: c, tilemap: rle } of oracle.cases) {
    const want = expand(rle);
    const got = new Uint8Array(128 * 128);
    const rect = c.rect ? { xMin: c.rect[0], xMax: c.rect[1], yMin: c.rect[2], yMax: c.rect[3] } : null;
    paintRoads(quadrants(), got, c.road ?? 0, c.track ?? 0, rect, 129, {
      river: c.river ?? 0, stream: c.stream ?? 0, water: !!c.water,
      corners: { road: c.roadCorners ?? 0, track: c.trackCorners ?? 0, river: c.riverCorners ?? 0, stream: c.streamCorners ?? 0 },
    });
    for (let i = 0; i < want.length; i++) {
      if (want[i] !== got[i]) { diffs.push(`${JSON.stringify(c)} at (${i % 128},${(i / 128) | 0}): mod ${want[i]}, ours ${got[i]}`); break; }
    }
    checked++;
  }
  assert.equal(checked, 651);
  assert.deepEqual(diffs.slice(0, 12), [], `${diffs.length} of 651 cases differ from the mod`);
});

// AUDIT 51: THE SMOOTHER IS THE MOD'S - SmoothRoadsJob, ported. Road and
// water_temp tiles only, the tile's four corners, a five-point mean in
// place in scan order. And the one recorded divergence, put back on the
// index it is actually about by AUDIT 58 (f2/hosts): the TILEMAP is
// x + y*tDim (JobA.Idx(x, y, tDim), TerrainHelper.cs:170) and the
// HEIGHTMAP is y + x*hDim (JobA.Idx(y, x, hDim), TerrainSampler.cs:123
// - what terrainSampler.js:139 writes). The mod's sample base is the
// transpose of the second; his tile read needed nothing. This pin used
// to compute its expected corners from `10 * H + 63` - the smoother's
// own wrong base - so it could not see the defect it was written for.
test('AUDIT 51: the smoother is SmoothRoadsJob - road and water only, four corners, five-point mean, in place', async () => {
  const { smoothRoadHeights, SMOOTHED_TILES } = await import('../src/world/roadPainter.js');
  assert.deepEqual([...SMOOTHED_TILES].sort((a, b) => a - b), [46, 0xff], 'road and water_temp, as his `tile == road || tile == water_temp`');
  const H = 129;
  const samples = new Float32Array(H * H); for (let i = 0; i < samples.length; i++) samples[i] = (i % 2) ? 50 : 30;
  const tilemap = new Uint8Array(128 * 128);
  tilemap[10 * 128 + 63] = 46;        // one road tile at (63,10)
  tilemap[20 * 128 + 63] = 47 + 64;   // an EDGE tile: the mod does not smooth it
  tilemap[30 * 128 + 63] = 11;        // a TRACK tile: nor this
  const before = Float32Array.from(samples);
  const n = smoothRoadHeights(samples, tilemap);
  assert.equal(n, 4, 'exactly the road tile\u2019s four corners');
  // his order: idx, idx+1, idx+hDim, idx+hDim+1, each a five-point mean
  // of the CURRENT array - the second corner reads the first's result.
  const idx = 63 * H + 10;   // the SAMPLER's layout: sample(x=63, y=10) = s[x * H + y]
  const mean5 = (arr, i) => (arr[i] + arr[i + H] + arr[i + 1] + arr[i - H] + arr[i - 1]) / 5;
  const expect = Float32Array.from(before);
  for (const k of [idx, idx + 1, idx + H, idx + H + 1]) expect[k] = mean5(expect, k);
  for (const k of [idx, idx + 1, idx + H, idx + H + 1]) assert.ok(Math.abs(samples[k] - expect[k]) < 1e-5, `corner ${k} is the in-place five-point mean`);
  assert.equal(samples[63 * H + 20], before[63 * H + 20], 'the edge tile\u2019s corner is untouched');
  assert.equal(samples[63 * H + 30], before[63 * H + 30], 'the track tile\u2019s corner is untouched');
  // the rect is skipped, as his locationRect.Contains skips it
  const s2 = Float32Array.from(before); const t2 = new Uint8Array(128 * 128); t2[64 * 128 + 64] = 46;
  assert.equal(smoothRoadHeights(s2, t2, H, { xMin: 60, xMax: 70, yMin: 60, yMax: 70 }), 0, 'a road tile inside the rect is not smoothed');
  // the divergence, on record and now on the RIGHT index: the tile read
  // stays the painter's (y*tDim + x, which IS his Idx(x, y, tDim)) and
  // the corner base is the sampler's (x*hDim + y = Idx(y, x, hDim)).
  const src = readFileSync(new URL('../src/world/roadPainter.js', import.meta.url), 'utf8');
  assert.match(src, /const tile = tilemap\[y \* tDim \+ x\];/, 'the tile is read at y*tDim + x - the painter\u2019s own layout, unchanged');
  assert.match(src, /const idx = x \* hDim \+ y;/, 'and the corner base is the HEIGHTMAP\u2019s - TerrainSampler.cs:123');
});

// AUDIT 58 (f2/hosts): THE DIRECTIONAL PIN neither older test could
// make. Both computed their expected corners from the smoother's own
// base, so a transposed write agreed with itself and stayed green for
// three audits. This one asks the question in WORLD terms instead:
// paint a north-south road and read the samples back through the
// SAMPLER's own layout (terrainSampler.js:139, sample(x, y) =
// s[x * hDim + y]). A N-S road lies down tile columns 63/64, so what
// moves must be sample-x 62..66 spanning the road's length in y - and
// nothing at sample-y 62..66. Under the transposed base it is exactly
// the other way round: the bed is untouched and a mirrored E-W strip
// of open ground is blurred.
test('AUDIT 58: a NORTH-SOUTH road smooths a north-south bed - the corner base is the heightmap\u2019s, not the tilemap\u2019s', async () => {
  const { smoothRoadHeights, paintRoads, TILE: T } = await import('../src/world/roadPainter.js');
  const { DIR } = await import('../src/world/roadNetwork.js');
  const H = 129, TD = 128;
  const samples = new Float32Array(H * H); for (let i = 0; i < samples.length; i++) samples[i] = (i % 2) ? 50 : 30;
  const before = Float32Array.from(samples);
  const tilemap = new Uint8Array(TD * TD);
  paintRoads(new Uint8Array(H * H).fill(T.grass), tilemap, DIR.N | DIR.S, 0);   // the road runs down tile columns 63/64
  assert.equal(tilemap[10 * TD + 63] & 0x3f, T.road, 'the painter put road at tile (x=63, y=10) - tile index x + y*tDim');
  assert.ok(smoothRoadHeights(samples, tilemap) > 0);
  // sample(x, y) = s[x * H + y] - the sampler's layout, read here and
  // nowhere near the smoother's own arithmetic.
  const sample = (a, x, y) => a[x * H + y];
  let xs = [Infinity, -Infinity], ys = [Infinity, -Infinity], moved = 0;
  for (let x = 0; x < H; x++) for (let y = 0; y < H; y++) {
    if (sample(samples, x, y) === sample(before, x, y)) continue;
    moved++;
    xs = [Math.min(xs[0], x), Math.max(xs[1], x)];
    ys = [Math.min(ys[0], y), Math.max(ys[1], y)];
  }
  assert.ok(moved > 100, `the road bed moved (${moved} samples)`);
  // Only tile column 63 carries the bare 46: column 64's byte is 46|FLIP
  // (174), and the tile test is on the RAW byte, as his is - so the bed
  // that moves is that one tile's two corner columns, 63 and 64.
  assert.deepEqual(xs, [63, 64], 'ACROSS the road: sample-x is the road tile\u2019s own two corner columns');
  assert.ok(ys[1] - ys[0] > 100, `ALONG the road: sample-y spans its length (${ys[0]}..${ys[1]})`);
  // and the mirror is untouched - the exact strip the transposed base blurred
  for (let x = 0; x < 50; x++) for (let y = 62; y <= 66; y++) {
    assert.equal(sample(samples, x, y), sample(before, x, y), `the mirrored E-W strip at sample (${x},${y}) must not move`);
  }
});
