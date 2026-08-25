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
  assert.deepEqual([...new Set(calls)], ['continue', 'load', 'new'],
    'settings, mods and about are destinations INSIDE this screen, not exits from it');
});

// AUDIT F3/F4: two destructive actions shipped without a confirm -
// Reset wiped every override on one press where the CLASSIC screen has
// always asked, and Delete did nothing at all while drawn undimmed and
// operable-looking. Delete is wired now; both go through one ask().
test('the destructive actions ask first', () => {
  const src = read('src/ui/enhancedMenu.js');
  assert.match(src, /const ask = \(title, body, label, onYes\)/, 'one confirm, not two');
  const resetAt = src.indexOf('Reset everything to defaults');
  assert.match(src.slice(resetAt, resetAt + 400), /b\.onclick = \(\) => ask\(/,
    'Reset must ask - the classic screen does');
  const delAt = src.indexOf("label: 'Delete'");
  assert.match(src.slice(delAt, delAt + 400), /onClick: \(\) => ask\(/,
    'Delete must ask');
  assert.match(src.slice(delAt, delAt + 500), /removeItem\(QUICKSAVE_KEY\)/,
    'and it must actually delete - a button that does nothing is the lie the anti-lie law forbids');
});

// AUDIT F8, found by the live check rather than by reading: on a PHONE
// the detail pane is a sheet that only rises when a ROW is tapped, so
// the category card - and the Reset button inside it - could not be
// reached at all. A second tap on the ACTIVE category opens it, which
// is settingsWindow's own second-tap-acts gesture one level up.
test('the category card is reachable on a phone', () => {
  const src = read('src/ui/enhancedMenu.js');
  const at = src.indexOf('const rail = el(\'div\', \'subrail\')');
  const arm = src.slice(at, at + 1600);
  assert.match(arm, /if \(on\) \{[^}]*sheetOpen = true;/,
    'a second tap on the active category must raise the sheet');
  assert.match(arm, /more-dot/, 'and the gesture needs a visible affordance');
  const css = read('src/ui/enhancedStyle.js');
  const phone = css.slice(css.indexOf('@media (max-width: 860px)'));
  assert.match(phone, /\.subbtn\.on \.more-dot \{[\s\S]{0,140}display: inline-block/,
    'the dot shows on the phone, where the gesture is the only way in');
});

// AUDIT F5: colour rows drew a value with no control and no reason,
// which reads as broken rather than as unbuilt.
test('colour settings have an editor, and it keeps the alpha byte', () => {
  const src = read('src/ui/enhancedMenu.js');
  const at = src.indexOf("widget === 'colour'");
  const arm = src.slice(at, at + 900);
  assert.match(arm, /sw\.type = 'color'/, 'the browser gives us the right widget - use it');
  assert.match(arm, /sw\.value\.slice\(1\) \+ String\(raw \?\? ''\)\.slice\(6\)/,
    'DFU colour keys are RGBA8 and the picker owns RGB: the stored alpha must survive '
    + '(ToolTipBackgroundColor ships D2 and means it)');
  assert.match(arm, /write\(key,/, 'and it writes through the same door every other row uses');
});

// AUDIT F7: this read the whole 171-key store once PER ROW.
test('the settings pane reads the store once, not once per row', () => {
  const src = read('src/ui/enhancedMenu.js');
  assert.match(src, /_eff \?\?= effectiveSettings\(\)/);
  // count CALLS, not mentions: the import has no parentheses and the
  // comment explaining the fix names the function it is about.
  const code = src.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
  assert.equal((code.match(/effectiveSettings\(\)/g) || []).length, 1,
    'exactly one call site - a second one is a second store read per row');
  // and every path that can change the store drops the cache
  const writes = ['_eff = null;   // the store changed', 'resetToDefaults(); _eff = null;'];
  for (const w of writes) assert.ok(src.includes(w), `the cache must be dropped by: ${w}`);
});

// AUDIT F2: the version test belongs to the RESTORER, so both front
// doors ask the restorer's own question. readQuicksave parses; it does
// not judge, and restorePlayer refuses AFTER the world has booted.
test('both front doors test the save VERSION, through one predicate', () => {
  assert.match(read('src/systems/save.js'),
    /export function restorableQuicksave[\s\S]{0,220}snap\.v === SAVE_VERSION/);
  for (const f of ['src/ui/enhancedMenu.js', 'src/scenes/menu.js']) {
    const src = read(f);
    assert.match(src, /restorableQuicksave/, `${f} must ask whether the save is RESTORABLE`);
    assert.ok(!/[^a-zA-Z]readQuicksave\(/.test(src),
      `${f} must not read the envelope without testing its version`);
  }
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
