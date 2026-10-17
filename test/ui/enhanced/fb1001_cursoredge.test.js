// FIELD BUGS 2026-10-01 part five (CURSOR-EDGE) - #bug-reports, Skibbster: "Menu scrollbars change the custom cursor
// back to the default cursor when hovered over" - "This also happens when you move your cursor far enough to the right
// of the screen."
//
// Two Chromium laws, both measured in Chromium 141 under Xvfb - the X server's own cursor read back through XFixes
// while a real pointer moved over the Settings page:
//   - A NATIVE scrollbar always shows the platform arrow: Blink picks the pointer for any scrollbar that is not a
//     custom (::-webkit-scrollbar) one, whatever `cursor` the scroller wears (cursor: none too). A CUSTOM scrollbar's
//     parts take their own style's cursor, inherited from the scroller - the gauntlet. Since Chromium 121 the native
//     one is drawn wherever scrollbar-color or scrollbar-width (other than none) applies, and scrollbar-color
//     INHERITS: `.shell, .px-win { scrollbar-color }` turned the shipped ::-webkit-scrollbar dress off for every
//     scroller in every menu (the Settings list: a 15 px native bar, the OS arrow over it).
//   - A custom cursor image over 32 DIP on either side is dropped for the next in its list (`auto`, the OS arrow)
//     wherever it would not lie wholly inside the viewport - Blink's large-cursor intervention. The gauntlet was
//     31x34: within 31 px of the right edge (and 34 px of the foot) it was the OS arrow; the classic CURSOR.IMG at 2x
//     was the same within 64 px.
// The fix: the cursor art at most 32 DIP a side, every scrollbar on the page a custom one in a WebKit/Blink browser
// (the standard properties only where ::-webkit-scrollbar is not supported - Firefox), and the classic arrow cropped
// to what it draws and scaled only as far as 32 DIP allows.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CURSOR_CSS, GAUNTLET_POINT, GAUNTLET_PRESS } from '../../../src/ui/plus/plusCursor.js';
import { ENHANCED_CSS } from '../../../src/ui/enhanced/enhancedStyle.js';
import { PLUS_CSS } from '../../../src/ui/enhanced/enhancedPlusStyle.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

/** A PNG data URI's pixel size, from its IHDR. */
const pngSize = (uri) => {
  const b = Buffer.from(uri.replace(/^data:image\/png;base64,/, ''), 'base64');
  assert.equal(b.toString('latin1', 12, 16), 'IHDR');
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
};

test('CURSOR-EDGE: every gauntlet frame the page wears is at most 32 DIP a side, so Chromium never trades it for the OS arrow at the edge', () => {
  // every image in the cursor rules, at the density it is declared at (a bare url() is 1x)
  const found = [...CURSOR_CSS.matchAll(/url\("(data:image\/png;base64,[^"]+)"\)(\s*([\d.]+)x)?/g)];
  assert.ok(found.length >= 6, `the gauntlet's rules carry ${found.length} images - re-read this pin`);
  for (const [, uri, , density] of found) {
    const [w, h] = pngSize(uri);
    const k = Number(density ?? 1);
    assert.ok(w / k <= 32 && h / k <= 32, `a ${w}x${h} frame at ${k}x is ${w / k}x${h / k} DIP - Chromium drops it near the right edge and the foot`);
  }
  // the pad's own gauntlet (a drawn element, ui/gamepadInput.js) is boxed to the art
  const [pw, ph] = pngSize(GAUNTLET_POINT);
  assert.deepEqual(pngSize(GAUNTLET_PRESS), [pw, ph], 'both frames one size');
  const pad = read('src/ui/gamepadInput.js');
  assert.match(pad, new RegExp(`style\\.width = plusNow \\? '${pw}px'`));
  assert.match(pad, new RegExp(`style\\.height = plusNow \\? '${ph}px'`));
});

test('CURSOR-EDGE / CLASSIC-CURSOR: the classic arrow - DFU\'s Cursor2.png - is at most 32 DIP a side as it is worn, at 1x (mutant: a density or a scale put on it)', async () => {
  const { MAX_CURSOR_DIP, classicCursorCss } = await import('../../../src/ui/cursor.js');
  assert.equal(MAX_CURSOR_DIP, 32);
  const png = readFileSync(join(root, 'public/art/dfu-cursor/Cursor2.png'));
  assert.equal(png.toString('latin1', 12, 16), 'IHDR');
  const [w, h] = [png.readUInt32BE(16), png.readUInt32BE(20)];
  assert.ok(w <= MAX_CURSOR_DIP && h <= MAX_CURSOR_DIP, `${w}x${h}`);
  const css = classicCursorCss('https://x/art/dfu-cursor/Cursor2.png');
  assert.doesNotMatch(css, /image-set|\dx\b/, 'worn at 1x - a 2x density would ask 64 DIP');
});

/** CSS with every `@supports not selector(::-webkit-scrollbar) { ... }` block taken out. */
const withoutFirefoxBlocks = (css) => {
  const open = /@supports\s+not\s+selector\(::-webkit-scrollbar\)\s*\{/g;
  let out = '', at = 0, m;
  while ((m = open.exec(css))) {
    out += css.slice(at, m.index);
    let depth = 1, i = open.lastIndex;
    for (; i < css.length && depth; i++) depth += css[i] === '{' ? 1 : css[i] === '}' ? -1 : 0;
    at = open.lastIndex = i;
  }
  return out + css.slice(at);
};

test('CURSOR-EDGE: no scroller on the game page is a native scrollbar in Chromium - the standard scrollbar properties live only where ::-webkit-scrollbar does not', () => {
  for (const [name, css] of [['ENHANCED_CSS', ENHANCED_CSS], ['PLUS_CSS', PLUS_CSS]]) {
    const live = withoutFirefoxBlocks(css);
    assert.doesNotMatch(live, /scrollbar-color\s*:/, `${name}: scrollbar-color outside @supports not selector(::-webkit-scrollbar) - it inherits, and turns the ::-webkit-scrollbar dress off under it`);
    assert.doesNotMatch(live, /scrollbar-width\s*:(?!\s*none)/, `${name}: scrollbar-width other than none outside the Firefox block`);
  }
  // and every other sheet the UI writes (chat, dialogs, windows) - a source sweep, so a new sheet is held too
  const dir = join(root, 'src/ui');
  for (const f of readdirSync(dir, { recursive: true }).filter((f) => f.endsWith('.js'))) {
    const live = withoutFirefoxBlocks(readFileSync(join(dir, f), 'utf8'));
    assert.doesNotMatch(live, /scrollbar-color\s*:/, `src/ui/${f}`);
    assert.doesNotMatch(live, /scrollbar-width\s*:(?!\s*none)/, `src/ui/${f}`);
  }
  // one unscoped dress, so a scroller outside .shell and .px-win is a custom (cursor-keeping) scrollbar too
  assert.match(ENHANCED_CSS, /(^|\})\s*::-webkit-scrollbar\s*\{[^}]*width:\s*\d+px/m);
});
