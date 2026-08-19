import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { SkyFile, SKY_FRAME_WIDTH, SKY_FRAME_HEIGHT } from '../src/formats/skyFile.js';
import {
  buildDaySkyPanorama,
  buildNightSkyPanorama,
  nightSkyIndexForSky,
  nightSkyImageName,
  SKY_ANGLE_PER_PIXEL,
} from '../src/render/skyRenderer.js';

const ARENA2 = process.env.ARENA2_PATH;
const skipReal = !ARENA2 || !existsSync(ARENA2)
  ? 'ARENA2_PATH not set or missing - real-data validation skipped'
  : false;

// ---------------------------------------------------------------------------
// Synthetic - always run.
// ---------------------------------------------------------------------------

test('sky: night mapping and panorama duplication', () => {
  // Verbatim LoadVanillaNightSky sky-group mapping.
  assert.equal(nightSkyIndexForSky(0), 3);
  assert.equal(nightSkyIndexForSky(7), 3);
  assert.equal(nightSkyIndexForSky(8), 1);
  assert.equal(nightSkyIndexForSky(16), 2);
  assert.equal(nightSkyIndexForSky(24), 0);
  assert.equal(nightSkyIndexForSky(31), 0);
  assert.equal(nightSkyImageName(16), 'NITE02I0.IMG');
  assert.equal(SkyFile.indexToFileName(16), 'SKY16.DAT');
  assert.equal(SkyFile.indexToFileName(3), 'SKY03.DAT');
  assert.ok(Math.abs(SKY_ANGLE_PER_PIXEL - Math.PI / 512) < 1e-12);

  // 2x2 night image duplicates across both halves. clearColor is DFU's
  // west[0] = element 0 of the bottom-up array = the HORIZON row; the
  // zenith texel is the above-strip fillColor. The last column is the
  // seam fix (LoadVanillaNightSky:605-610), so it repeats column w - 2.
  const colors = new Uint8ClampedArray([
    1, 2, 3, 255, 4, 5, 6, 255, // bottom row (DFU element 0 lives here)
    7, 8, 9, 255, 10, 11, 12, 255, // top row
  ]);
  const pano = buildNightSkyPanorama({ colors, width: 2, height: 2 });
  assert.equal(pano.width, 4);
  assert.equal(pano.height, 2);
  assert.deepEqual(Array.from(pano.colors.slice(0, 8)), [1, 2, 3, 255, 1, 2, 3, 255]);
  assert.deepEqual(Array.from(pano.colors.slice(8, 16)), [1, 2, 3, 255, 1, 2, 3, 255]);
  assert.deepEqual(pano.clearColor, [1 / 255, 2 / 255, 3 / 255]);
  assert.deepEqual(pano.fillColor, [7 / 255, 8 / 255, 9 / 255]);
});

// ---------------------------------------------------------------------------
// Real ARENA2 data.
// ---------------------------------------------------------------------------

test('sky: SKY16 reader pinned and all 32 files load', { skip: skipReal }, () => {
  const s = new SkyFile();
  assert.equal(s.load(new Uint8Array(readFileSync(join(ARENA2, 'SKY16.DAT'))), 'SKY16.DAT'), true);
  assert.equal(s.recordCount, 2);
  assert.equal(s.getFrameCount(0), 32);
  assert.deepEqual(s.getSize(1), { width: SKY_FRAME_WIDTH, height: SKY_FRAME_HEIGHT });

  const sum = (rec, fr) => {
    const b = s.getDFBitmap(rec, fr);
    assert.equal(b.data.length, 512 * 220);
    let t = 0;
    for (const v of b.data) t += v;
    return t;
  };
  // Pinned index sums per record/frame from the original data.
  assert.equal(sum(0, 0), 2148364); // east dawn
  assert.equal(sum(1, 0), 2148333); // west dawn
  assert.equal(sum(0, 31), 2025865); // east noon
  assert.equal(sum(1, 31), 2020187); // west noon

  // Per-frame palettes: noon west pixel 0 resolves to pale cyan.
  const west31 = s.getColor32(1, 31);
  assert.deepEqual(Array.from(west31.colors.slice(0, 3)), [229, 255, 255]);

  // Every shipped SKY file loads and yields full frames.
  const files = readdirSync(ARENA2).filter((f) => /^SKY\d\d\.DAT$/.test(f));
  assert.equal(files.length, 32);
  for (const f of files) {
    const t = new SkyFile();
    assert.equal(t.load(new Uint8Array(readFileSync(join(ARENA2, f))), f), true, f);
    assert.equal(t.getDFBitmap(1, 31).data.length, 512 * 220, f);
  }
});

test('sky: afternoon panorama is the mirror of its morning frame', { skip: skipReal }, () => {
  const s = new SkyFile();
  s.load(new Uint8Array(readFileSync(join(ARENA2, 'SKY16.DAT'))), 'SKY16.DAT');

  // Frame 57 targets 63 - 57 = 6 mirrored: [mirror(west6) | mirror(east6)]
  // is exactly the horizontal mirror of morning [east6 | west6].
  const morning = buildDaySkyPanorama(s, 6);
  const evening = buildDaySkyPanorama(s, 57);
  assert.equal(morning.width, 1024);
  assert.equal(evening.width, 1024);
  const w = morning.width;
  for (const y of [0, 100, 219]) {
    for (const x of [0, 1, 511, 512, 700, 1023]) {
      const a = (y * w + x) * 4;
      const b = (y * w + (w - 1 - x)) * 4;
      assert.equal(evening.colors[a], morning.colors[b], `mirror ${x},${y}`);
      assert.equal(evening.colors[a + 1], morning.colors[b + 1]);
      assert.equal(evening.colors[a + 2], morning.colors[b + 2]);
    }
  }

  // clearColor is verbatim west element 0 (the horizon row); fillColor is
  // the zenith texel our cylinder paints above the strip.
  const west6 = s.getColor32(1, 6);
  assert.deepEqual(morning.clearColor, [
    west6.colors[0] / 255,
    west6.colors[1] / 255,
    west6.colors[2] / 255,
  ]);
  const top = (west6.height - 1) * west6.width * 4;
  assert.deepEqual(morning.fillColor, [
    west6.colors[top] / 255,
    west6.colors[top + 1] / 255,
    west6.colors[top + 2] / 255,
  ]);
});
