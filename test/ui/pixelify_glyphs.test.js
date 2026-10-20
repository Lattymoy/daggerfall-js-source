// TWO (2026-10-18): the enhanced skin's 2 and Z are our own glyphs, served as a second face of 'Pixelify Five' over
// U+0032 and U+005A, so the two no longer read alike.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PIXELIFY_FIVE_FACE, PIXELIFY_GLYPHS_WOFF2_BASE64, PIXELIFY_FIVE_WOFF2_BASE64, PIXEL_STACK } from '../../src/ui/pixelifyFive.js';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const TWO_RULE = /@font-face \{ font-family: 'Pixelify Five'; unicode-range: U\+0032, U\+005A; font-display: (swap|block); src: url\(data:font\/woff2;base64,([A-Za-z0-9+/=]+)\) format\('woff2'\); \}/;

test('TWO: the face carries the five first and then the 2 and the Z, each face over its own code points, in the same family', () => {
  const [five, two] = PIXELIFY_FIVE_FACE.split('\n');
  assert.match(five, /unicode-range: U\+0035;/);
  assert.ok(five.includes(PIXELIFY_FIVE_WOFF2_BASE64));
  assert.equal(two.match(TWO_RULE)?.[2], PIXELIFY_GLYPHS_WOFF2_BASE64);
  assert.equal(PIXEL_STACK, "'Pixelify Five', 'Pixelify Sans', monospace", 'the stack is unchanged - the family already stands first');
});

test('TWO: the data URI is the vendored file byte for byte - a woff2 of two glyphs', () => {
  const bytes = Buffer.from(PIXELIFY_GLYPHS_WOFF2_BASE64, 'base64');
  assert.equal(bytes.subarray(0, 4).toString('latin1'), 'wOF2');
  assert.ok(bytes.length < 1024, `${bytes.length} bytes`);
  assert.deepEqual([...bytes], [...readFileSync(new URL('../../vendor/pixelify-glyphs/pixelify-glyphs.woff2', import.meta.url))]);
  assert.match(read('vendor/pixelify-glyphs/README.md'), /tools\/pixelifyGlyphs\.py/);
  const tool = read('tools/pixelifyGlyphs.py');
  assert.match(tool, /TWO = \{6: \[1, 2, 3\], 5: \[0, 4\], 4: \[3, 4\], 3: \[2, 3\], 2: \[1, 2\], 1: \[0, 1\], 0: \[0, 1, 2, 3, 4\]\}/, 'the 2: a rounded top and a stepped diagonal');
  assert.match(tool, /COLS = \[\(60, 150\), \(150, 240\), \(240, 331\), \(331, 440\), \(440, 531\)\]/, 'on the weight-500 grid the skin reads in');
  assert.match(tool, /ZED = \{6: \[0, 1, 2, 3, 4\], 0: \[0, 1, 2, 3, 4\]\}\nZED_DIAGONAL = \(\(531, 544\), \(60, 77\)\)/, 'the Z: a flat top and base, one straight diagonal');
});

test('TWO: the landing page and the launcher carry the same two', () => {
  for (const p of ['index.html', 'app/launcher/launcher.css']) {
    assert.equal(read(p).match(TWO_RULE)?.[2], PIXELIFY_GLYPHS_WOFF2_BASE64, p);
  }
});
