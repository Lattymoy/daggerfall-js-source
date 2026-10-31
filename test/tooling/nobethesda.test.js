// NO-BETHESDA (2026-10-31, the owner: "ensuring they are not implemented"): tools/bethesdaScan.mjs reads every tracked
// file's bytes and pictures against the player's ARENA2. CI has no ARENA2, so its measures are pinned here on made-up
// data: each finds what it is for and nothing else. With ARENA2_PATH set, the last test scans the tree's bytes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  readCorpus, embeddedRuns, keyOf, nearestDown, pictureIndex, matchPicture, inException, EXCEPTION_DIRS, ANCHOR, STRIDE,
  scan, trackedFiles,
} from '../../tools/bethesdaScan.mjs';

/** Bytes from a seeded generator (xorshift), so a run is the same every time. */
function noise(n, seed) {
  const out = new Uint8Array(n);
  let x = seed >>> 0 || 1;
  for (let i = 0; i < n; i++) { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; out[i] = x & 255; }
  return out;
}

function corpusOf(files) {
  const dir = mkdtempSync(join(tmpdir(), 'nobethesda-'));
  for (const [name, bytes] of Object.entries(files)) writeFileSync(join(dir, name), bytes);
  try { return readCorpus(dir); } finally { rmSync(dir, { recursive: true, force: true }); }
}

test('NO-BETHESDA: a run of the corpus inside another file is found, where it stands and how long it is', () => {
  const source = noise(40_000, 7);
  const corpus = corpusOf({ 'TEXT.RSC': source });
  const host = new Uint8Array(10_000);
  host.set(noise(10_000, 99));
  const cut = source.subarray(12_345, 12_345 + 2_000);
  host.set(cut, 3_000);
  const runs = embeddedRuns(host, corpus);
  assert.equal(runs.length, 1);
  assert.deepEqual(runs[0], { at: 3_000, length: 2_000, source: 'TEXT.RSC', sourceAt: 12_345 });
  // the shortest run an anchor is sure to fall in is STRIDE + ANCHOR long
  const short = new Uint8Array(4_000);
  short.set(source.subarray(5_000, 5_000 + STRIDE + ANCHOR), 100);
  assert.equal(embeddedRuns(short, corpus)[0]?.length, STRIDE + ANCHOR);
  assert.deepEqual(embeddedRuns(noise(10_000, 5), corpus), [], 'other bytes are not the corpus');
});

test('NO-BETHESDA: a whole file and a BSA-free corpus hash; padding is never an anchor', () => {
  const zeros = new Uint8Array(8_192);
  const corpus = corpusOf({ 'PAD.DAT': zeros, 'ART.DAT': noise(4_096, 3) });
  assert.equal(corpus.anchors.size, 4, 'four anchors of the noise, none of the zeros');
  assert.equal(corpus.whole.size, 2);
  assert.deepEqual(embeddedRuns(new Uint8Array(20_000), corpus), [], 'a file of zeros is not the corpus');
});

/** A picture of `w` x `h` from a seed, its clear pixels where `clear(x, y)` says. */
function picture(w, h, seed, clear = () => false) {
  const n = noise(w * h * 4, seed), data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      data[i] = n[i]; data[i + 1] = n[i + 1]; data[i + 2] = n[i + 2]; data[i + 3] = clear(x, y) ? 0 : 255;
    }
  }
  return { width: w, height: h, data };
}
const up = (p, k) => {
  const w = p.width * k, h = p.height * k, data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) data.set(p.data.subarray((((y / k) | 0) * p.width + ((x / k) | 0)) * 4, (((y / k) | 0) * p.width + ((x / k) | 0)) * 4 + 4), (y * w + x) * 4);
  return { width: w, height: h, data };
};
const mirror = (p) => {
  const { width: w, height: h } = p, data = new Uint8Array(p.data.length);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) data.set(p.data.subarray((y * w + x) * 4, (y * w + x) * 4 + 4), (y * w + w - 1 - x) * 4);
  return { width: w, height: h, data };
};

