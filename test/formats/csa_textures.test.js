// CSA-A (2026-09-27) - COME SAIL AWAY'S PICTURES (vendor/come-sail-away/Textures/),
// what tools/comeSailAwayExtract.mjs wrote after measuring each against the
// ARENA2: the author's own (the splash and the wind widget's 24 frames) as
// indexed PNGs, the 32 wave frames as the author's two paints over the
// player's own snow (TEXTURE.303 record 1) with a scroll and a phase each,
// and Daggerfall's travel map (record 3) not at all. The measuring tools
// have their pins here too: the block search judges visible pixels and skips
// flat swatches, the indexed PNG round-trips, the tiled rebuild is exact.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { PNG } from 'pngjs';
import { composeTiledPicture, deriveTiledPaint, classicRecordRgba } from '../../src/formats/derivedTexture.js';
import { encodeIndexedPng, pictureColours } from '../../tools/lib/indexedPng.mjs';
import { bestClassicBlock, cropToVisible, FLAT_SHARE } from '../../tools/lib/classicBlocks.mjs';
import { WAVE_KEY, WAVE_SOURCE, CSA_ARCHIVE } from '../../tools/comeSailAwayExtract.mjs';
import { TextureFile } from '../../src/formats/textureFile.js';
import { DFPalette } from '../../src/formats/dfPalette.js';

const DIR = new URL('../../vendor/come-sail-away/Textures/', import.meta.url);
const png = (f) => PNG.sync.read(readFileSync(new URL(f, DIR)));
const TEXTURES = JSON.parse(readFileSync(new URL('textures.json', DIR), 'utf8'));
const DERIVED = JSON.parse(readFileSync(new URL('derived.json', DIR), 'utf8'));
const ARENA2 = process.env.ARENA2_PATH;

/** The scroll the author's frames step through: two pictures, the same sixteen offsets each. */
const SCROLLS = [0, 632, 624, 616, 608, 600, 592, 584, 576, 570, 562, 554, 546, 538, 530, 522];

test('CSA-A: the carried pictures are the author\'s 25 and the 32 derived frames of archive 112395 - never record 3, Daggerfall\'s travel map, and none of Unity\'s own', () => {
  const own = TEXTURES.filter((t) => t.kind === 'own').map((t) => t.name);
  const derived = TEXTURES.filter((t) => t.kind === 'derived').map((t) => t.name);
  assert.deepEqual(own, ['112395_0-0', ...Array.from({ length: 24 }, (_, i) => `112395_1-${i}`)]);
  assert.deepEqual(derived, Array.from({ length: 32 }, (_, i) => `112395_2-${i}`));
  assert.ok(TEXTURES.every((t) => t.name.startsWith(`${CSA_ARCHIVE}_`) && !t.name.startsWith(`${CSA_ARCHIVE}_3-`)));
  const files = readdirSync(DIR).sort();
  assert.deepEqual(files.filter((f) => /\.png$/.test(f) && !/\.paint\.png$/.test(f)), own.map((n) => `${n}.png`).sort());
  assert.deepEqual(files.filter((f) => /\.paint\.png$/.test(f)), ['112395_2-base0.paint.png', '112395_2-base1.paint.png']);
  assert.ok(!files.some((f) => /3-0|Default-Particle|Bayer/.test(f)));
  // the import settings the mod's textures carry: point-sampled, one mip; the waves repeat (their scroll wraps), the rest clamp
  for (const t of TEXTURES) {
    assert.deepEqual([t.filterMode, t.mipCount], [0, 1], t.name);
    assert.equal(t.wrapU, t.kind === 'derived' ? 0 : 1, t.name);
  }
});

test('CSA-A: each own picture decodes to its size, an indexed PNG of the author\'s few ART_PAL colours', () => {
  for (const t of TEXTURES.filter((x) => x.kind === 'own')) {
    const bytes = readFileSync(new URL(`${t.name}.png`, DIR));
    assert.equal(bytes[25], 3, `${t.name} is colour type 3 (indexed)`);
    const p = png(`${t.name}.png`);
    assert.deepEqual([p.width, p.height], [t.width, t.height], t.name);
  }
  const w = png('112395_1-0.png');
  const opaque = [];
  for (let i = 0; i < w.data.length; i += 4) if (w.data[i + 3]) opaque.push((w.data[i] << 16) | (w.data[i + 1] << 8) | w.data[i + 2]);
  assert.deepEqual([...new Set(opaque)].sort((a, b) => a - b).map((c) => c.toString(16)), ['3e69a7', '447cc0', '6898d9', '7ba4e6'], 'the wind arrow\'s four blues');
});

