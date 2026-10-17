// PERF-HIDE (2026-10-12, a profile of a player's client in its first seconds in the world: the wagon pool's horse looks
// dyed 0.9 s of the main thread; bible/07-Rendering/Performance-Priority.md PERF-HIDE) - THE HIDE IS THE PICTURE'S,
// NOT THE LOOK'S: found once a picture and kept with it, and the dye's helpers answer into scratch - and every dyed
// picture, a sprite's and the 3D horse's, is byte for byte the one COATS1 dyed before.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { PNG } from 'pngjs';
import { recolorHorse, recolorHorseTexels, pictureHide, horseLookCode, texelPlanes, latticeNearest } from '../../../src/systems/horse/horseCoats.js';
import { toColor32 } from '../../../src/formats/color32Order.js';

/** One of Horse Cart and Cargo's own pictures, as the pool keeps it (world rows, bottom first). */
const picture = (file) => {
  const p = PNG.sync.read(readFileSync(new URL(`../../../vendor/horse-cart-and-cargo/Textures/${file}`, import.meta.url)));
  return toColor32({ width: p.width, height: p.height, data: new Uint8Array(p.data.buffer, p.data.byteOffset, p.data.length) });
};
const look = (coat, pattern, legs, seed) => horseLookCode({ coat, pattern, legs, seed });
const bytes = (img) => Buffer.from(img.colors.buffer, img.colors.byteOffset, img.colors.byteLength);
const FILES = ['horse1.png', 'horse3.png', 'Walk.2-5.png', 'Walk.4-1.png'];
/** Each picture in every pattern, three ways: the pool's, the riders' (top row first), the riding sprite's (no tack,
 *  no legs) - in that order, so one picture is asked with and without its tack in turn. */
const WAYS = [[2, 1, undefined], [5, 2, { bottomFirst: false }], [3, 0, { tack: false, legs: false }]];

test('PERF-HIDE: every sprite dyed byte for byte as COATS1 dyed it - each pattern, each way, the hide kept between them', () => {
  const h = createHash('sha256');
  for (const f of FILES) {
    const p = picture(f);
    for (let pattern = 0; pattern < 5; pattern++) for (const [coat, legs, opts] of WAYS) h.update(bytes(recolorHorse(p, look(coat, pattern, legs, 41 + pattern), opts)));
  }
  // the digest of the same 60 pictures under the dye before PERF-HIDE (origin/main ee8cee565)
  assert.equal(h.digest('hex'), '097b3ce7cf3213b5f16a2ead36d9438a0a0e22278025b03c71a88e3c167c6d42');
});

test('PERF-HIDE: the 3D horse dyed byte for byte as COATS3D dyed it - the same helpers, answering into scratch', () => {
  const W = 64, H = 64, n = W * H;
  const colors = new Uint8Array(n * 4), hide = new Uint8Array(n), planes = new Float32Array(n * 9), up = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = i % W, y = (i - x) / W, v = 60 + ((x * 7 + y * 13) % 150);
    colors.set([v, Math.floor(v * 0.55), Math.floor(v * 0.3), (x + y) % 17 ? 255 : 0], i * 4);
    hide[i] = (x * y) % 11 ? 1 : 0; up[i] = y / H;
    planes.set(texelPlanes([x / 12 - 2.5, 1 - y / 20, 2 - y / 22], [Math.sin(x * 0.2), Math.cos(y * 0.16), Math.sin((x + y) * 0.12)], { length: 3, front: 1.5, top: 2 }), i * 9);
  }
  const h = createHash('sha256');
  for (let pattern = 0; pattern < 5; pattern++) for (const [coat, legs] of [[1, 2], [4, 1], [6, 0]]) h.update(recolorHorseTexels({ width: W, height: H, colors }, look(coat, pattern, legs, 90 + pattern), { hide, planes, up }).colors);
  assert.equal(h.digest('hex'), 'accc3208cb1304ab887567c157e3983318280dbcfc6dda105c536b2fd2b7b931');
});

