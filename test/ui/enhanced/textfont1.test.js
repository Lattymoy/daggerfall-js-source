// TEXT-FONT (2026-10-11): the enhanced skin's words in a face the player picks - Game, Sans, Monospace, Dyslexic or one
// of their own installed fonts (ui/textFont.js). (A name stands apart from its words by colour - test/chatcolours1.)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { TEXT_FONTS, TEXT_STACKS, KEEP_SELECTORS, DYSLEXIC_DIR, cleanFamily, wordStack, textFontCss } from '../../../src/ui/textFont.js';
import { PREF_DEFAULTS } from '../../../src/systems/uiPrefs.js';

test('TEXT-FONT choices: the five the player asked for, the game\'s own the default', () => {
  assert.deepEqual(Object.keys(TEXT_FONTS), ['game', 'sans', 'mono', 'dyslexic', 'system']);
  assert.equal(PREF_DEFAULTS.textFont, 'game');
  assert.equal(PREF_DEFAULTS.textFontSystem, '');
  assert.ok(!('nameFont' in PREF_DEFAULTS), 'names follow the words\' face - the colour sets them apart');
  assert.match(TEXT_STACKS.sans, /sans-serif$/);
  assert.match(TEXT_STACKS.mono, /monospace$/);
  assert.match(TEXT_STACKS.dyslexic, /^'OpenDyslexic'/);
});

test('TEXT-FONT the game\'s own face writes no override', () => {
  const css = textFontCss('game', '');
  assert.doesNotMatch(css, /--dfo-text-font/);
  assert.doesNotMatch(css, /font-family/);
  assert.equal(wordStack('game'), null);
  assert.equal(wordStack('system', ''), null, "'My font' with no name yet is the game's own");
});

test('TEXT-FONT a chosen face: every element but the wordmark, over the skin\'s own rules - names too', () => {
  const css = textFontCss('sans', '');
  const over = css.split('\n').find((l) => l.includes('var(--dfo-text-font) !important'));
  assert.ok(over, 'the words\' rule');
  for (const q of KEEP_SELECTORS) assert.ok(over.includes(q), `${q} keeps its own face`);
  assert.ok(!over.includes('dfchat-name'), 'a name is in the words\' face');
  assert.match(css, /--dfo-text-font: system-ui/);
});

test('TEXT-FONT an installed font: its name made safe for a quoted family', () => {
  assert.equal(cleanFamily('  Comic   Sans MS '), 'Comic Sans MS');
  assert.equal(cleanFamily("x'; } body { display:none"), 'x  body  display:none'.replace(/\s+/g, ' '));
  assert.equal(cleanFamily('a'.repeat(100)).length, 64);
  assert.match(textFontCss('system', 'DejaVu Serif'), /--dfo-text-font: 'DejaVu Serif', system-ui/);
});

test('TEXT-FONT Dyslexic: OpenDyslexic shipped under public/ with its licence, faced only when chosen', () => {
  const dir = new URL(`../../../public/${DYSLEXIC_DIR}/`, import.meta.url);
  for (const f of ['opendyslexic-latin-400-normal.woff2', 'opendyslexic-latin-700-normal.woff2', 'OFL.txt']) assert.ok(existsSync(new URL(f, dir)), f);
  assert.match(readFileSync(new URL('OFL.txt', dir), 'utf8'), /SIL Open Font License/);
  assert.match(textFontCss('dyslexic', ''), /@font-face \{ font-family: 'OpenDyslexic'; font-weight: 400;/);
  assert.doesNotMatch(textFontCss('sans', ''), /@font-face/);
});

test('TEXT-FONT worn with the look, offered on its card', () => {
  const plus = readFileSync(new URL('../../../src/ui/enhanced/enhancedPlusStyle.js', import.meta.url), 'utf8');
  assert.match(plus, /mountTextFont\(doc\);   \/\/ TEXT-FONT: under either look/);
  const menu = readFileSync(new URL('../../../src/ui/enhanced/enhancedMenu.js', import.meta.url), 'utf8');
  assert.match(menu, /choiceRow\('Text font', TEXT_FONTS, textFont\(\)/);
  assert.match(menu, /if \(textFont\(\) === 'system'\) card\.append\(systemFontRow\(render\)\)/);
  assert.doesNotMatch(menu, /'Player names'/);
});
