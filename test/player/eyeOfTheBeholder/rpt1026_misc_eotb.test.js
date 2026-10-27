// RPT1026-MISC SPELL-SHORT (a private report: the Fighter Mage (female) skin shrank in third person while casting, and no
// other skin the reporter tried did). The
// Eye of the Beholder mod's set 10 draws its spell sheets (records 45-59) with the woman 80 pixels hood to boot, where
// her idle is 110, and its XML scales them 1.0 - she shrank by a quarter as a spell came up. Measured on the vendored art
// itself (the producer: the mod's own PNGs and spriteInfo.json, read through pngjs), sized through the real door
// (eotbSprite.js spriteOffset + spriteSize) every caller that draws the body uses.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { spriteOffset, spriteSize, eotbRecordScale } from '../../../src/player/eyeOfTheBeholder/eotbSprite.js';
import { ARCHIVE_FOOT, STATE_TABLES } from '../../../src/player/eyeOfTheBeholder/eotbBillboard.js';

const { PNG } = createRequire(import.meta.url)('pngjs');
const png = (archive, record, frame = 0) => PNG.sync.read(readFileSync(new URL(`../../../vendor/eye-of-the-beholder/Textures/${archive}/${archive}_${record}-${frame}.png`, import.meta.url)));
/** The figure's height in pixels: the first row with a hood's green (over red and blue) down to the last opaque row -
 *  the woman herself, whatever her arm and her sword do above the hood. */
function hoodToBoot(im) {
  let top = -1, bot = -1;
  for (let y = 0; y < im.height; y++) for (let x = 0; x < im.width; x++) {
    const s = (y * im.width + x) * 4;
    if (im.data[s + 3] === 0) continue;
    bot = y;
    const [r, g, b] = [im.data[s], im.data[s + 1], im.data[s + 2]];
    if (top < 0 && g > 90 && g > r + 25 && g > b + 25) top = y;
  }
  return bot - top + 1;
}
/** Her height in metres as the body draws a record: the figure's pixels over the record's scale, times the size mod. */
function figureMetres(archive, record, frame = 0) {
  const im = png(archive, record, frame);
  const xml = spriteOffset(archive, record);
  const size = spriteSize(im.width, im.height, { riding: false }, xml.scale);
  return (hoodToBoot(im) / im.height) * size.h;
}

test('RPT1026-MISC SPELL-SHORT: the Fighter Mage (female) stands as tall with a spell up - readied, walking and casting - as at rest, from every side; no other set or record moves (mutants: rpt1026-misc-spell-short-unscaled, rpt1026-misc-spell-short-unread)', () => {
  const set10 = ARCHIVE_FOOT + 10;
  const idle = figureMetres(set10, STATE_TABLES.Idle.base);
  for (const table of ['IdleSpell', 'MoveSpell', 'AttackSpell']) {
    for (let side = 0; side < 5; side++) {
      const record = STATE_TABLES[table].base + side;
      const h = figureMetres(set10, record);
      assert.ok(Math.abs(h / idle - 1) < 0.06, `${table} record ${record}: ${h.toFixed(3)} m against the idle's ${idle.toFixed(3)} m`);
    }
  }
  // the casting frames too, not only each record's first
  for (const frame of [1, 2, 3]) assert.ok(Math.abs(figureMetres(set10, STATE_TABLES.AttackSpell.base, frame) / idle - 1) < 0.06, `cast frame ${frame}`);
  // the mod's XML offset is kept, and grows with the figure it centres
  assert.deepEqual(spriteOffset(set10, 45), { scale: 80 / 110, x: 0.52, y: 0 });
  // the rest of her sets are the mod's own: her walk and her blade, and the other women's spells
  for (const record of [0, 5, 15, 25, 30, 40]) assert.equal(eotbRecordScale(set10, record), 1, `record ${record}`);
  for (const set of [0, 2, 4, 6, 8, 11, 12, 14]) for (const record of [45, 50, 55]) assert.equal(spriteOffset(ARCHIVE_FOOT + set, record).scale, 1, `set ${set} record ${record}`);
  // the report's case before the fix: drawn as the XML had it, she lost a quarter of her height
  const im = png(set10, 55, 2);
  const asDrawn = (hoodToBoot(im) / im.height) * spriteSize(im.width, im.height, { riding: false }, 1).h;
  assert.ok(asDrawn / idle < 0.8, `at the XML's scale 1 the cast stands ${(asDrawn / idle).toFixed(2)} of her height`);
});
