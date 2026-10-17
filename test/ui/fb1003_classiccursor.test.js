// CLASSIC-CURSOR (FIELD BUGS 2026-10-03, Skibbster on Discord: "When using classic mode, the cursor stays as the system
// default instead of using the classic cursor like in DFU"). DFU reads no cursor out of ARENA2 - its arrow is Unity's
// defaultCursor, Assets/Resources/Cursor2.png - and the port read a CURSOR.IMG the usual game data does not carry, only
// once the data was in. Now DFU's own arrow, vendored byte for byte, is laid at boot on the classic skin, over every
// element, and is the pad's arrow too (controllerCursorImage).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { PNG } from 'pngjs';
import { installCursor, dfuCursorUrl, DFU_CURSOR_FILE, DFU_CURSOR_HOTSPOT } from '../../src/ui/cursor.js';

const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url));

test('CLASSIC-CURSOR the art: DFU\'s Cursor2.png byte for byte at the listing\'s commit - 32x32, the three blues, its tip at the hotspot (0,0) (mutants: another file; the hotspot moved)', () => {
  const listing = JSON.parse(rd('vendor/dfu-cursor/dfu-cursor.files.json'));
  assert.deepEqual(listing.Files, ['Assets/Resources/Cursor2.png']);
  assert.equal(listing.Commit, '2343305d1d83ccc0de57a81e3b1e61188a997e34', 'the commit vendor/dfu-icons pins');
  const bytes = rd(`public/${DFU_CURSOR_FILE}`);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), listing.Sha256['Cursor2.png']);
  const png = PNG.sync.read(bytes);
  assert.deepEqual([png.width, png.height], listing.Size['Cursor2.png']);
  assert.deepEqual([png.width, png.height], [32, 32]);
  const colours = new Set();
  for (let i = 0; i < png.data.length; i += 4) if (png.data[i + 3]) colours.add(`${png.data[i]},${png.data[i + 1]},${png.data[i + 2]}`);
  assert.deepEqual([...colours].sort(), ['105,154,219', '146,186,247', '178,207,255'], 'the blue arrow of the report');
  assert.deepEqual(DFU_CURSOR_HOTSPOT, [0, 0]);
  assert.ok(png.data[3] > 0, 'the tip is the top-left pixel - the hotspot points with it');
  assert.equal(dfuCursorUrl('https://x/play/'), 'https://x/play/art/dfu-cursor/Cursor2.png');
});

test('CLASSIC-CURSOR the boot: the arrow is laid before the renderer, with no game data asked - the front menu wears it - and the old CURSOR.IMG read is gone; the pad\'s arrow is the same art (mutants: laid after the data; the pad\'s own arrow)', () => {
  const main = rd('src/main.js').toString();
  assert.match(main, /\n {2}installCursor\(\);[^\n]*\n {2}const canvas = document\.getElementById\('c'\);\n {2}const renderer = new Renderer\(canvas\);/);
  assert.doesNotMatch(main, /installCursor\(getBytes\)/);
  assert.doesNotMatch(rd('src/ui/cursor.js').toString(), /CURSOR\.IMG'|fetchBytes/, 'DFU reads no cursor from the game\'s files');
  const pad = rd('src/ui/gamepadInput.js').toString();
  assert.match(pad, /const CURSOR_ART = dfuCursorUrl\(\);/);
  assert.match(pad, /cursorEl\.style\.backgroundImage = `url\("\$\{plusNow \? GAUNTLET_POINT : CURSOR_ART\}"\)`;/);
  // and a page with no head (a test's stub) is left alone
  assert.equal(installCursor({}, { classic: true }), false);
});
