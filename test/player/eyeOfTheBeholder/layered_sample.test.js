// A held picture's sampling (layeredWeapon.js samplePicture) and the px it may skip (footprintEmpty): a px whose
// footprint holds no opaque texel is skipped, and only such a px - sampling it whole would have answered null.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { samplePicture, footprintEmpty, offsetsOf } from '../../../src/player/eyeOfTheBeholder/layeredWeapon.js';

let seed = 7;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);

/** A picture of `w` x `h`, a thin bar of opaque texels across it and a few strays; the rest clear. */
function picture(w, h, strays = 4) {
  const colors = new Uint8Array(w * h * 4);
  for (let x = 0; x < w; x++) for (const y of [Math.floor(h / 2), Math.floor(h / 2) + 1]) colors.set([200, 40, 20, 255], (y * w + x) * 4);
  for (let k = 0; k < strays; k++) colors.set([20, 200, 40, 128 + Math.floor(rnd() * 127)], (Math.floor(rnd() * w * h)) * 4);
  colors.set([9, 9, 9, 127], 0);   // at the threshold: clear to the sampler
  return { width: w, height: h, colors };
}
/** An affine map from the screen to the picture, as drawPicture's: the line's grip, its along and across. */
function affine() {
  const a = rnd() * Math.PI * 2, along = 0.2 + rnd() * 2, across = 0.4 + rnd() * 2, qx = rnd() * 40, qy = rnd() * 40;
  const ux = Math.cos(a), uy = Math.sin(a), gx = rnd() * 10, gy = 4 + rnd() * 2;
  return (x, y, o) => {
    const ex = x - qx, ey = y - qy, s = (ex * ux + ey * uy) / along, v = (ex * -uy + ey * ux) / across;
    o[0] = gx + s; o[1] = gy + v;
  };
}

test('a px is skipped only where sampling it whole answers null; most of a thin picture\'s box is skipped (mutants: the widening dropped; the threshold 127 read as opaque; the corners not rounded out)', () => {
  let skipped = 0, sampled = 0;
  for (let round = 0; round < 40; round++) {
    const img = picture(30 + Math.floor(rnd() * 40), 9 + Math.floor(rnd() * 8)), at = affine();
    for (const spread of [0.25, 0.3]) {
      const offs = offsetsOf(spread), n = 3 + Math.floor(rnd() * 10);
      for (let y = 0; y < 48; y++) for (let x = 0; x < 48; x++) {
        const c = samplePicture(img, x, y, n, at, offs);
        if (footprintEmpty(img, x, y, at, spread)) { skipped++; assert.equal(c, null, `px ${x},${y} skipped but sampled ${c}`); }
        else sampled++;
      }
    }
  }
  assert.ok(skipped > sampled, `the open air is most of it: ${skipped} skipped, ${sampled} sampled`);
});

test('the footprint is widened by the spread: a gap narrower than it, opaque both sides, is sampled, and holds its colour; a texel at 127 is clear', () => {
  const W = 61, H = 4, colors = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (x < 20 || x > 40) colors.set([90, 60, 30, 255], (y * W + x) * 4);
  const img = { width: W, height: H, colors }, at = (x, y, o) => { o[0] = 20 * x; o[1] = y; };   // a picture px a twentieth of a screen px
  assert.equal(footprintEmpty(img, 1, 1, at, 0.25), false, 'the offsets reach past the gap');
  assert.deepEqual([...samplePicture(img, 1, 1, 12, at, offsetsOf(0.25))], [90, 60, 30], 'half the samples hit, either side');
  const faint = { width: 8, height: 4, colors: new Uint8Array(8 * 4 * 4) };
  faint.colors.set([1, 2, 3, 127], (2 * 8 + 3) * 4);
  assert.equal(footprintEmpty(faint, 3, 2, (x, y, o) => { o[0] = x; o[1] = y; }, 0.25), true, 'alpha 127 is no hit');
});

test('a map off to infinity is sampled as ever, never skipped', () => {
  const img = picture(20, 9);
  assert.equal(footprintEmpty(img, 3, 3, (x, y, o) => { o[0] = Infinity; o[1] = y; }, 0.25), false);
  assert.equal(footprintEmpty(img, 3, 3, (x, y, o) => { o[0] = NaN; o[1] = y; }, 0.25), false);
});

test('the colour answered is the mean of the hits, a third of the samples at least; the samples read in order across', () => {
  const img = picture(10, 4, 0), at = (x, y, o) => { o[0] = x; o[1] = y; };
  assert.deepEqual([...samplePicture(img, 4, 2, 3, at, offsetsOf(0))], [200, 40, 20]);
  assert.equal(samplePicture(img, 4, 0, 3, at, offsetsOf(0)), null, 'a clear row');
});
