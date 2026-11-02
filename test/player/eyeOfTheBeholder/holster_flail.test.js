import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { uprightFlailPicture, isFlailItem, FLAIL_BACK_GAP } from '../../../src/player/eyeOfTheBeholder/eotbHolsterFlail.js';
import { uprightWeaponPicture } from '../../../src/player/eyeOfTheBeholder/eotbHolster.js';
import { createWeapon } from '../../../src/combat/enemyEquipment.js';
import { WEAPONS } from '../../../src/characters/weapons.js';

// a flail as the doll draws it: the handle, its longest line, along row 20 with the hand's gap (x 4-7), its cap at x
// 49; the chain hangs off the cap's side, its ball at the far end - blue handle, red chain and ball
const doll = () => {
  const W = 60, H = 50, colors = new Uint8Array(W * H * 4);
  for (let x = 0; x < 50; x++) if (x < 4 || x > 7) colors.set([0, 0, 255, 255], (20 * W + x) * 4);
  for (let y = 21; y < 34; y++) colors.set([255, 0, 0, 255], (y * W + 49) * 4);
  for (let y = 34; y < 40; y++) for (let x = 46; x <= 52; x++) colors.set([255, 0, 0, 255], (y * W + x) * 4);
  return { width: W, height: H, colors };
};
const pxOf = (pic, red) => {
  const out = [];
  for (let row = 0; row < pic.height; row++) for (let col = 0; col < pic.width; col++) {
    const i = (row * pic.width + col) * 4;
    if (pic.colors[i + 3] && (red ? pic.colors[i] > 200 && pic.colors[i + 2] < 60 : pic.colors[i + 2] > 200 && pic.colors[i] < 60)) out.push([col, row]);
  }
  return out;
};

test('FLAIL-BACK (2026-10-31, the owner: "The flail when holstered on the back needs to look different. Adjust the placement of the ball and chain"): the handle stands cap up and whole, the chain hangs from the cap down beside it', () => {
  const pic = uprightFlailPicture(doll()), blue = pxOf(pic, false), red = pxOf(pic, true);
  assert.ok(blue.length > 5 && red.length > 5, `both drawn (${blue.length} handle, ${red.length} chain)`);
  // row 0 is the bottom: the cap is the handle's top
  const rows = blue.map((p) => p[1]), top = Math.max(...rows), foot = Math.min(...rows);
  for (let r = foot; r <= top; r++) assert.ok(rows.includes(r), `the handle whole, its hand's gap bridged (row ${r})`);
  assert.ok(Math.min(...red.map((p) => p[0])) > Math.max(...blue.map((p) => p[0])) - 1 + FLAIL_BACK_GAP, 'the chain beside the handle, never across it');
  const redTop = Math.max(...red.map((p) => p[1])), redFoot = Math.min(...red.map((p) => p[1]));
  assert.ok(top - redTop <= 1, `hung from the cap (its top row ${redTop}, the cap's ${top})`);
  assert.ok(redTop - redFoot >= 4 && redFoot < top - 2, 'down from it, the ball below');
  // as the doll stood it up, the chain ran across the top
  const was = uprightWeaponPicture(doll()), wasRed = pxOf(was, true), wasRows = wasRed.map((p) => p[1]);
  assert.ok(Math.max(...wasRows) - Math.min(...wasRows) < redTop - redFoot, 'not the doll\'s sideways chain');
  assert.ok(isFlailItem(createWeapon(WEAPONS.Flail, 0, () => 0.5)) && !isFlailItem(createWeapon(WEAPONS.Mace, 0, () => 0.5)), 'a flail is one, a mace is not');
});

test('FLAIL-BACK: my body and every walker take the back\'s picture through the flail\'s door', () => {
  for (const f of ['src/player/eyeOfTheBeholder/eotbBody.js', 'src/net/peer/peerRiders.js']) {
    assert.match(readFileSync(new URL(`../../../${f}`, import.meta.url), 'utf8'), /loadHolster = loadBackPicture/, f);
  }
});
