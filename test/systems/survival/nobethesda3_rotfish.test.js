// Climates & Calories' rotten cooked fish (536_1-0) was the author's re-shade of TEXTURE.211 record 10. It left the
// tree. In its place is our own rot (systems/survival/rotPicture.js) over the player's own cooked fish, built through
// the classic reader. Pinned on made-up pictures in CI; with ARENA2_PATH the real fish is built and held to its
// print.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

import { rotPicture, rimDepth, mouldField, MOULDY, MOULD_COVER, MOULD_SOFT } from '../../../src/systems/survival/rotPicture.js';
import { installSurvivalIcons, OWN_ICONS, ownIconSpec, ownIconPicture, derivedIconSpec } from '../../../src/systems/survival/itemIcons.js';
import { VENDOR_ICON_FILES } from '../../../src/systems/survival/items.js';
import { createClassicPictures } from '../../../src/formats/classicPictures.js';
import { clearVendorTextures, preloadTextureArchive, decodedTextureTopDown, setTextureDeriveContext, textureDeriveContext } from '../../../src/systems/textureReplacement.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
/** A `w` x `h` picture of one colour, `clear(x, y)` clear. */
const flat = (w, h, rgb, clear = () => false) => {
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (!clear(x, y)) data.set([...rgb, 255], (y * w + x) * 4);
  return { width: w, height: h, data };
};
const at = (p, x, y) => [...p.data.subarray((y * p.width + x) * 4, (y * p.width + x) * 4 + 4)];

test('NO-BETHESDA3 rot: a grey picture goes green-grey and its rim darker; one seed, one picture', () => {
  const pic = flat(12, 8, [100, 100, 100]);
  const before = pic.data.slice();
  const rot = rotPicture(pic, { seed: 536, cover: 0 });
  assert.deepEqual([...pic.data], [...before], 'the fresh picture is not touched');
  assert.deepEqual([rot.width, rot.height], [12, 8]);
  assert.deepEqual(at(rot, 4, 4), [88, 100, 75, 255], 'the light drawn toward the sick green-grey');
  assert.deepEqual(at(rot, 5, 1), [69, 78, 58, 255], 'two in from the edge: 0.78 of it');
  assert.deepEqual(at(rot, 5, 0), [48, 55, 41, 255], 'on the edge: 0.55 of it');
  const mouldy = rotPicture(pic, { seed: 536 });
  assert.deepEqual([...rotPicture(pic, { seed: 536 }).data], [...mouldy.data], 'one seed, one picture');
  assert.notDeepEqual([...rotPicture(pic, { seed: 7 }).data], [...mouldy.data], 'another seed, other mould');
});

const lum = (p, i) => 0.299 * p.data[i * 4] + 0.587 * p.data[i * 4 + 1] + 0.114 * p.data[i * 4 + 2];
/** How far the most standing-out pixel stands above the mean of its drawn neighbours, in luminance. */
function sparkle(p) {
  let worst = 0;
  for (let y = 0; y < p.height; y++) for (let x = 0; x < p.width; x++) {
    const i = y * p.width + x;
    if (!p.data[i * 4 + 3]) continue;
    let sum = 0, n = 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const X = x + dx, Y = y + dy;
      if (X >= 0 && Y >= 0 && X < p.width && Y < p.height && p.data[(Y * p.width + X) * 4 + 3]) { sum += lum(p, Y * p.width + X); n++; }
    }
    if (n) worst = Math.max(worst, lum(p, i) - sum / n);
  }
  return worst;
}
const moved = (m, base) => Array.from({ length: m.width * m.height }, (_, i) => i).filter((i) => [0, 1, 2].some((c) => m.data[i * 4 + c] !== base.data[i * 4 + c]));

