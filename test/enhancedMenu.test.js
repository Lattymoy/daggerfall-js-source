// THE ENHANCED FRONT DOOR, pinned.
//
// These are SOURCE SWEEPS and say so. The screen is DOM and the boot
// is a host, neither of which node can drive; the behaviour is proven
// in a real browser by tools/enhancedMenuProbe.mjs, which boots the
// game with no ARENA2 at all. What a sweep CAN hold is the structure
// the browser check would not notice going wrong: a second copy of the
// design, a data gate that drifts back in front of the door, or an
// exit where there should not be one.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

// THE ENHANCED BRANCH ALONE. Two of the first pins here SURVIVED their
// mutations because they searched the whole of main.js and matched the
// CLASSIC branch's identical lines instead - main.js carries a data
// gate and a `params.delete('load')` on both paths, so a sweep that
// does not scope reads the wrong one and reports the right answer for
// the wrong reason. Every assertion about the enhanced door is made
// against this slice only.
function enhancedBranch() {
  const src = read('src/main.js');
  const from = src.indexOf('if (isEnhanced()) {');
  assert.ok(from > 0, 'main.js lost its enhanced front door');
  const to = src.indexOf('\n  }', from);
  assert.ok(to > from, 'the enhanced branch is unclosed');
  return src.slice(from, to);
}

// ── ONE IMPLEMENTATION, TWO HOSTS ────────────────────────────────
// The prototype at /menu.html and the game mount the SAME module. A
// prototype carrying its own copy of the design is a prototype arguing
// about a screen the player will never see, and the divergence would
// be invisible until someone opened both at once.
test('the prototype page carries no design of its own', () => {
  const html = read('menu.html');
  assert.ok(!/--brass|--verdigris|\.railbtn|\.subbtn/.test(html),
    'menu.html must not hold tokens or layout - they live in src/ui/enhancedStyle.js');
  assert.match(html, /src\/tools\/enhancedMenu\.js/);
});

test('the prototype host is a mount and nothing else', () => {
  const src = read('src/tools/enhancedMenu.js');
  assert.match(src, /from '\.\.\/ui\/enhancedMenu\.js'/, 'it must mount the shipping module');
  // if this host ever grows a screen of its own it stops being a
  // prototype OF anything
  assert.ok(src.split('\n').filter((l) => l.trim() && !l.trim().startsWith('//')).length < 12,
    'the prototype host should stay a few lines - the screen is not its job');
});

test('the style module writes nothing at import time', () => {
  const src = read('src/ui/enhancedStyle.js');
  const top = src.split('export function')[0];
  assert.ok(!/document\.(head|body)\.append|appendChild/.test(top),
    'a module that touches the document when merely IMPORTED cannot be imported by a test');
  assert.match(src, /export function injectEnhancedStyle/);
  assert.match(src, /getElementById\(STYLE_ID\)\) return/, 'injection must be idempotent');
});

// ── THE DATA GATE SITS BEHIND THE DOOR, AND ONLY THERE ───────────
test('every path but the enhanced door gates ARENA2 first', () => {
  const src = read('src/main.js');
  // the dev scenes and the probe path each gate before they boot
  for (const scene of ['bootInterior', 'bootExterior']) {
    assert.match(src, new RegExp(`await ensureData\\(\\); return ${scene}\\(`),
      `${scene} must still gate the data before it boots`);
  }
  assert.match(src, /params\.has\('shot'\) \|\| params\.has\('nomenu'\)\) \{ await ensureData\(\)/,
    'the 25 probes in tools/ drive ?shot and must keep their data gate');
  // and the enhanced door runs BEFORE any of it
  const branch = enhancedBranch();
  const doorAt = branch.indexOf('runEnhancedMenu()');
  const gateAt = branch.indexOf('await ensureData();');
  assert.ok(doorAt > 0, 'the enhanced branch must open the menu');
  assert.ok(gateAt > doorAt,
    'the folder pick must come AFTER the menu resolves, or the door needs data it does not use');
});

test('the classic door still gates its data first', () => {
  const src = read('src/main.js');
  const doorAt = src.indexOf('runMenu(canvas');
  const gateAt = src.lastIndexOf('await ensureData();', doorAt);
  assert.ok(gateAt > 0 && gateAt < doorAt,
    'PICK03I0, its palette and FONT0003 are read before the classic menu draws a word');
});

// ── WHAT DOES AND DOES NOT LEAVE THE MENU ────────────────────────
test('only the three game actions resolve the door', () => {
  const src = read('src/ui/enhancedMenu.js');
  const calls = [...src.matchAll(/onAction\('([a-z]+)'\)/g)].map((m) => m[1]).sort();
  assert.deepEqual([...new Set(calls)], ['continue', 'delete', 'load', 'new'],
    'settings, mods and about are destinations INSIDE this screen, not exits from it');
  // and delete is caught before it can resolve - there is no save
  // manager yet, so it must not fall through and boot a world
  assert.match(src, /if \(action === 'delete'\) return;/);
});

test('main.js maps the actions to the load flag, both ways', () => {
  const branch = enhancedBranch();
  assert.match(branch, /choice === 'continue' \|\| choice === 'load'\) params\.set\('load', '1'\)/);
  assert.match(branch, /else params\.delete\('load'\)/,
    'AUDIT 19 F12: a URL already carrying ?load must not make New Game restore the save');
  assert.match(branch, /params\.set\('classic', '1'\)/);
  assert.match(branch, /return bootWorld\(/, 'U31: the classic start is the WORLD host');
});

// AUDIT 19 F3 made structurally impossible rather than guarded: the
// classic menu draws Load unconditionally and had to check for a save
// at press time (it fell through and started a NEW game instead). The
// enhanced panes are built from the save, so a button that loads
// nothing cannot be drawn in the first place.
test('Load and Continue are only drawn when there IS a save', () => {
  const src = read('src/ui/enhancedMenu.js');
  const cont = src.slice(src.indexOf('function paneContinue'), src.indexOf('// ── NEW GAME'));
  assert.match(cont, /if \(!save\) \{/, 'Continue answers the empty case before it draws a button');
  assert.ok(cont.indexOf("onAction('continue')") > cont.indexOf('if (!save)'),
    'the Continue button is inside the has-a-save arm');
  const load = src.slice(src.indexOf('function paneLoad'), src.indexOf('// ── SETTINGS'));
  assert.match(load, /if \(save\) \{/, 'Load draws its slot only when the slot is there');
});