test('PERF-HIDE: a picture\'s hide is found once and kept - one a tack, never another picture\'s', () => {
  const p = picture('horse3.png');
  const a = pictureHide(p);
  assert.ok(a.at.length > 1000, `the hide is the horse's body: ${a.at.length} pixels`);
  assert.equal(pictureHide(p), a, 'asked again: the kept one');
  recolorHorse(p, look(1, 3, 1, 7));
  assert.equal(pictureHide(p), a, 'a dye finds no new one');
  const bare = pictureHide(p, { tack: false });
  assert.notEqual(bare, a, 'without its tack: its own');
  assert.ok(bare.at.length > a.at.length, 'the saddle\'s leather is hide where no tack is spared');
  assert.equal(pictureHide(p, { tack: false }), bare);
  // the same pixels in a new array are another picture to the keep - found again, the same hide
  const copy = { ...p, colors: p.colors.slice() };
  const c = pictureHide(copy);
  assert.notEqual(c, a);
  assert.deepEqual([...c.at], [...a.at]);
  assert.deepEqual([c.x0, c.x1, c.r0, c.r1], [a.x0, a.x1, a.r0, a.r1]);
  // and a different picture never wears this one's
  const w = picture('Walk.0-3.png');
  assert.notDeepEqual([...pictureHide(w).at], [...a.at]);
});

test('PERF-HIDE: a dye is the same cold or warm - whatever picture, pattern or seed came between', () => {
  const cold = (file, l, opts) => bytes(recolorHorse(picture(file), l, opts));   // a fresh picture: nothing kept
  const p = picture('horse1.png'), q = picture('Walk.1-2.png');
  const dap = look(3, 3, 0, 5), app = look(4, 2, 1, 6), app2 = look(4, 2, 1, 9);
  const first = bytes(recolorHorse(p, dap));
  recolorHorse(q, app); recolorHorse(q, app2); recolorHorse(p, app, { tack: false });
  assert.deepEqual(bytes(recolorHorse(p, dap)), first, 'the dapples again after the appaloosa\'s cells');
  assert.deepEqual(first, cold('horse1.png', dap), 'and as a picture never dyed before');
  assert.deepEqual(bytes(recolorHorse(q, app)), cold('Walk.1-2.png', app));
  assert.deepEqual(bytes(recolorHorse(p, app, { tack: false })), cold('horse1.png', app, { tack: false }));
  // the lattice's cells are kept for the last one asked: a pattern's cells never answer another's, nor another seed's
  const w = picture('Walk.3-4.png');
  for (let seed = 1; seed <= 12; seed++) {
    for (const [before, after] of [[look(2, 2, 0, seed), look(2, 3, 0, seed)], [look(2, 3, 0, seed), look(2, 2, 0, seed)], [look(2, 2, 0, seed), look(2, 2, 0, seed + 1)], [look(2, 3, 0, seed), look(2, 3, 0, seed + 1)]]) {
      recolorHorse(w, before);
      assert.deepEqual(bytes(recolorHorse(w, after)), cold('Walk.3-4.png', after), `seed ${seed}: ${before} then ${after}`);
    }
  }
});

test('PERF-HIDE: the kept lattice cells are the cell\'s, the seed\'s and the stretch\'s - one of them moved, they are found again', () => {
  const fresh = (x, y, s, k) => { latticeNearest(x + 50, y + 50, s + 99, 0.3); return latticeNearest(x, y, s, k); };   // another cell first: nothing kept for this one
  for (const [x, y] of [[0.3, 0.4], [2.6, 7.1], [-3.2, 1.9]]) {
    for (const [s, k] of [[7, 0.7], [7, 0.45], [7, 0], [8, 0.7], [1234, 0.45]]) {
      const other = k === 0.7 ? 0.45 : 0.7;
      const want = fresh(x, y, s, k), wantOther = fresh(x + 0.1, y + 0.05, s, other), wantNext = fresh(x + 0.1, y + 0.05, s + 1, k);
      latticeNearest(x, y, s, k);
      assert.deepEqual(latticeNearest(x + 0.1, y + 0.05, s, other), wantOther, `(${x}, ${y}) seed ${s}: the same cell in stretch ${other} after ${k}`);
      assert.deepEqual(latticeNearest(x, y, s, k), want, `(${x}, ${y}) seed ${s} stretch ${k} after another stretch`);
      assert.deepEqual(latticeNearest(x + 0.1, y + 0.05, s + 1, k), wantNext, `(${x}, ${y}): the same cell in seed ${s + 1} after ${s}`);
      assert.deepEqual(latticeNearest(x, y, s, k), want, `(${x}, ${y}) seed ${s} stretch ${k} after another seed`);
      assert.deepEqual(latticeNearest(x, y, s, k), want, 'and asked twice');
    }
  }
});
