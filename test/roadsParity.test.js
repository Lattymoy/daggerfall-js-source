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
// place in scan order. And the one recorded divergence: the mod reads
// the tile transposed (x as the row), so a N-S road there smooths an
// E-W strip; here the tile is read at y*tDim + x.
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
  const idx = 10 * H + 63;
  const mean5 = (arr, i) => (arr[i] + arr[i + H] + arr[i + 1] + arr[i - H] + arr[i - 1]) / 5;
  const expect = Float32Array.from(before);
  for (const k of [idx, idx + 1, idx + H, idx + H + 1]) expect[k] = mean5(expect, k);
  for (const k of [idx, idx + 1, idx + H, idx + H + 1]) assert.ok(Math.abs(samples[k] - expect[k]) < 1e-5, `corner ${k} is the in-place five-point mean`);
  assert.equal(samples[20 * H + 63], before[20 * H + 63], 'the edge tile\u2019s corner is untouched');
  assert.equal(samples[30 * H + 63], before[30 * H + 63], 'the track tile\u2019s corner is untouched');
  // the rect is skipped, as his locationRect.Contains skips it
  const s2 = Float32Array.from(before); const t2 = new Uint8Array(128 * 128); t2[64 * 128 + 64] = 46;
  assert.equal(smoothRoadHeights(s2, t2, H, { xMin: 60, xMax: 70, yMin: 60, yMax: 70 }), 0, 'a road tile inside the rect is not smoothed');
  // the divergence, on record: our tile read is y*tDim + x, not the transpose
  const src = readFileSync(new URL('../src/world/roadPainter.js', import.meta.url), 'utf8');
  assert.match(src, /const tile = tilemap\[y \* tDim \+ x\];/, 'the tile is read at y*tDim + x - the mod\u2019s Idx(x, y, tDim) is a transpose, recorded as such');
});
