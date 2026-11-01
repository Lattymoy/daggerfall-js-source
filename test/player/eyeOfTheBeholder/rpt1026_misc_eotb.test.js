// RPT1026-MISC SPELL-SHORT (a private report: the Fighter Mage (female) skin shrank in third person while casting, and no
// other skin the reporter tried did). The
// Eye of the Beholder mod's set 10 draws its spell sheets (records 45-59) with the woman 80 pixels hood to boot, where
// her idle is 110, and its XML scales them 1.0 - she shrank by a quarter as a spell came up. Measured on the art itself,
// sized through the real door (eotbSprite.js spriteOffset + spriteSize) every caller that draws the body uses.
// OWN-AUDIT: the author's XML is gone; the scale and the shift are our law's (eotbAnchor.js).
// NO-BETHESDA2: set 10's idle and spell sheets are Daggerfall's own TEXTURE.475 records, rebuilt from the
// player's ARENA2 (tools/lib/eotbPictures.mjs), so the measure runs where ARENA2_PATH is set; the scale table runs in CI.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spriteOffset, spriteSize, eotbRecordScale, SIZE_ON_FOOT } from '../../../src/player/eyeOfTheBeholder/eotbSprite.js';
import EOTB_ANCHORS from '../../../src/player/eyeOfTheBeholder/eotbAnchors.json' with { type: 'json' };
import { ARCHIVE_FOOT, STATE_TABLES } from '../../../src/player/eyeOfTheBeholder/eotbBillboard.js';
import { eotbPictures } from '../../../tools/lib/eotbPictures.mjs';

const EOTB = eotbPictures();
const png = (archive, record, frame = 0) => EOTB.picture(`${archive}_${record}-${frame}`);
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
async function figureMetres(archive, record, frame = 0) {
  const im = await png(archive, record, frame);
  const xml = spriteOffset(archive, record);
  const size = spriteSize(im.width, im.height, { riding: false }, xml.scale);
  return (hoodToBoot(im) / im.height) * size.h;
}

test('RPT1026-MISC SPELL-SHORT: the Fighter Mage (female) stands as tall with a spell up - readied, walking and casting - as at rest, from every side (mutants: rpt1026-misc-spell-short-unscaled, rpt1026-misc-spell-short-unread)', { skip: !process.env.ARENA2_PATH && 'ARENA2_PATH not set' }, async () => {
  const set10 = ARCHIVE_FOOT + 10;
  const idle = await figureMetres(set10, STATE_TABLES.Idle.base);
  for (const table of ['IdleSpell', 'MoveSpell', 'AttackSpell']) {
    for (let side = 0; side < 5; side++) {
      const record = STATE_TABLES[table].base + side;
      const h = await figureMetres(set10, record);
      assert.ok(Math.abs(h / idle - 1) < 0.06, `${table} record ${record}: ${h.toFixed(3)} m against the idle's ${idle.toFixed(3)} m`);
    }
  }
  // the casting frames too, not only each record's first
  for (const frame of [1, 2, 3]) assert.ok(Math.abs(await figureMetres(set10, STATE_TABLES.AttackSpell.base, frame) / idle - 1) < 0.06, `cast frame ${frame}`);
  // the report's case before the fix: drawn as the XML had it, she lost a quarter of her height
  const im = await png(set10, 55, 2);
  const asDrawn = (hoodToBoot(im) / im.height) * spriteSize(im.width, im.height, { riding: false }, 1).h;
  assert.ok(asDrawn / idle < 0.8, `at the XML's scale 1 the cast stands ${(asDrawn / idle).toFixed(2)} of her height`);
});

test('RPT1026-MISC SPELL-SHORT: set 10\'s spell sheets carry the scale they were drawn at, measured by our law, their shift its own; no other set or record moves (mutants: rpt1026-misc-spell-short-unscaled, rpt1026-misc-spell-short-unread, rpt1026-misc-spell-short-xml-lost)', () => {
  const set10 = ARCHIVE_FOOT + 10;
  const [right, up] = EOTB_ANCHORS.shift[`${set10}_45`];
  assert.deepEqual(spriteOffset(set10, 45), { scale: 80 / 110, x: right * SIZE_ON_FOOT, y: up * SIZE_ON_FOOT });
  assert.notEqual(right, 0, 'the readied spell stands off its picture\'s middle, and is moved');
  // the rest of her sets are drawn at her idle's scale: her walk and her blade, and the other women's spells
  for (const record of [0, 5, 15, 25, 30, 40]) assert.equal(eotbRecordScale(set10, record), 1, `record ${record}`);
  for (const set of [0, 2, 4, 6, 8, 11, 12, 14]) for (const record of [45, 50, 55]) assert.equal(spriteOffset(ARCHIVE_FOOT + set, record).scale, 1, `set ${set} record ${record}`);
  const spell = Array.from({ length: 15 }, (_, i) => `${set10}_${45 + i}`);
  assert.deepEqual(Object.keys(EOTB_ANCHORS.scale).sort(), spell.sort(), 'over every set, these fifteen records alone are drawn small');
});
