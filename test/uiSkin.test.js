// THE SKIN, pinned. Classic screens or the enhanced ones, and the
// laws that keep a player from being stranded in either.
//
// A PIN MUST FAIL: every assertion here dies under a one-character
// change to the law it names. The default pin dies if DEFAULT_SKIN
// flips; the override pins die if the precedence order swaps; the
// typo pins die if `clean` stops filtering.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

import {
  SKINS, DEFAULT_SKIN, SKIN_NAMES, uiSkin, isEnhanced, setUiSkin,
  otherSkin, skinOverride,
} from '../src/systems/uiSkin.js';
import { PREF_DEFAULTS, getPref, resetPrefs, _resetForTests } from '../src/systems/uiPrefs.js';

// uiPrefs writes to localStorage; node has none, and its storage()
// helper already swallows that. Reset between tests so one test's
// choice cannot answer for the next.
const fresh = () => { _resetForTests(); };

test('ENHANCED IS THE DEFAULT - Mac 2026-08-25', () => {
  fresh();
  assert.equal(DEFAULT_SKIN, 'enhanced');
  assert.equal(PREF_DEFAULTS.skin, 'enhanced');
  assert.equal(uiSkin(''), 'enhanced');
  assert.equal(isEnhanced(''), true);
});

test('the two skins, and every one has a name a player can read', () => {
  assert.deepEqual(SKINS, ['enhanced', 'classic']);
  for (const s of SKINS) assert.equal(typeof SKIN_NAMES[s], 'string');
  assert.equal(otherSkin('enhanced'), 'classic');
  assert.equal(otherSkin('classic'), 'enhanced');
});

test('?skin OVERRIDES the stored choice, both directions', () => {
  fresh();
  setUiSkin('enhanced');
  assert.equal(uiSkin('?skin=classic'), 'classic');
  setUiSkin('classic');
  assert.equal(uiSkin('?skin=enhanced'), 'enhanced');
});

test('the override WRITES NOTHING - a probe leaves no preference behind', () => {
  fresh();
  setUiSkin('enhanced');
  uiSkin('?skin=classic');
  uiSkin('?skin=classic');
  // the stored choice is untouched, so the NEXT page load without the
  // param is still enhanced. This is what makes ?skin safe for the 25
  // probes in tools/.
  assert.equal(getPref('skin'), 'enhanced');
  assert.equal(uiSkin(''), 'enhanced');
});

test('a bad ?skin is a TYPO, not an instruction', () => {
  fresh();
  setUiSkin('classic');
  assert.equal(skinOverride('?skin=modern'), null);
  assert.equal(skinOverride('?skin=Enhanced'), null);   // the token is exact
  assert.equal(uiSkin('?skin=modern'), 'classic');      // falls to the STORED choice
});

test('setUiSkin refuses a value that is not a skin', () => {
  fresh();
  setUiSkin('classic');
  assert.equal(setUiSkin('modern'), 'classic');
  assert.equal(uiSkin(''), 'classic');
  assert.equal(setUiSkin('enhanced'), 'enhanced');
  assert.equal(uiSkin(''), 'enhanced');
});

test('a corrupt stored value falls to the default, never throws', () => {
  fresh();
  resetPrefs();
  assert.equal(uiSkin(''), 'enhanced');
});

// ── THE WAY BACK, BOTH DIRECTIONS ────────────────────────────────
// The reachability laws are host geometry, so they are pinned as
// SOURCE SWEEPS and say so. A skin you can choose and not unchoose is
// the AUDIT 24 trap (a launcher a phone could reach and never
// dismiss), and it would be worse here: enhanced is the default, so
// the only player on the classic screen is one who asked for it.
// FD1 (2026-09-11): the classic SettingsWindow and its footer are
// DELETED; the classic skin opens on this same door with the Begin
// rail, and the way back is the door's own switch - the pin below.
test('FD1: the CLASSIC skin opens on the same door, whose Overhauls page is its way back', () => {
  const src = readFileSync(new URL('../src/ui/enhancedMenu.js', import.meta.url), 'utf8');
  assert.match(src, /const SECTIONS_CLASSIC = \['Begin', 'Online', 'Settings', 'Features', 'Overhauls', 'Screenshots', 'About'\]/);   // LOAD1   // OVH1   // FT16
  assert.match(src, /sections = mode === 'pause' \? SECTIONS_PAUSE : isEnhanced\(\) \? SECTIONS_BOOT : SECTIONS_CLASSIC;/);
  assert.ok(!existsSync(new URL('../src/ui/settingsWindow.js', import.meta.url)), 'the keyed screen is gone');
});

test('MENU-TOGGLE: the menu\'s Enhanced/Classic toggle is retired - the door\'s pair, the Settings row and its help are gone, and the interface is chosen on the Overhauls page alone, which every rail carries (mutants: the pair back on the door, the row back in Interface)', () => {
  // U62 (Mac, 2026-08-27: "make it more loud") put a switch under the brand and on the home's foot, beside the
  // Settings row; MENU-TOGGLE (2026-09-26, Mac: "We really need to remove the enhanced/classic menu toggle and ensure
  // all the UI is linked up properly") retired all three. PLUS-ONLY had already made the UI Overhaul card the choice
  // of the three looks (Classic, Enhanced Plus, GrimoireUI), and a second switch offering two of them drifted from it.
  const src = readFileSync(new URL('../src/ui/enhancedMenu.js', import.meta.url), 'utf8');
  const code = src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
  for (const gone of [/function skinSwitch\(/, /function switchSkin\(/, /function skinRow\(/, /'ui:skin'/, /'switch anytime'/, /skinopt/]) {
    assert.doesNotMatch(code, gone, `${gone} is retired`);
  }
  assert.match(code, /foot\.append\(build, about\);/, 'the home\'s foot: build and About');
  assert.doesNotMatch(code, /brand\.append\(skin/, 'nothing under the brand but the brand');
  // every rail carries the one door
  for (const rail of ['SECTIONS_BOOT', 'SECTIONS_CLASSIC', 'SECTIONS_PAUSE']) {
    assert.match(src, new RegExp(`const ${rail} = \\[[^\\]]*'Overhauls'`), `${rail} carries Overhauls`);
  }
  assert.match(code, /overhauls: paneOverhauls,/);
  // and the door's law has one home: the UI card's choice stores the skin and reloads, carrying a refused write on
  // the URL (SKIN-CARRY)
  const ovh = readFileSync(new URL('../src/systems/overhauls.js', import.meta.url), 'utf8');
  assert.match(ovh, /if \(setUiSkin\(skin\) === null\) url\.searchParams\.set\('skin', skin\);/);
  assert.equal((src.match(/setUiSkin\(/g) ?? []).length, 0, 'the menu writes no skin of its own');
  const css = readFileSync(new URL('../src/ui/enhancedStyle.js', import.meta.url), 'utf8');
  assert.doesNotMatch(css, /\.skinopt|\.skinswitch/, 'no rule for a control that is gone');
  assert.match(css, /\.px-foot \.px-about \{ grid-column: 3; \}/, 'About keeps the right of the foot');
});


// ── AND IT IS NOT A DFU SETTING ──────────────────────────────────
test('the skin stays OUT of the DFU settings store', async () => {
  const { ALL_KEYS } = await import('../src/systems/settings.js');
  assert.equal(ALL_KEYS.length, 171, 'the parity pin still holds');
  assert.ok(!ALL_KEYS.some((k) => /skin/i.test(k)), 'no port-invented key in DFU\u2019s store');
});
