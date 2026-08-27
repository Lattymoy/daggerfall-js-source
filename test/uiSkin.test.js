// THE SKIN, pinned. Classic screens or the enhanced ones, and the
// laws that keep a player from being stranded in either.
//
// A PIN MUST FAIL: every assertion here dies under a one-character
// change to the law it names. The default pin dies if DEFAULT_SKIN
// flips; the override pins die if the precedence order swaps; the
// typo pins die if `clean` stops filtering.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

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
test('the CLASSIC settings screen carries a way back to enhanced', () => {
  const src = readFileSync(new URL('../src/ui/settingsWindow.js', import.meta.url), 'utf8');
  assert.match(src, /push\('btn:skin'/, 'the classic screen must expose a skin control');
  assert.match(src, /arg === 'skin'/, 'and route a click to it');
  assert.match(src, /_switchSkin\(\)\s*\{/, 'through one named arm');
  // it must DROP the override on the way out, or the reload lands back
  // on the skin the URL asked for and the press reads as ignored
  assert.match(src, /searchParams\.delete\('skin'\)/);
});

test('the ENHANCED menu carries a way back to classic - on the door itself (U62), and in settings', () => {
  // the screen moved to src/ui/ when the game started mounting it;
  // src/tools/enhancedMenu.js is the prototype HOST now and carries
  // no screen of its own
  const src = readFileSync(new URL('../src/ui/enhancedMenu.js', import.meta.url), 'utf8');
  assert.match(src, /function skinRow\(\)/);
  // U62 (Mac: "make it more loud"): ONE door for every control that
  // switches - switchSkin stores and reloads without the override -
  // and the brand block draws the switch where the word ENHANCED sat.
  assert.match(src, /export function switchSkin\(to = otherSkin\(uiSkin\(\)\)\) \{/);
  assert.match(src, /setUiSkin\(to\);/);
  assert.match(src, /searchParams\.delete\('skin'\)/);
  assert.equal((src.match(/searchParams\.delete\('skin'\)/g) ?? []).length, 1, 'one place drops the override: switchSkin');
  assert.match(src, /b\.onclick = \(\) => switchSkin\(\);/, 'the settings row uses it');
  assert.match(src, /export function skinSwitch\(\) \{/);
  assert.match(src, /brand\.append\(skinSwitch\(\)\);/, 'the switch sits under the brand');
  assert.doesNotMatch(src, /brand\.append\(el\('div', 'sub', 'Enhanced'\)\)/, 'the word alone is gone - it is the control now');
  assert.match(src, /for \(const skin of \['enhanced', 'classic'\]\)/, 'both skins are shown, always');
  assert.match(src, /b\.setAttribute\('aria-pressed', String\(skin === current\)\);/, 'the one in effect is pressed');
  assert.match(src, /if \(skin !== current\) switchSkin\(skin\);/, 'pressing the other switches; the lit one is inert');
  assert.match(src, /el\('div', 'skinhint', 'switch anytime'\)/, 'and it says it can be switched');
  const css = readFileSync(new URL('../src/ui/enhancedStyle.js', import.meta.url), 'utf8');
  assert.match(css, /\.skinopt\.on \{ color: var\(--brass\); border-color: var\(--brass\)/, 'the one in effect is brass');
  assert.match(css, /\.skinopt \{ min-height: 44px; padding: 8px 14px; \}/, 'a thumb\'s target on a phone');
});

// ── THE FOOTER HOLDS FOUR BUTTONS AT EVERY WIDTH ─────────────────
// The first attempt put the control in the TITLEBAR and AUDIT 24's own
// touch pin killed it (18px tall where a finger is 44). The footer
// WRAPS to two rows instead of cramming four into one, and this pin
// drives the real layout at the narrowest page the metric can produce
// (MIN_PAGE_W 156) and at a desktop, asserting no two buttons overlap
// and none runs off the page.
test('the classic footer fits four buttons, wrapped or not', async () => {
  const { SettingsWindow } = await import('../src/ui/settingsWindow.js');
  const win = new SettingsWindow({ onLaunch: () => {} });
  for (const canvas of [{ width: 320, height: 640 }, { width: 1400, height: 900 }, { width: 390, height: 844 }]) {
    const L = win.layout(canvas);
    const btns = [L.footer.help, L.footer.reset, L.footer.skin, L.footer.play];
    for (const b of btns) {
      assert.ok(b, 'every footer button is placed');
      assert.ok(b[0] >= 0 && b[0] + b[2] <= L.m.pageW,
        `${canvas.width}x${canvas.height}: a footer button runs off the ${L.m.pageW}-wide page`);
      assert.ok(b[1] + b[3] <= L.m.pageH, 'and none runs off the bottom');
    }
    for (let i = 0; i < btns.length; i++) {
      for (let j = i + 1; j < btns.length; j++) {
        const [a, b] = [btns[i], btns[j]];
        const apart = a[0] + a[2] <= b[0] || b[0] + b[2] <= a[0]
          || a[1] + a[3] <= b[1] || b[1] + b[3] <= a[1];
        assert.ok(apart, `${canvas.width}x${canvas.height}: footer buttons ${i} and ${j} overlap`);
      }
    }
    // and the label names the skin you would GET, not the one you have
    assert.equal(L.footer.skinLabel, SKIN_NAMES[otherSkin(uiSkin(''))]);
  }
});

// ── AND IT IS NOT A DFU SETTING ──────────────────────────────────
test('the skin stays OUT of the DFU settings store', async () => {
  const { ALL_KEYS } = await import('../src/systems/settings.js');
  assert.equal(ALL_KEYS.length, 171, 'the parity pin still holds');
  assert.ok(!ALL_KEYS.some((k) => /skin/i.test(k)), 'no port-invented key in DFU\u2019s store');
});
