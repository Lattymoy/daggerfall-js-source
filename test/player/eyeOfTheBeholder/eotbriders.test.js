// AUDIT-STOREFRONT (2026-10-29, the owner: "the horse designs are awful"; bible/06-Systems/Horse-Coats.md RIDERS): EYE OF
// THE BEHOLDER'S RIDERS SPARED. Its mounted sets are one horse under five riders, so each picture's rider is what the
// other four disagree on (tools/bakeEotbRiders.mjs, baked into eotbRiderMasks.js); the dye never takes a pixel of his -
// his skin was a bay's warm and his hair a mane's black, and a coat or a mount look dyed them in every view.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { riderMasksText, packMask, RIDER_SETS, RIDER_RECORDS } from '../../../tools/bakeEotbRiders.mjs';
import { RIDER_MASKS } from '../../../src/player/eyeOfTheBeholder/eotbRiderMasks.js';
import { riderSpareOf, ridersReady, lookedPixels } from '../../../src/player/eyeOfTheBeholder/eotbSprite.js';
import { recolorHorse, withMountLook, horseLookCode } from '../../../src/systems/horse/horseCoats.js';
import { MOUNT_LOOKS } from '../../../src/net/effectLaw.js';
import { eotbPictures } from '../../../tools/lib/eotbPictures.mjs';

const rd = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
// NO-BETHESDA2 (2026-10-31): the five mounted sets are Daggerfall's own TEXTURE.491-495, rebuilt from the player's ARENA2
// (tools/lib/eotbPictures.mjs). A pin on their pixels runs where ARENA2_PATH is set; the derived path's own pins run in
// CI (nobethesda2_eotb.test.js: a derived mounted picture keeps its rider spared).
const NEEDS_ARENA2 = { skip: !process.env.ARENA2_PATH && 'ARENA2_PATH not set' };
const EOTB = eotbPictures();
/** A mounted picture as the body dyes it: the world's rows, bottom first. */
async function picture(key) {
  const p = await EOTB.picture(key);
  const colors = new Uint8Array(p.width * p.height * 4);
  for (let y = 0; y < p.height; y++) colors.set(p.data.subarray(y * p.width * 4, (y + 1) * p.width * 4), (p.height - 1 - y) * p.width * 4);
  return { width: p.width, height: p.height, colors };
}
const same = (a, b, i) => a[i * 4] === b[i * 4] && a[i * 4 + 1] === b[i * 4 + 1] && a[i * 4 + 2] === b[i * 4 + 2] && a[i * 4 + 3] === b[i * 4 + 3];

test('AUDIT-STOREFRONT the riders baked: the table is the five sets\' pictures as the tool reads them (mutants: a threshold of the tool moved)', NEEDS_ARENA2, async () => {
  assert.equal(rd('src/player/eyeOfTheBeholder/eotbRiderMasks.js'), await riderMasksText(), 'run node tools/bakeEotbRiders.mjs');
});

test('AUDIT-STOREFRONT the riders baked: every mounted picture of every set (mutants: a picture left out)', () => {
  assert.equal(Object.keys(RIDER_MASKS).length, RIDER_SETS.length * RIDER_RECORDS.length);
  assert.equal(RIDER_RECORDS.length, 5 + 10 * 8, 'five standing views, then the walk and the run in eight frames');
});

test('AUDIT-STOREFRONT a rider read back: his pixels on the world\'s rows, bottom first, as the bake wrote them top first; none for a picture the table does not hold or holds at another size (mutants: the rows unturned; the size unchecked)', () => {
  const riders = { k: `3x2:${packMask(new Uint8Array([1, 0, 0, 0, 0, 1]))}` };
  assert.deepEqual([...riderSpareOf(riders, 'k', 3, 2)], [0, 0, 1, 1, 0, 0]);
  assert.equal(riderSpareOf(riders, 'k', 3, 3), null, 'art replaced since the bake');
  assert.equal(riderSpareOf(riders, 'other', 3, 2), null);
  assert.equal(riderSpareOf(null, 'k', 3, 2), null, 'not loaded yet');
  const long = new Uint8Array(400); long.fill(1, 130, 390);   // runs past 127 take two bytes
  const want = new Uint8Array(400);
  for (let y = 0; y < 20; y++) for (let x = 0; x < 20; x++) want[(19 - y) * 20 + x] = long[y * 20 + x];
  assert.deepEqual([...riderSpareOf({ k: `20x20:${packMask(long)}` }, 'k', 20, 20)], [...want]);
});

