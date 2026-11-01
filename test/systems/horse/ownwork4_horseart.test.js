// OWN-WORK4 (2026-10-31; the owner: "Our goal is no latching onto other mod authors or needing permissions. A proper 1
// to 1 recreation for everything"): THE CART'S HORSE IS OURS (src/systems/horse/horseArt.js). Horse Cart and Cargo
// 1.0.0-rc12's 45 names, sizes, views and frames, each picture built from the player's TEXTURE.495: the rider taken off,
// the flank under his leg filled from the hide, our saddle painted on. Pinned on made-up records so CI needs no ARENA2;
// the last pin builds all 45 from the real data, and prints them, when ARENA2_PATH is set.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

import {
  HORSE_ART_FILES, HORSE_ART_ARCHIVE, HORSE_ART_PALETTE, HORSE_ART_WIDTH, HORSE_ART_STILL_HEIGHT, HORSE_ART_WALK_HEIGHT,
  HORSE_ART_GROUND_GAP, horseArtOf, unpackRiderMask, riderColour, composeHorse, ownHorsePicture,
} from '../../../src/systems/horse/horseArt.js';
import { isCoatPixel } from '../../../src/systems/horse/horseCoats.js';
import { packMask } from '../../../tools/bakeEotbRiders.mjs';
import { horsePictures } from '../../../tools/lib/horsePictures.mjs';

const HIDE = [150, 85, 40];   // a bay's flank
const COAT = [40, 120, 40];   // the rider's green
/** A made-up side view the size of TEXTURE.495 record 2: a body of hide, a rider on it (masked, and green), a leg of
 *  his down the flank, and a brown hilt standing above the seat, joined to the body. */
function sideRecord() {
  const width = 121, height = 91, data = new Uint8Array(width * height * 4), mask = new Uint8Array(width * height);
  const put = (x, y, rgb, his = false) => { data.set([...rgb, 255], (y * width + x) * 4); if (his) mask[y * width + x] = 1; };
  for (let y = 20; y <= 80; y++) for (let x = 10; x <= 110; x++) put(x, y, HIDE);
  for (let y = 0; y <= 35; y++) for (let x = 50; x <= 58; x++) put(x, y, COAT, true);   // the rider, behind the seat
  for (let y = 46; y <= 52; y++) for (let x = 66; x <= 69; x++) put(x, y, COAT, true);   // his leg down the flank
  for (let y = 5; y < 20; y++) put(60, y, HIDE);   // a hilt in the hide's colour, standing on the body
  return { record: { width, height, data }, mask };
}
const at = (pic, x, y) => [...pic.data.subarray((y * pic.width + x) * 4, (y * pic.width + x) * 4 + 4)];

test('OWN-WORK4 the names are the mod\'s: five standing views and a five-view, eight-frame walk, at its sizes', () => {
  assert.equal(HORSE_ART_FILES.length, 45);
  assert.deepEqual(HORSE_ART_FILES.slice(0, 6), ['horse1.png', 'horse2.png', 'horse3.png', 'horse4.png', 'horse5.png', 'Walk.0-1.png']);
  assert.equal(HORSE_ART_FILES.at(-1), 'Walk.4-8.png');
  assert.deepEqual(horseArtOf('horse1.png'), { view: 0, frame: 0, still: true });
  assert.deepEqual(horseArtOf('horse5.png'), { view: 4, frame: 0, still: true });
  assert.deepEqual(horseArtOf('Walk.2-1.png'), { view: 2, frame: 0, still: false });
  assert.deepEqual(horseArtOf('Walk.4-8.png'), { view: 4, frame: 7, still: false });
  for (const bad of ['horse0.png', 'horse6.png', 'Walk.5-1.png', 'Walk.0-9.png', 'Walk.0-0.png', 'saddle.png']) assert.equal(horseArtOf(bad), null, bad);
  assert.deepEqual([HORSE_ART_WIDTH, HORSE_ART_STILL_HEIGHT, HORSE_ART_WALK_HEIGHT], [121, 94, 95], 'horse1..5 are 121x94, the walk 121x95');
  assert.deepEqual([HORSE_ART_ARCHIVE, HORSE_ART_PALETTE], [495, 'ART_PAL.COL'], 'Daggerfall\'s mounted rider set, in the palette its records are drawn in');
});

test('OWN-WORK4 a rider mask unpacks as the bake packed it; the rider is told by his colours too', () => {
  const mask = new Uint8Array(300);
  mask.fill(1, 7, 20); mask.fill(1, 150, 299);
  const out = unpackRiderMask(`20x15:${packMask(mask)}`);
  assert.deepEqual([out.width, out.height], [20, 15]);
  assert.deepEqual([...out.mask], [...mask]);
  assert.equal(riderColour(...COAT), true, 'green cloth is his');
  assert.equal(riderColour(70, 90, 160), true, 'blue cloth');
  assert.equal(riderColour(200, 200, 205), true, 'pale steel');
  assert.equal(riderColour(...HIDE), false, 'the bay\'s hide is the horse\'s');
  assert.equal(riderColour(20, 16, 12), false, 'near-black, the mane\'s');
  assert.equal(riderColour(90, 90, 90), false, 'a dark grey shadow');
});

