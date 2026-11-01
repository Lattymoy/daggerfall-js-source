// NO-BETHESDA3 (2026-10-31; the owner: "Drop the rotten fish icon", "Also rebuild the rotten fish ourself"): Climates &
// Calories' rotten cooked fish (536_1-0) was the author's re-shade of TEXTURE.211 record 10. It left the tree. In its
// place is our own rot (systems/survival/rotPicture.js) over the player's own cooked fish, built through the classic
// reader. Pinned on made-up pictures in CI; with ARENA2_PATH the real fish is built and held to its print.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

import { rotPicture, rimDepth, mouldSpecks, MOULD, MIN_SPECKS, DRAWN_PER_SPECK } from '../../../src/systems/survival/rotPicture.js';
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

test('NO-BETHESDA3 rot: a grey picture goes green-grey, its rim darker, three mould specks where the seed puts them', () => {
  const pic = flat(12, 8, [100, 100, 100]);
  const before = pic.data.slice();
  const rot = rotPicture(pic, { seed: 536 });
  assert.deepEqual([...pic.data], [...before], 'the fresh picture is not touched');
  assert.deepEqual([rot.width, rot.height], [12, 8]);
  assert.deepEqual(at(rot, 4, 4), [88, 100, 75, 255], 'the light drawn toward the sick green-grey');
  assert.deepEqual(at(rot, 5, 1), [69, 78, 58, 255], 'two in from the edge: 0.78 of it');
  assert.deepEqual(at(rot, 5, 0), [48, 55, 41, 255], 'on the edge: 0.55 of it');
  assert.deepEqual(mouldSpecks(rimDepth(pic), 12, 536), [26, 32, 56], 'three specks, none on the rim');
  for (const i of [26, 32, 56]) assert.deepEqual(at(rot, i % 12, (i / 12) | 0), [...MOULD, 255], `a speck at ${i}`);
  assert.deepEqual(at(rot, 3, 2), [137, 148, 116, 255], 'a speck\'s fuzz on the pixel beside it');
  assert.deepEqual([...rotPicture(pic, { seed: 536 }).data], [...rot.data], 'one seed, one picture');
  assert.deepEqual(mouldSpecks(rimDepth(pic), 12, 7), [16, 64, 80], 'another seed, other places');
});

test('NO-BETHESDA3 rot: a clear pixel stays clear, a colour loses its saturation, and the speck count follows the drawn area', () => {
  const red = flat(5, 5, [200, 40, 40], (x, y) => x === 0 && y === 0);
  const rot = rotPicture(red, { seed: 1 });
  assert.deepEqual(at(rot, 0, 0), [0, 0, 0, 0]);
  const spread = (p) => Math.max(...p.slice(0, 3)) - Math.min(...p.slice(0, 3));
  const c = at(rot, 2, 2);
  assert.ok(spread(c) < 60 && c[0] > c[1] && c[1] > c[2], `red ${c} is drawn toward grey and keeps a little of its hue`);
  assert.deepEqual([...rimDepth(flat(3, 1, [9, 9, 9]))], [1, 1, 1], 'the picture\'s edge is the clear');
  assert.deepEqual(mouldSpecks(rimDepth(flat(2, 2, [9, 9, 9])), 2, 5), [], 'no room past the rim: no speck');
  const big = flat(40, 40, [90, 90, 90]);
  const n = mouldSpecks(rimDepth(big), 40, 3).length;
  assert.equal(n, Math.round(1600 / DRAWN_PER_SPECK), `one speck to ${DRAWN_PER_SPECK} drawn pixels`);
  assert.ok(n > MIN_SPECKS);
});

test('NO-BETHESDA3: the rotten cooked fish is ours - not a file, not a spec - built from the player\'s cooked fish under our rot, never fetched', async () => {
  assert.equal(existsSync(join(root, 'vendor/climates-calories')), false, 'the author\'s re-shade left the tree, and OWN-WORK4 the folder');
  assert.ok(Object.keys(OWN_ICONS).includes('536_1-0'), 'OWN-WORK4: one of our fourteen');
  assert.deepEqual(ownIconSpec('536_1-0'), { from: [211, 10, 0], pal: 'PAL.PAL', seed: 536 }, 'TEXTURE.211 record 10 in PAL.PAL, our seed');
  assert.deepEqual(derivedIconSpec('536_0-0'), { from: [211, 10, 0], pal: 'PAL.PAL' }, 'the record and palette the mouldy one is');
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
    assert.deepEqual(asked, [{ from: [211, 10, 0], pal: 'PAL.PAL' }, { from: [211, 10, 0], pal: 'PAL.PAL' }], 'the mouldy fish\'s spec, and our rotten one\'s record');
    assert.deepEqual([...decodedTextureTopDown(536, 1).rgba], [...rotPicture(fish, { seed: 536 }).data], 'the rotten face is our rot of the record');
    assert.deepEqual([...decodedTextureTopDown(536, 0).rgba], [...fish.data], 'the mouldy face is the record');
  } finally {
    setTextureDeriveContext(was);
    clearVendorTextures();
  }
});

const ARENA2 = process.env.ARENA2_PATH;
const printOf = (p) => createHash('sha256').update(`${p.width}x${p.height}:`).update(p.data).digest('hex').slice(0, 16);

test('NO-BETHESDA3 (ARENA2): our rotten fish, built from the player\'s TEXTURE.211 - its size, its print, and none of the author\'s', { skip: !ARENA2 && 'ARENA2_PATH not set' }, async () => {
  const asked = [];
  const art = createClassicPictures(async (n) => { asked.push(n); return readFileSync(join(ARENA2, n)); });
  const fish = await ownIconPicture('536_1-0', art);
  assert.deepEqual([fish.width, fish.height], [29, 11], 'the cooked fish record\'s size');
  assert.equal(printOf(fish), '0dd457e83cd2d69f', 'our rot: a change to it is a change to this print');
  assert.notEqual(printOf(fish), 'f34194eea2c22305', 'not the author\'s re-shade (its print, taken before it left)');
  assert.deepEqual(asked.sort(), ['PAL.PAL', 'TEXTURE.211']);
});