test('CSA-A: the 32 wave frames are the two paints over TEXTURE.303 record 1 - even frames the first, odd the second, each pair scrolled the same sixteen steps, the snow\'s phase the paint\'s plus the scroll', () => {
  const names = Object.keys(DERIVED);
  assert.equal(names.length, 32);
  for (let f = 0; f < 32; f++) {
    const s = DERIVED[`112395_2-${f}`];
    assert.deepEqual(s.from, [WAVE_SOURCE[0], WAVE_SOURCE[1]], 'TEXTURE.303 record 1, frame 0');
    assert.deepEqual(s.size, [640, 640]);
    assert.equal(s.paint, `112395_2-base${f % 2}.paint.png`);
    assert.equal(s.scroll, SCROLLS[f >> 1], `frame ${f}'s scroll`);
    const base = DERIVED[`112395_2-${f % 2}`];
    assert.deepEqual(s.tile, [base.tile[0], (base.tile[1] + s.scroll) % 64], `frame ${f}'s phase`);
    assert.equal(s.key, WAVE_KEY);
  }
  assert.deepEqual([DERIVED['112395_2-0'].tile, DERIVED['112395_2-1'].tile], [[0, 0], [0, 60]]);
  // the paints: one shared palette, the key their crests, 119,409 of each paint's 241,396 opaque pixels
  const [b0, b1] = [readFileSync(new URL('112395_2-base0.paint.png', DIR)), readFileSync(new URL('112395_2-base1.paint.png', DIR))];
  const plte = (b) => { const i = b.indexOf('PLTE'); return b.subarray(i + 4, i + 4 + b.readUInt32BE(i - 4)).toString('hex'); };
  assert.equal(plte(b0), plte(b1), 'the two paints index alike');
  for (const f of ['112395_2-base0.paint.png', '112395_2-base1.paint.png']) {
    const p = png(f);
    let key = 0, opaque = 0;
    for (let i = 0; i < p.data.length; i += 4) {
      if (!p.data[i + 3]) continue;
      opaque++;
      if (p.data[i] === 0xff && p.data[i + 1] === 0 && p.data[i + 2] === 0xff) key++;
    }
    assert.deepEqual([key, opaque], [119409, 241396], f);
  }
});

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

test('CSA-A: the block search judges VISIBLE pixels only, skips flat swatches, leaves a block under a quarter visible unjudged, and the crop cuts a sprite to its box', () => {
  const rec = (archive, fill) => { const d = new Uint8Array(32 * 32 * 4); for (let i = 0; i < 1024; i++) d.set(fill(i), i * 4); return { archive, record: 0, frame: 0, rgba: { width: 32, height: 32, data: d } }; };
  const noisy = rec(1, (i) => [(i * 37) & 255, (i * 11) & 255, 7, 255]);
  const flat = rec(2, () => [50, 50, 50, 255]);
  const pic = { width: 64, height: 32, data: new Uint8Array(64 * 32 * 4) };
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      const j = (y * 32 + x) * 4, i = (y * 64 + x) * 4;
      pic.data.set(noisy.rgba.data.subarray(j, j + 4), i);            // the left block: the noisy record exactly
      pic.data.set([50, 50, 50, x < 2 ? 255 : 0], i + 32 * 4);         // the right: the flat grey, but almost all clear
    }
  }
  const m = bestClassicBlock(pic, [noisy, flat]);
  assert.deepEqual([m.archive, m.at, m.share, m.flatsSkipped], [1, [0, 0], 1, 1]);
  // clear pixels are neither match nor miss: half the left block cleared (to clear black) still matches whole
  for (let y = 0; y < 16; y++) for (let x = 0; x < 32; x++) pic.data.fill(0, (y * 64 + x) * 4, (y * 64 + x) * 4 + 4);
  assert.equal(bestClassicBlock(pic, [noisy]).share, 1);
  // a block under a quarter visible is not judged, even where its few pixels ARE a record's
  const sparse = { width: 32, height: 32, data: new Uint8Array(32 * 32 * 4) };
  for (let y = 0; y < 32; y++) for (let x = 0; x < 2; x++) { const j = (y * 32 + x) * 4; sparse.data.set(noisy.rgba.data.subarray(j, j + 4), j); }
  assert.equal(bestClassicBlock(sparse, [noisy]), null);
  assert.ok(FLAT_SHARE > 0.5 && FLAT_SHARE < 1);
  const c = cropToVisible({ width: 4, height: 3, data: new Uint8Array([0, 0, 0, 0, 1, 1, 1, 255, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 2, 255, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]) });
  assert.deepEqual([c.width, c.height, c.at], [2, 2, [1, 0]], 'the box of (1,0) and (2,1)');
  assert.deepEqual([...c.data], [1, 1, 1, 255, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 2, 255]);
});

