// CM1-CM2 - RESIDUAL CLASSIC MODALS.
//
// The big named windows were already native. What remained were the
// small windows DFU PUSHES during those flows: DaggerfallMessageBox and
// DaggerfallInputMessageBox. These pins keep the two easiest places for
// that residue to regrow on the shared SPOP.RCI renderer.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ChoiceWindow } from '../src/ui/talkWindow.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (p) => readFileSync(join(root, p), 'utf8');

test('CM1: a no-options ChoiceWindow is a click-anywhere message box, not a keyed menu', () => {
  const notice = new ChoiceWindow({ lines: ['Hello.'] });
  assert.equal(notice.done, false);
  assert.equal(notice.click(), true);
  assert.equal(notice.done, true);

  const menu = new ChoiceWindow({
    lines: ['Choose.'],
    options: [{ code: 'Digit1', label: '1 - yes', action() {} }],
  });
  assert.equal(menu.click(), false, 'a keyed ChoiceWindow is not ClickAnywhereToClose');
  assert.equal(menu.done, false);
});

test('CM1: simple ChoiceWindow notices render through the one native parchment implementation', () => {
  const s = src('src/ui/talkWindow.js');
  assert.match(s, /import \{ layoutMessageBox, drawMessageBox, messageBoxArtLoaded \} from '\.\/messageBox\.js';/);
  assert.match(s, /if \(!this\.options\.length && messageBoxArtLoaded\(\) && font\) \{/);
  assert.match(s, /const box = layoutMessageBox\(font, this\.lines\);/);
  assert.match(s, /if \(drawMessageBox\(renderer, m, font, box\)\) return;/);
});

test('CM2: every pushed rest modal uses classic DaggerfallMessageBox presentation', () => {
  const s = src('src/ui/restWindow.js');
  assert.match(s, /layoutMessageBox, drawMessageBox, messageBoxHit, messageBoxArtLoaded, MB_BUTTONS/);
  for (const state of ['confirm', 'hours', 'hoursRefused', 'refused', 'ended']) {
    assert.ok(s.includes(`'${state}'`), `${state} remains in the modal state set`);
  }
  assert.match(s, /buttons = \[MB_BUTTONS\.Yes, MB_BUTTONS\.No\];/,
    'the illegal-rest confirmation draws BUTTONS.RCI Yes/No');
  assert.match(s, /opts = \{ sizingRows: \[prompt, ` > \$\{'0'\.repeat\(PROMPT_MAX_CHARS\)\}_`\] \};/,
    'the hours field sizes from DaggerfallInputMessageBox MaxCharacters, not the current digits');
  assert.match(s, /this\._box = layoutMessageBox\(font, rows, buttons, opts\);/);
  assert.match(s, /drawMessageBox\(renderer, m, font, this\._box\)/);
});

test('CM2: the rest confirmation buttons use the parchment hit rects', () => {
  const s = src('src/ui/restWindow.js');
  assert.match(s, /const hit = this\._box \? messageBoxHit\(this\._box, vx, vy\) : null;/);
  assert.match(s, /if \(hit === MB_BUTTONS\.Yes\) this\.input\('confirm'\);/);
  assert.match(s, /else if \(hit === MB_BUTTONS\.No\) this\.input\('back'\);/);
});
