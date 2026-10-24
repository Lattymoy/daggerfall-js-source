// FONT-PICK (FIELD BUGS 2026-10-13, a player on Gentoo Linux with the Niri compositor under Wayland: "the font selector is
// a bit buggy on my setup as it has no scrolling ability ... I have 376 fonts recognized by DFO") - pinned. The installed
// font's list was the browser's own <datalist> popup, a surface the system draws outside the page: it ran off the screen
// and took no wheel there. It is the page's own list now - under the field, a fixed height that scrolls, filtered by what
// is typed, each name in its own face, picked by a click or Enter.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fontMatches } from '../../../src/ui/textFont.js';

const menu = readFileSync(new URL('../../../src/ui/enhanced/enhancedMenu.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../../../src/ui/enhanced/enhancedPlusStyle.js', import.meta.url), 'utf8');
const row = menu.slice(menu.indexOf('function systemFontRow(redraw) {'), menu.indexOf('function overhaulPanel(p) {'));

test('FONT-PICK the filter: nothing typed (or the name worn) shows every font; a typed piece shows the names holding it, those beginning with it first, case aside (mutants: the order, the case, the worn name)', () => {
  const fams = ['Arial', 'Bitstream Vera Sans', 'DejaVu Sans', 'DejaVu Serif', 'Noto Sans', 'Sans Forgetica'];
  assert.deepEqual(fontMatches(fams, ''), fams);
  assert.deepEqual(fontMatches(fams, '   '), fams);
  assert.deepEqual(fontMatches(fams, 'DejaVu Sans'), fams, 'the field opens on the name worn: the whole list');
  assert.deepEqual(fontMatches(fams, 'sans'), ['Sans Forgetica', 'Bitstream Vera Sans', 'DejaVu Sans', 'Noto Sans'], 'beginning with it first, then holding it');
  assert.deepEqual(fontMatches(fams, 'DEJA'), ['DejaVu Sans', 'DejaVu Serif']);
  assert.deepEqual(fontMatches(fams, 'zzz'), []);
  const many = Array.from({ length: 376 }, (_, i) => `Font ${String(i).padStart(3, '0')}`);
  assert.equal(fontMatches(many, '').length, 376, 'every one of a long list');
});

test('FONT-PICK the list: the page\'s own, never the browser\'s popup - a listbox under the field that scrolls on its own (the wheel kept from any window under it), each name in its own face; a click picks without the field losing its focus; arrows move, Enter picks, Escape closes; the machine asked once a session (mutants: the datalist back; the wheel let through; the blur under the click; the keys; the list reopened by its own pick)', () => {
  assert.doesNotMatch(row, /datalist|showPicker|setAttribute\('list'/, 'no browser popup');
  assert.match(row, /const pick = el\('div', 'look-fontpick'\);/);
  assert.match(row, /pick\.setAttribute\('role', 'listbox'\);/);
  assert.match(row, /pick\.addEventListener\('wheel', \(e\) => e\.stopPropagation\(\), \{ passive: true \}\);/);
  assert.match(row, /shown = fontMatches\(fontFamiliesSeen, input\.value\);/);
  assert.match(row, /o\.style\.fontFamily = `'\$\{f\}', sans-serif`;/, 'each name in its own face');
  assert.match(row, /o\.onmousedown = \(e\) => e\.preventDefault\(\);/);
  assert.match(row, /o\.onclick = \(e\) => \{ e\.stopPropagation\(\); choose\(f\); \};/);
  assert.match(row, /const choose = \(f\) => \{ input\.value = f; look\(\); close\(\); settle\(\); \};/);
  // the pick's repaint gives the field its focus back (domRepaint's focus: true) - that focus must not open the list again
  assert.match(row, /const settle = \(\) => \{ fontPickShut = true; try \{ keep\(\); \} finally \{ fontPickShut = false; \} \};/);
  assert.match(row, /input\.onfocus = \(\) => \{ if \(fontFamiliesSeen\?\.length && !fontPickShut\) paint\(\); \};/);
  assert.match(row, /input\.oninput = \(\) => \{ look\(\); hi = -1; if \(fontFamiliesSeen\?\.length\) \{ paint\(\); pick\.scrollTop = 0; \} \};/, 'a new filter starts at its top');
  assert.match(row, /if \(e\.key === 'ArrowDown'\) \{ e\.preventDefault\(\); move\(1\); \}/);
  assert.match(row, /else if \(e\.key === 'ArrowUp'\) \{ e\.preventDefault\(\); move\(-1\); \}/);
  assert.match(row, /else if \(e\.key === 'Enter'\) \{ e\.preventDefault\(\); if \(!pick\.hidden && hi >= 0 && shown\[hi\]\) choose\(shown\[hi\]\); else \{ close\(\); settle\(\); \} \}/);
  assert.match(row, /else if \(e\.key === 'Escape' && !pick\.hidden\) \{ e\.preventDefault\(\); close\(\); \}/);
  assert.match(row, /opts\[hi\]\?\.scrollIntoView\?\.\(\{ block: 'nearest' \}\);/, 'the highlighted one kept in view');
  assert.match(row, /if \(!fontFamiliesSeen\?\.length\) fontFamiliesSeen = await installedFamilies\(\);/, 'asked once a session');
  assert.match(css, /\.look-fontpick \{ flex: 1 1 100%; display: flex; flex-direction: column; max-height: 260px; overflow-y: auto; overscroll-behavior: contain;/, 'a fixed height that scrolls');
  assert.match(css, /\.look-fontpick\[hidden\] \{ display: none; \}/);
  assert.match(css, /\.look-fontcount \{ position: sticky; top: 0; z-index: 1;/, 'the count over the names it heads');
});