test('OWN-WORK4 one picture: the rider gone, his leg filled with the hide beside it, the hilt above the seat cleared, our saddle on, the record centred on the ground', () => {
  const { record, mask } = sideRecord();
  const pic = composeHorse(record, mask, 2, HORSE_ART_STILL_HEIGHT);
  assert.deepEqual([pic.width, pic.height], [121, 94]);
  assert.equal(HORSE_ART_GROUND_GAP, 2);
  const drop = 94 - 2 - 91;   // the record's bottom row two above the picture's
  for (let y = 92; y < 94; y++) for (let x = 0; x < 121; x++) assert.equal(at(pic, x, y)[3], 0, `the ground gap (${x},${y})`);
  assert.deepEqual(at(pic, 20, 80 + drop), [...HIDE, 255], 'the hooves\' row stands two rows above the edge');
  assert.deepEqual(at(pic, 20, 60 + drop), [...HIDE, 255], 'the hide away from the saddle is the record\'s own');
  let green = 0, cloth = 0;
  for (let i = 0; i < pic.width * pic.height; i++) {
    const [r, g, b, a] = pic.data.subarray(i * 4, i * 4 + 4);
    if (!a) continue;
    if (r === COAT[0] && g === COAT[1] && b === COAT[2]) green++;
    if (b > r + 20) cloth++;
  }
  assert.equal(green, 0, 'nothing of the rider stays');
  assert.ok(cloth > 150, `our blue saddle cloth is on (${cloth} pixels)`);
  for (let y = 46; y <= 52; y++) for (let x = 66; x <= 69; x++) {
    const px = at(pic, x, y + drop);
    assert.equal(px[3], 255, `his leg's place is filled (${x},${y})`);
    if (px[2] <= px[0]) assert.deepEqual(px, [...HIDE, 255], 'with the hide beside it, never a blend');
  }
  for (let y = 5; y < 20; y++) assert.equal(at(pic, 60, y + drop)[3], 0, `the hilt above the seat is cleared (60,${y})`);
  for (let y = 0; y < 20; y++) for (let x = 50; x <= 58; x++) assert.equal(at(pic, x, y + drop)[3], 0, 'the rider\'s body above the horse');
  for (let i = 0; i < pic.width * pic.height; i++) {
    const [r, g, b, a] = pic.data.subarray(i * 4, i * 4 + 4);
    if (a && !(r === HIDE[0] && g === HIDE[1] && b === HIDE[2])) assert.equal(isCoatPixel(r, g, b), false, `the saddle is in no hide's colour, so no coat dyes it (${r},${g},${b})`);
  }
  assert.equal(composeHorse(record, mask, 2, HORSE_ART_WALK_HEIGHT).height, 95, 'a walk frame is a row taller');
});

test('OWN-WORK4 the picture by its name: TEXTURE.495\'s record for the view, the walk\'s frame, its rider\'s mask; a mask of another size is not his; an unknown name or a missing record rejects', async () => {
  const { record, mask } = sideRecord();
  const asked = [];
  const art = { picture: async (...a) => { asked.push(a); return a[0] === 495 && a[1] === 2 ? record : null; } };
  const masks = async () => ({ '112382_7-0': `121x91:${packMask(mask)}`, '112382_7-3': `121x91:${packMask(mask)}`, '112382_5-0': `10x10:${packMask(new Uint8Array(100).fill(1))}` });
  const still = await ownHorsePicture('horse3.png', { art, masks });
  assert.deepEqual(asked[0], [495, 2, 0, 'ART_PAL.COL']);
  assert.deepEqual([still.width, still.height], [121, 94]);
  assert.deepEqual(still, composeHorse(record, mask, 2, 94), 'the standing view is the walk\'s first frame, unridden');
  const walk = await ownHorsePicture('Walk.2-4.png', { art, masks });
  assert.deepEqual(asked[1], [495, 2, 3, 'ART_PAL.COL'], 'the walk\'s fourth frame');
  assert.deepEqual([walk.width, walk.height], [121, 95]);
  const front = { width: 121, height: 91, data: new Uint8Array(121 * 91 * 4) };   // hide from the top row down
  for (let i = 0; i < 121 * 91; i++) front.data.set([...HIDE, 255], i * 4);
  const sized = await ownHorsePicture('horse1.png', { art: { picture: async () => front }, masks });
  assert.deepEqual(sized, composeHorse(front, null, 0, 94), 'a 10x10 mask over a 121x91 record is not its rider\'s');
  await assert.rejects(ownHorsePicture('saddle.png', { art, masks }), /no horse picture/);
  await assert.rejects(ownHorsePicture('horse1.png', { art, masks }), /TEXTURE\.495 record 0 frame 0 is not in the player's data/);
});

test('OWN-WORK4 all 45 from the real TEXTURE.495, at the mod\'s sizes, and their print', { skip: !process.env.ARENA2_PATH && 'ARENA2_PATH is not set (sh tools/fetch-data.sh)' }, async () => {
  const pictures = horsePictures();
  const hash = createHash('sha256');
  for (const file of HORSE_ART_FILES) {
    const pic = await pictures.picture(file);
    assert.deepEqual([pic.width, pic.height], [121, horseArtOf(file).still ? 94 : 95], file);
    let drawn = 0;
    for (let i = 3; i < pic.data.length; i += 4) drawn += pic.data[i] ? 1 : 0;
    assert.ok(drawn > 1000, `${file}: a horse is drawn (${drawn} pixels)`);
    hash.update(`${file}:${pic.width}x${pic.height}:`).update(pic.data);
  }
  assert.equal(hash.digest('hex').slice(0, 16), PRINT, 'a change to the recipe is a change here');
});
const PRINT = '45a644f9f045662b';
