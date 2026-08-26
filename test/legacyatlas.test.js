import { test } from 'node:test';
import assert from 'node:assert/strict';
import { repackLegacySkinAtlas } from '../src/tools/paperdoll/legacyAtlas.js';

function image(w, h) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    const v = x + y * 10;
    data[i] = v; data[i + 1] = v; data[i + 2] = v; data[i + 3] = 255;
  }
  return { width: w, height: h, data };
}

test('legacy skin assets repack into isolated body tiles without the local baker', () => {
  // One body quad at the left of a 10x10 legacy atlas and one wrapped head quad
  // in the 2x2 cell at x=8. This is deliberately the old layout shape: no
  // body.mode and UVs that point straight into the committed texture.
  const uv = {
    n: 2, w: 10, h: 10,
    uv: [
      0.05,0.95, 0.65,0.95, 0.65,0.35, 0.05,0.35,
      0.80,0.20, 1.00,0.20, 1.00,0.00, 0.80,0.00,
    ],
  };
  const lay = {
    body: { x: 0, y: 0, w: 7, h: 7 },
    head: { x: 8, y: 8, w: 2, h: 2, faceArc: [0.25, 0.75] },
  };
  const groups = [0, 1];
  const src = image(10, 10);
  const r = repackLegacySkinAtlas(uv, lay, src, null, groups);

  assert.ok(r);
  assert.equal(r.lay.body.mode, 'face-atlas');
  assert.equal(r.lay.body.tile, 8);
  assert.equal(r.lay.body.pad, 1);
  assert.equal(r.lay.body.faceCount, 1);
  assert.equal(r.lay.body.profile, 'legacy-runtime-repack');
  assert.equal(r.human.width, 10 + 8 + 2); // one 10px tile + head gap + head
  assert.ok(r.human.height >= 18);
  assert.equal(r.uv.w, r.human.width);
  assert.equal(r.uv.h, r.human.height);
  assert.equal(r.uv.uv.length, 16);

  // Body UVs now land inside its isolated 8x8 useful texels, not the old atlas.
  for (let i = 0; i < 8; i += 2) {
    assert.ok(r.uv.uv[i] > 0 && r.uv.uv[i] < 0.5);
    assert.ok(r.uv.uv[i + 1] > 0 && r.uv.uv[i + 1] < 1);
  }

  // The head's cell moved as a unit and kept its runtime face-arc contract.
  assert.deepEqual(r.lay.head.faceArc, [0.25, 0.75]);
  assert.ok(r.lay.head.x > r.lay.body.w);
});