test('OWN-AUDIT mould: soft patches in grey-green and white, on the food\'s own shading, never brighter than its highlight, no sparkle (mutants: NB3-mould-*)', () => {
  // a food lit on its right, shaded on its left
  const food = flat(24, 16, [0, 0, 0], () => false);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 24; x++) food.data.set(x < 12 ? [60, 50, 40] : [180, 150, 120], (y * 24 + x) * 4);
  for (let seed = 1; seed <= 40; seed++) for (const stage of [{}, MOULDY]) {
    const m = rotPicture(food, { seed, ...stage }), base = rotPicture(food, { seed, ...stage, cover: 0 });
    const mould = moved(m, base), cover = stage.cover ?? MOULD_COVER;
    assert.ok(mould.length <= (cover + 0.25) * 384, `seed ${seed}: ${mould.length} pixels for a share of ${cover}`);
    // a patch's border is soft: past the share it covers whole, a fringe of pixels takes part of it
    assert.ok(mould.length >= Math.ceil(cover * 384) + 10, `seed ${seed}: ${mould.length} pixels, no soft fringe past ${Math.ceil(cover * 384)}`);
    const highlight = Math.max(...Array.from({ length: 384 }, (_, i) => lum(base, i)));
    for (const i of mould) assert.ok(lum(m, i) <= highlight, `seed ${seed}: pixel ${i} brighter than the food's highlight`);
    // inside a patch's soft border the colour is the mould's own: grey-green to white, never redder or bluer than green
    const { density } = mouldField(food, seed), sorted = [...density].sort((a, b) => a - b), edge = sorted[Math.floor(384 * (1 - cover))];
    for (let i = 0; i < 384; i++) if (density[i] >= edge + MOULD_SOFT) assert.ok(m.data[i * 4] <= m.data[i * 4 + 1] + 1 && m.data[i * 4 + 2] <= m.data[i * 4 + 1] + 1, `seed ${seed}: pixel ${i} ${at(m, i % 24, (i / 24) | 0)} is not grey-green or white`);
    const mean = (side) => { const v = mould.filter((i) => (i % 24 < 12) === side).map((i) => lum(m, i)); return v.reduce((a, b) => a + b, 0) / v.length; };
    assert.ok(mean(true) < mean(false), `seed ${seed}: mould in the shade is shaded`);
    assert.ok(sparkle(m) <= sparkle(base) + 25, `seed ${seed}: a pixel stands ${sparkle(m).toFixed(1)} above its neighbours`);
  }
  // the first stage is the mouldier
  assert.ok(moved(rotPicture(food, { seed: 3, ...MOULDY }), rotPicture(food, { seed: 3, ...MOULDY, cover: 0 })).length > moved(rotPicture(food, { seed: 3 }), rotPicture(food, { seed: 3, cover: 0 })).length);
  // and the white is there: some mould stands lighter than the food it lies on
  const m = rotPicture(food, { seed: 5, ...MOULDY }), base = rotPicture(food, { seed: 5, ...MOULDY, cover: 0 });
  assert.ok(moved(m, base).some((i) => lum(m, i) > lum(base, i) + 20), 'a patch\'s white core');
});

test('OWN-AUDIT mould: denser at the rim and in the hollows, over every seed (mutants: NB3-mould-ignores-the-rim, NB3-mould-ignores-the-hollows)', () => {
  const plain = flat(24, 16, [120, 100, 80]);
  const groove = flat(24, 16, [120, 100, 80]);
  for (let y = 0; y < 16; y++) for (const x of [11, 12]) groove.data.set([70, 58, 46, 255], (y * 24 + x) * 4);
  const mean = (v) => v.reduce((a, b) => a + b, 0) / v.length;
  for (let seed = 1; seed <= 40; seed++) {
    const { density, depth } = mouldField(plain, seed);
    const rim = mean([...density].filter((_, i) => depth[i] === 1)), inner = mean([...density].filter((_, i) => depth[i] === 3));
    assert.ok(rim > inner, `seed ${seed}: the rim ${rim.toFixed(3)} against the inside ${inner.toFixed(3)}`);
    const g = mouldField(groove, seed).density, rows = [4, 5, 6, 7, 8, 9, 10, 11];
    const inGroove = mean(rows.flatMap((y) => [g[y * 24 + 11], g[y * 24 + 12]])), beside = mean(rows.flatMap((y) => [g[y * 24 + 7], g[y * 24 + 16]]));
    assert.ok(inGroove > beside, `seed ${seed}: the groove ${inGroove.toFixed(3)} against beside it ${beside.toFixed(3)}`);
  }
});

test('NO-BETHESDA3 rot: a clear pixel stays clear, a colour loses its saturation, and the mould follows the drawn area', () => {
  const red = flat(5, 5, [200, 40, 40], (x, y) => x === 0 && y === 0);
  assert.deepEqual(at(rotPicture(red, { seed: 1 }), 0, 0), [0, 0, 0, 0]);
  const spread = (p) => Math.max(...p.slice(0, 3)) - Math.min(...p.slice(0, 3));
  const c = at(rotPicture(red, { seed: 1, cover: 0 }), 2, 2);
  assert.ok(spread(c) < 60 && c[0] > c[1] && c[1] > c[2], `red ${c} is drawn toward grey and keeps a little of its hue`);
  assert.deepEqual([...rimDepth(flat(3, 1, [9, 9, 9]))], [1, 1, 1], 'the picture\'s edge is the clear');
  const big = flat(40, 40, [90, 90, 90]);
  const n = moved(rotPicture(big, { seed: 3 }), rotPicture(big, { seed: 3, cover: 0 })).length;
  assert.ok(n >= Math.floor(1600 * MOULD_COVER) && n < 1600 * (MOULD_COVER + 0.2), `${n} of 1600 drawn pixels mouldy`);
});

