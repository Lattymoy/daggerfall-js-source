// Rendering's last queue row: the spectral pipeline verbatim
// (TextureReader SetSpectral + GetSpectralEmissionColors32).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BaseImageFile } from '../src/formats/baseImageFile.js';
import { TextureFile } from '../src/formats/textureFile.js';

test('spectral: constants + the gray remap verbatim', () => {
  assert.equal(BaseImageFile.SPECTRAL_EYES_RESERVED, 14);
  assert.equal(BaseImageFile.SPECTRAL_EYES_PATCHED, 247);
  assert.equal(BaseImageFile.SPECTRAL_GRAY_START, 96);
  assert.equal(BaseImageFile.SPECTRAL_ALPHA, 180);
  assert.ok(TextureFile.isSpectralArchive(273) && TextureFile.isSpectralArchive(278) && TextureFile.isSpectralArchive(473));
  assert.ok(!TextureFile.isSpectralArchive(255));
  const f = new BaseImageFile();
  const bmp = { width: 4, height: 1, data: new Uint8Array([0, 14, 30, 90]) };
  f.setSpectral(bmp);
  assert.deepEqual([...bmp.data], [0, 247, 96 - 30, 96 - 90]);   // 0 kept, eyes patched, grays reindexed
});

test('spectral: the V^1.9 emission lerp + red eyes, same flip walk', () => {
  const f = new BaseImageFile();
  // 2x1 bitmap: eye texel + a mid-gray texel
  const bmp = { width: 2, height: 1, data: new Uint8Array([247, 5]) };
  // albedo hand-built (no palette needed): eye white-ish, body mid gray 128
  const albedo = { colors: new Uint8ClampedArray([250, 250, 250, 255, 128, 128, 128, 180]), width: 2, height: 1 };
  const em = f.getSpectralEmissionColors32(bmp, albedo, 0, 247, [255, 0, 0], [0, 0, 0]);
  // eye -> pure red, opaque
  assert.deepEqual([...em.colors.slice(0, 4)], [255, 0, 0, 255]);
  // body: V = 128/255; t = V^1.9; channel = round(0 + 128*t)
  const t = Math.pow(128 / 255, 1.9);
  const expect = Math.round(128 * t);
  assert.deepEqual([...em.colors.slice(4, 8)], [expect, expect, expect, 255]);
  assert.ok(expect > 0 && expect < 128);   // lerped toward black, not clamped out
});