test('NO-BETHESDA: a picture is keyed by its drawn pixels alone, and a nearest upscale comes back down', () => {
  const a = picture(16, 16, 11, (x) => x < 4);
  const b = { ...a, data: a.data.slice() };
  b.data[0] = 1; b.data[1] = 2;   // the colour under a clear pixel
  assert.equal(keyOf(a), keyOf(b));
  b.data[(5 * 16 + 8) * 4] ^= 1;   // a drawn pixel
  assert.notEqual(keyOf(a), keyOf(b));
  assert.equal(keyOf(nearestDown(up(a, 3), 3)), keyOf(a));
  const smooth = up(a, 2);
  smooth.data[(1 * 32 + 9) * 4] ^= 8;   // one pixel of a 2 x 2 block differs: a filtered upscale, not a nearest one
  assert.equal(nearestDown(smooth, 2), null);
  assert.equal(nearestDown(a, 3), null, '16 is no multiple of 3');
});

test('NO-BETHESDA: a copy is exact at 1x to 4x, mirrored or not; a repaint is near; a stranger is neither', () => {
  const classic = picture(32, 24, 21, (x, y) => (x - 16) ** 2 + (y - 12) ** 2 > 140);
  const index = pictureIndex([{ from: 'TEXTURE.100 record 0 frame 0', rgba: classic }]);
  assert.deepEqual(matchPicture(classic, index), { kind: 'exact', from: 'TEXTURE.100 record 0 frame 0', scale: 1, mirrored: false, share: 1 });
  const m = matchPicture(mirror(up(classic, 4)), index);
  assert.equal(m.kind, 'exact'); assert.equal(m.scale, 4); assert.equal(m.mirrored, true);
  // a repaint: twice the size, every drawn pixel shifted by up to 10 per channel, the outline kept
  const paint = up(classic, 2), shift = noise(paint.data.length, 5);
  for (let i = 0; i < paint.data.length; i += 4) for (let c = 0; c < 3; c++) paint.data[i + c] = Math.max(0, Math.min(255, paint.data[i + c] + (shift[i + c] % 21) - 10));
  const near = matchPicture(paint, index);
  assert.equal(near.kind, 'near'); assert.equal(near.scale, 2); assert.ok(near.share >= 0.95, `share ${near.share}`);
  assert.equal(matchPicture(paint, index, { near: false }), null, 'near: false asks for copies only');
  assert.equal(matchPicture(picture(32, 24, 77), index), null, 'a picture of its size that is not it');
  assert.equal(matchPicture(picture(40, 40, 21), index), null, 'a picture of no classic size');
});

test('NO-BETHESDA: the exceptions are Port-Doctrine\'s directories, and nothing else is one', () => {
  for (const d of EXCEPTION_DIRS) assert.ok(inException(`${d}x.png`), d);
  assert.equal(inException('public/art/diverse-weapons/x.png'), false);
  assert.equal(inException('public/art/vanilla-enhanced-extra/x.png'), false);
});

const ARENA2 = process.env.ARENA2_PATH;
test('NO-BETHESDA: no tracked file is an ARENA2 file or record, and no run of ARENA2 stands outside a known place', { skip: !ARENA2 && 'ARENA2_PATH not set' }, () => {
  const report = scan({ arena2: ARENA2, pictures: false, files: trackedFiles() });
  assert.deepEqual(report.whole, [], 'a tracked file is an ARENA2 file or a BSA record');
  // Known: DFU's MIT quest scripts and its TEXT.RSC table carry Bethesda's words (Own-Work.md, NO-BETHESDA); the
  // exceptions' indexed PNGs carry Daggerfall's palette in their PLTE chunk.
  const known = (p) => inException(p) || p.startsWith('vendor/dfu-quests/') || p === 'vendor/dfu-text/Internal_RSC.csv';
  assert.deepEqual(report.embedded.filter((e) => !known(e.path)).map((e) => `${e.path} <- ${e.sources.join(', ')}`), []);
});
