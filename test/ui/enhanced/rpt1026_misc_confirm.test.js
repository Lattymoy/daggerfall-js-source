// RPT1026-MISC CONFIRM-SHEET (a private report: Remove data on the Morrowind card seemed to do nothing, and said nothing).
// Every destructive press on the Settings screen asks first - the
// Morrowind card's Remove data, a pack's remove, All off, Reset everything, a tab's Restore defaults - and its question is
// a card in the screen's detail pane. In the pause menu's Settings (and on a narrow or touch screen) that pane is a SHEET,
// below the screen until it is opened (enhancedStyle.js `.px-setwrap .detail` / `.detail.open`), and the ask set the card
// without opening it: the press changed nothing anyone could see. Driven through the mounted pause screen.
import '../../chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { byClass } from '../../chargenDom.mjs';
import { mountEnhancedMenu } from '../../../src/ui/enhanced/enhancedMenu.js';

console.warn = () => {};
globalThis.window ??= globalThis;

/** Every node under `root` whose own text is `words`, deepest first. */
const withText = (root, words) => root.querySelectorAll('*').filter((n) => n.textContent === words).reverse();
const press = (root, words) => {
  // a rail's row wears its mark before its word ("\u25c6Settings")
  const b = root.querySelectorAll('*').reverse().find((n) => (n.tagName === 'BUTTON' || typeof n.onclick === 'function') && n.textContent.endsWith(words));
  assert.ok(b, `a button "${words}"`);
  b.onclick ? b.onclick({ stopPropagation() {}, preventDefault() {} }) : b.click();
};
const sheets = (root) => byClass(root, 'detail');

test('RPT1026-MISC CONFIRM-SHEET: a confirm asked on the pause menu\'s Settings opens the sheet it is drawn in, and its answer closes it again (mutant: rpt1026-misc-confirm-sheet-shut)', () => {
  const host = globalThis.document.createElement('div');
  globalThis.document.body.append(host);
  const menu = mountEnhancedMenu(host, { mode: 'pause', hooks: {}, onAction: () => {} });
  try {
    press(host, 'Settings');
    assert.ok(byClass(host, 'px-setwrap').length, 'the pause menu\'s Settings, in its own wrap - whose detail is a sheet');
    const [before] = sheets(host);
    assert.ok(before && !before.className.split(/\s+/).includes('open'), 'the sheet stands shut');
    press(host, 'Reset everything to defaults');
    const [sheet] = sheets(host);
    assert.ok(withText(sheet, 'Reset Everything').length, 'the question is in the sheet');
    assert.ok(sheet.className.split(/\s+/).includes('open'), '...and the sheet is open, so it is seen');
    press(sheet, 'Cancel');
    const [after] = sheets(host);
    assert.equal(withText(after, 'Reset Everything').length, 0, 'answered, the question goes');
    assert.ok(!after.className.split(/\s+/).includes('open'), 'and the sheet it raised goes down with it');
  } finally { menu?.unmount?.(); host.remove(); }
});
