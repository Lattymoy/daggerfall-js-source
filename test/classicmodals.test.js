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
import { RestWindow } from '../src/ui/restWindow.js';
import { PROMPT_INITIAL } from '../src/systems/restSession.js';

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
  // a keyed menu answers a click on one of its ROWS (the mouse audit's
  // hit map, drawn on the flat panel) and swallows every other; it is
  // never click-anywhere
  assert.equal(menu.click(0, 0), true, 'swallowed, not answered');
  assert.equal(menu.done, false, 'a keyed ChoiceWindow is not ClickAnywhereToClose');
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
  assert.match(s, /rows = \[\{ text: `\$\{prompt\}\$\{this\.value\}_`, center: false \}\];/, 'the prompt is the field\'s LABEL on the field\'s own row (SetTextBoxLabel :616)');
  assert.match(s, /opts = \{ sizingRows: \[\{ text: `\$\{prompt\}\$\{'M'\.repeat\(PROMPT_MAX_CHARS\)\}_`, center: false \}\] \};/,
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

test('AUDIT-CM: the rest prompt behaves as the box - "0" seeded, digits typed, Escape back to the selection, and an EMPTY Return lands on the selection too (the box closed first, :298-304; TryParse fails, :742-744)', () => {
  const w = new RestWindow({ endLines: () => ['finished'], onClose: () => {}, entity: { stats: {}, skills: {} } });
  w.input('char:3');   // Loiter: the prompt without CanRest's gate
  assert.equal(w.state, 'hours'); assert.equal(w.mode, 'loiter'); assert.equal(w.value, PROMPT_INITIAL, 'TextBox.Text = "0" (:700)');
  w.input('backspace'); w.input('char:1'); w.input('char:2'); w.input('char:x');
  assert.equal(w.value, '12', 'digits only');
  w.input('back');
  assert.equal(w.state, 'selection', 'Escape closes the box');
  w.input('char:3'); w.input('backspace');
  assert.equal(w.value, '');
  w.input('confirm');
  assert.equal(w.state, 'selection', 'an empty answer: the box has closed, TryParse fails, nothing starts');
  assert.equal(w.value, PROMPT_INITIAL);
});