test('AUDIT-STOREFRONT the dye spares the rider: from the front, the side and behind, under every look and a coat, not one pixel of his moves - and without the table his skin and hair did (mutants: the hide takes him; the points take him)', NEEDS_ARENA2, async () => {
  const riders = await ridersReady();
  const coat = horseLookCode({ coat: 3, pattern: 1, legs: 2, seed: 9 });
  for (const key of ['112382_0-0', '112384_7-2', '112382_3-0', '112385_12-5']) {
    const img = await picture(key), n = img.width * img.height, spare = riderSpareOf(riders, key, img.width, img.height);
    assert.ok(spare, `${key}: its rider held`);
    const his = []; for (let i = 0; i < n; i++) if (spare[i]) his.push(i);
    for (const look of [coat, ...MOUNT_LOOKS.map((m) => withMountLook(coat, m))]) {
      const d = recolorHorse(img, look, { spare }).colors;
      const moved = his.filter((i) => !same(d, img.colors, i));
      assert.equal(moved.length, 0, `${key} ${look}: ${moved.length} of his pixels moved`);
    }
    const blind = recolorHorse(img, withMountLook(coat, 'dawnfire')).colors;
    assert.ok(his.filter((i) => !same(blind, img.colors, i)).length > 40, `${key}: without the table the dye took him`);
  }
});

test('AUDIT-STOREFRONT one picture asked with and without its rider keeps each answer apart (mutant: the rider unkept in the picture\'s slot)', NEEDS_ARENA2, async () => {
  const riders = await ridersReady(), key = '112384_7-2', img = await picture(key), look = withMountLook(0, 'spectral');
  const spare = riderSpareOf(riders, key, img.width, img.height);
  const bare = [...recolorHorse(img, look).colors], kept = [...recolorHorse(img, look, { spare }).colors];
  assert.notDeepEqual(bare, kept);
  assert.deepEqual([...recolorHorse(img, look).colors], bare);
  assert.deepEqual([...recolorHorse(img, look, { spare }).colors], kept);
  const fresh = { ...img, colors: new Uint8Array(img.colors) };
  assert.deepEqual([...recolorHorse(fresh, look, { spare }).colors], kept, 'as a fresh picture is');
});

test('AUDIT-STOREFRONT a rider\'s sprite dyed: its rider spared and its view said, so a back quarter shows no heart (mutant: the view unsaid)', NEEDS_ARENA2, async () => {
  const riders = await ridersReady(), key = '112382_3-0', img = await picture(key), horse = withMountLook(0, 'automaton');
  const spare = riderSpareOf(riders, key, img.width, img.height);
  const s = { key, horse, view: 3 };
  assert.deepEqual([...lookedPixels(s, img, riders).colors], [...recolorHorse(img, horse, { spare, view: 3 }).colors]);
  assert.notDeepEqual([...lookedPixels(s, img, riders).colors], [...recolorHorse(img, horse, { spare }).colors], 'the view changes it: no heart from behind');
  assert.equal(lookedPixels({ key, horse: 0, view: 3 }, img, riders), img, 'the bay as drawn: no pass');
});

test('AUDIT-STOREFRONT the rider table is loaded on the first dye, never at boot (mutant: the table in the boot bundle)', () => {
  const sprite = rd('src/player/eyeOfTheBeholder/eotbSprite.js');
  assert.match(sprite, /import\('\.\/eotbRiderMasks\.js'\)/);
  for (const f of ['src/player/eyeOfTheBeholder/eotbSprite.js', 'src/player/eyeOfTheBeholder/eotbBody.js', 'src/net/peer/peerRiders.js']) assert.doesNotMatch(rd(f), /from '[./]*eotbRiderMasks\.js'/, `${f}: never a static import`);
});