test('NO-BETHESDA3: the rotten and the mouldy cooked fish are ours - not a file, not a spec - built from the player\'s cooked fish under our rot, never fetched (mutant: NB3-the-mouldy-fish-is-the-plain-fish)', async () => {
  assert.equal(existsSync(join(root, 'vendor/climates-calories')), false, 'the author\'s re-shade left the tree, and OWN-WORK4 the folder');
  assert.equal(Object.keys(OWN_ICONS).length, 16, 'OWN-AUDIT: our sixteen, the mouldy cooked fish among them');
  assert.deepEqual(ownIconSpec('536_1-0'), { from: [211, 10, 0], pal: 'PAL.PAL', seed: 536 }, 'TEXTURE.211 record 10 in PAL.PAL, our seed');
  assert.deepEqual(ownIconSpec('536_0-0'), { from: [211, 10, 0], pal: 'PAL.PAL', seed: 5360, mouldy: true }, 'the mouldy face: the first stage, its own seed');
  assert.equal(derivedIconSpec('536_0-0'), null);
  assert.equal(derivedIconSpec('536_1-0'), null);
  assert.ok(VENDOR_ICON_FILES.includes('536_1-0'), 'the dress law still draws it');
  const was = textureDeriveContext();
  clearVendorTextures();
  setTextureDeriveContext({ classicRgba: async () => assert.fail('the door\'s context is ART_PAL alone') });
  try {
    const asked = [];
    const fish = flat(6, 5, [120, 110, 60], (x, y) => y === 0 && x < 2);
    const art = { build: async (spec) => { asked.push(spec); return { ...fish, data: fish.data.slice() }; } };
    assert.equal(installSurvivalIcons({ art }), 18);
    await preloadTextureArchive(536, { decode: async () => assert.fail('nothing of 536 is a file') });
    assert.deepEqual(asked, [{ from: [211, 10, 0], pal: 'PAL.PAL' }, { from: [211, 10, 0], pal: 'PAL.PAL' }], 'both faces: the player\'s record, under our rot');
    assert.deepEqual([...decodedTextureTopDown(536, 1).rgba], [...rotPicture(fish, { seed: 536 }).data], 'the rotten face is our rot of the record');
    assert.deepEqual([...decodedTextureTopDown(536, 0).rgba], [...rotPicture(fish, { seed: 5360, ...MOULDY }).data], 'the mouldy face is our mould of the record');
    assert.notDeepEqual([...decodedTextureTopDown(536, 0).rgba], [...fish.data], 'and never the plain fish');
  } finally {
    setTextureDeriveContext(was);
    clearVendorTextures();
  }
});

const ARENA2 = process.env.ARENA2_PATH;
const printOf = (p) => createHash('sha256').update(`${p.width}x${p.height}:`).update(p.data).digest('hex').slice(0, 16);

test('NO-BETHESDA3 (ARENA2): our rotten and mouldy fish, built from the player\'s TEXTURE.211 - their size, their print, and none of the author\'s', { skip: !ARENA2 && 'ARENA2_PATH not set' }, async () => {
  const asked = [];
  const art = createClassicPictures(async (n) => { asked.push(n); return readFileSync(join(ARENA2, n)); });
  const fish = await ownIconPicture('536_1-0', art);
  assert.deepEqual([fish.width, fish.height], [29, 11], 'the cooked fish record\'s size');
  assert.equal(printOf(fish), 'c1e6fa54cd05e458', 'our rot: a change to it is a change to this print (OWN-AUDIT 2026-11-01: the mould\'s patches)');
  assert.notEqual(printOf(fish), 'f34194eea2c22305', 'not the author\'s re-shade (its print, taken before it left)');
  // The mouldy face is our mould, and not the plain cooked fish the release drew for it
  const mouldy = await ownIconPicture('536_0-0', art);
  assert.deepEqual([mouldy.width, mouldy.height, printOf(mouldy)], [29, 11, '6b6bc8413dba55f6']);
  assert.notEqual(printOf(mouldy), 'af7fa8af9e9c3a78', 'not the plain cooked fish (its print, nobethesda2_torchesicons.test.js)');
  assert.deepEqual(asked.sort(), ['PAL.PAL', 'TEXTURE.211']);
});
