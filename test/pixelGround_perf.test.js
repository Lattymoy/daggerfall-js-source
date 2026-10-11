import test from 'node:test';
import assert from 'node:assert/strict';
import { drawPixelGround } from '../src/ui/pixelGround.js';

test('pixelGround: draws into canvas without allocating new context or image buffer repeatedly', () => {
  let createdCount = 0;
  let putCount = 0;
  const fakeContext = {
    createImageData(w, h) {
      createdCount++;
      return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) };
    },
    putImageData() {
      putCount++;
    },
  };

  const canvas = {
    width: 0,
    height: 0,
    getContext() {
      return fakeContext;
    },
  };

  // First draw: should initialize
  drawPixelGround(canvas, 640, 360, 0);
  assert.ok(canvas.width > 0);
  assert.ok(canvas.height > 0);
  assert.equal(createdCount, 1);
  assert.equal(putCount, 1);

  // Second draw: same size, should reuse cached ImageData and NOT recreate
  drawPixelGround(canvas, 640, 360, 1.0);
  assert.equal(createdCount, 1, 'ImageData must be reused when canvas size is unchanged');
  assert.equal(putCount, 2);

  // Resize draw: should allocate only once on size change
  drawPixelGround(canvas, 800, 600, 2.0);
  assert.equal(createdCount, 2, 'ImageData reallocated only on viewport change');
  assert.equal(putCount, 3);
});
