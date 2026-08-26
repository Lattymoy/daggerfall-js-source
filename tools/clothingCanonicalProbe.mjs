import assert from 'node:assert/strict';
import {
  canonicalizePaperdollTexture,
  generateDirectionalViews,
} from '../src/tools/paperdoll/clothingTexture.js';

// Synthetic Daggerfall-like paperdoll source:
// - every row shears right as Y increases
// - the centre carries a front-only red detail
// - transparent holes emulate body-reveal cut-outs in the old paperdoll art
const width = 20, height = 12;
const data = new Uint8ClampedArray(width * height * 4);
for (let y = 0; y < height; y++) {
  const shift = Math.floor(y / 3);
  const x0 = 2 + shift, x1 = 15 + shift;
  for (let x = x0; x <= x1 && x < width; x++) {
    const o = (y * width + x) * 4;
    const u = (x - x0) / Math.max(1, x1 - x0);
    if (u > 0.44 && u < 0.56) { data[o] = 230; data[o + 1] = 30; data[o + 2] = 30; }
    else if (u < 0.5) { data[o] = 40; data[o + 1] = 90; data[o + 2] = 190; }
    else { data[o] = 55; data[o + 1] = 145; data[o + 2] = 85; }
    data[o + 3] = 255;
  }
}
// Interior and boundary-connected paperdoll holes. A 3D surface must not inherit either.
for (const [x, y] of [[9,4],[10,4],[9,5],[10,5],[4,0],[5,0],[6,0],[6,1]]) {
  const o = (y * width + x) * 4;
  data[o] = data[o + 1] = data[o + 2] = data[o + 3] = 0;
}

const canonical = canonicalizePaperdollTexture({ width, height, data });
assert.equal(canonical.width, width);
assert.equal(canonical.height, height);
assert.equal(canonical.canonicalMeta.mode, 'paperdoll-surface-v1');
assert.equal(canonical.canonicalMeta.alphaOwner, 'geometry');
assert.ok(canonical.canonicalMeta.repairedPixels > 0, 'paperdoll holes must be repaired');
for (let o = 3; o < canonical.data.length; o += 4) {
  assert.equal(canonical.data[o], 255, 'canonical garment material must be opaque');
}

// Row unwrapping must remove the source's rightward shear: the same normalized
// left-edge sample should stay materially stable from top to bottom.
const rgb = (img, x, y) => {
  const o = (y * img.width + x) * 4;
  return [img.data[o], img.data[o + 1], img.data[o + 2]];
};
assert.deepEqual(rgb(canonical, 1, 1), rgb(canonical, 1, 10));

const views = generateDirectionalViews(canonical);
assert.equal(views.length, 8);
for (const view of views) {
  assert.equal(view.width, width);
  assert.equal(view.height, height);
  for (let o = 3; o < view.data.length; o += 4) assert.equal(view.data[o], 255);
}

// The generated back is sourced from side bands, not the centre-front detail.
const frontMid = rgb(views[0], Math.floor(width / 2), 6);
const backMid = rgb(views[4], Math.floor(width / 2), 6);
assert.notDeepEqual(backMid, frontMid, 'front-only detail must not stamp onto the back');

console.log('clothing canonical probe: PASS');