test('CSA-A: an indexed PNG is the picture\'s own colours ascending, PLTE and a tRNS cut at its last clear entry, and reads back to the same RGBA; more than 256 colours is refused', () => {
  const pic = { width: 3, height: 2, data: new Uint8Array([9, 9, 9, 255, 0, 0, 0, 0, 200, 1, 2, 255, 9, 9, 9, 255, 0, 0, 0, 0, 5, 6, 7, 128]) };
  assert.deepEqual(pictureColours(pic).map((c) => c.toString(16).padStart(8, '0')), ['00000000', '05060780', '090909ff', 'c80102ff']);
  const back = PNG.sync.read(encodeIndexedPng(pic));
  assert.deepEqual(new Uint8Array(back.data), pic.data);
  const many = { width: 257, height: 1, data: new Uint8Array(257 * 4) };
  for (let i = 0; i < 257; i++) many.data.set([i & 255, i >> 8, 0, 255], i * 4);
  assert.throws(() => encodeIndexedPng(many), /257 colours/);
});

test('CSA-A (ARENA2): the 32 frames rebuild from the player\'s own TEXTURE.303 - the paints\' crests become the snow, and each scrolled frame is its base\'s rebuild moved down whole rows', { skip: !ARENA2 && 'ARENA2_PATH is not set' }, () => {
  const pal = new DFPalette();
  pal.load(new Uint8Array(readFileSync(join(ARENA2, 'ART_PAL.COL'))));
  const tf = new TextureFile();
  assert.ok(tf.load(new Uint8Array(readFileSync(join(ARENA2, 'TEXTURE.303'))), 'TEXTURE.303', pal));
  const snow = classicRecordRgba(tf.getDFBitmap(1, 0), pal);
  const paints = [png('112395_2-base0.paint.png'), png('112395_2-base1.paint.png')].map((p) => ({ width: p.width, height: p.height, data: new Uint8Array(p.data) }));
  const base = [0, 1].map((b) => composeTiledPicture(DERIVED[`112395_2-${b}`], snow, paints[b]));
  for (const b of base) {
    for (let i = 0; i < b.data.length; i += 4) assert.ok(!(b.data[i] === 0xff && b.data[i + 1] === 0 && b.data[i + 2] === 0xff && b.data[i + 3] === 0xff), 'no key survives the rebuild');
  }
  for (let f = 2; f < 32; f += 5) {
    const s = DERIVED[`112395_2-${f}`];
    const frame = composeTiledPicture(s, snow, paints[f % 2]);
    const b = base[f % 2];
    for (let y = 0; y < 640; y += 37) assert.deepEqual(frame.data.subarray(y * 2560, y * 2560 + 2560), b.data.subarray(((y + s.scroll) % 640) * 2560, ((y + s.scroll) % 640) * 2560 + 2560), `frame ${f} row ${y}`);
  }
  // with the bundle at hand the rebuild is the bundle's frame itself
  const bundlePath = process.env.CSA_BUNDLE;
  if (bundlePath && existsSync(bundlePath)) {
    return import('../../src/formats/unity/unityBundle.js').then(({ readUnityBundle }) => {
      const bun = readUnityBundle(new Uint8Array(readFileSync(bundlePath)));
      for (const f of [0, 1, 17, 31]) {
        const want = bun.textures.find((t) => t.name === `112395_2-${f}`).rgba();
        const got = composeTiledPicture(DERIVED[`112395_2-${f}`], snow, paints[f % 2]);
        for (let i = 0; i < want.data.length; i += 4) {
          if (want.data[i + 3] === 0 && got.data[i + 3] === 0) continue;
          assert.deepEqual([...got.data.subarray(i, i + 4)], [...want.data.subarray(i, i + 4)], `frame ${f} pixel ${i / 4}`);
        }
      }
    });
  }
});
