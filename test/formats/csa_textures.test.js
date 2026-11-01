// THE TILED PICTURE COME SAIL AWAY'S BREAKERS ARE COMPOSED BY: composeTiledPicture and its derive
// (formats/derivedTexture.js), over pictures made here. OWN-WORK4: the mod's own pictures are retired - ours are painted (systems/comeSailAway/csaPictures.js, pinned by
// test/systems/comeSailAway/csa_own_assets.test.js), and the extractor's block search and indexed PNG went with them.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { composeTiledPicture, deriveTiledPaint } from '../../src/formats/derivedTexture.js';

/** The waves' key colour, rrggbbaa (a crest's texel). */
const WAVE_KEY = 'ff00ffff';

test('CSA-A: composeTiledPicture puts the record under the key, scrolled and phased - the tool\'s own derive run backwards (mutants: the scroll\'s sign, the phase)', () => {
  const src = { width: 4, height: 4, data: new Uint8Array(64) };
  for (let i = 0; i < 16; i++) src.data.set([i * 10, 100, 200, 255], i * 4);
  const pic = { width: 8, height: 8, data: new Uint8Array(256) };
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const i = (y * 8 + x) * 4;
      if ((x + y) % 3 === 0) pic.data.set([1, 2, 3, 255], i);           // the author's pixel
      else if ((x + y) % 3 === 1) pic.data.set(src.data.subarray((((y + 1) % 4) * 4 + (x + 2) % 4) * 4, (((y + 1) % 4) * 4 + (x + 2) % 4) * 4 + 3), i), pic.data[i + 3] = 255;
      // else clear
    }
  }
  const d = deriveTiledPaint(pic, src, [2, 1], WAVE_KEY);
  assert.ok(d.fromRecord > 0 && d.own > 0 && d.clear > 0);
  const back = composeTiledPicture({ size: [8, 8], tile: [2, 1], key: WAVE_KEY }, src, d.paint);
  assert.deepEqual(back.data, pic.data);
  // scrolled: the frame's row y is the paint's row (y + n) mod h, and the phase moves with it
  const scrolled = composeTiledPicture({ size: [8, 8], tile: [2, (1 + 3) % 4], key: WAVE_KEY, scroll: 3 }, src, d.paint);
  for (let y = 0; y < 8; y++) assert.deepEqual(scrolled.data.subarray(y * 32, y * 32 + 32), pic.data.subarray(((y + 3) % 8) * 32, ((y + 3) % 8) * 32 + 32), `row ${y}`);
  const keyed = { width: 1, height: 1, data: new Uint8Array([0xff, 0, 0xff, 0xff]) };
  assert.throws(() => deriveTiledPaint(keyed, src, [0, 0], WAVE_KEY), /holds the key colour/);
  // a key pixel comes back OPAQUE whatever alpha the key colour carries
  const half = '0102037f';
  const dh = deriveTiledPaint(pic, src, [2, 1], half);
  assert.deepEqual(composeTiledPicture({ size: [8, 8], tile: [2, 1], key: half }, src, dh.paint).data, pic.data);
});
