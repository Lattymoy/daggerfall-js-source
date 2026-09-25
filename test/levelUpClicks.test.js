// LV2: the Ascend screen's star clicks and its stone-and-brass dress.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { STAR_HOWTO } from '../src/ui/enhancedLevelUp.js';
import { LV2_CSS } from '../src/ui/levelUpStyle.js';
import { PLUS_CSS as ENHANCED_CSS } from '../src/ui/enhancedPlusStyle.js';   // PLUS1: the refresh's dress is the Enhanced Plus sheet

const src = readFileSync(new URL('../src/ui/enhancedLevelUp.js', import.meta.url), 'utf8');
const press = src.slice(src.indexOf('function starPress'), src.indexOf('function starFx'));

test('LV2: a first click only chooses a star; a second spends; a right click takes back', () => {
  assert.match(src, /b\.onclick = \(\) => starPress\(key, 1\);/);
  assert.match(src, /b\.oncontextmenu = \(e\) => \{ e\.preventDefault\(\); starPress\(key, -1\); \};/);
  assert.match(press, /const chosen = focusedKey\(screen\) === key;/, 'whether the star was ALREADY chosen is read before focusing it');
  assert.match(press, /else if \(!chosen\) fx = 'pick';/, 'a first click spends nothing');
  assert.match(press, /else if \(raiseAt\(screen, key\)\)/, 'the second click raises, through the screen');
  assert.match(press, /if \(lowerAt\(screen, key\)\)/, 'a right click lowers, through the screen');
  assert.ok(press.indexOf('focusAt(screen, key)') < press.indexOf('raiseAt'), 'the star is chosen before any point moves');
});

test('LV2: every press leaves a stepped mark, and reduced motion stands them down', () => {
  for (const k of ['fx-pick', 'fx-up', 'fx-down', 'fx-no']) assert.ok(LV2_CSS.includes(`.lv-star.${k}`), k);
  assert.match(LV2_CSS, /lv-rise [0-9]+ms steps\(/);
  assert.match(LV2_CSS, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.lv-pop \{ display: none; \}/);
  assert.ok(STAR_HOWTO.includes('right-click'));
});

test('LV2: the dress moves no band - no plaque in a band takes a border or vertical padding', () => {
  const rule = (sel) => LV2_CSS.slice(LV2_CSS.indexOf(`${sel} {`), LV2_CSS.indexOf('}', LV2_CSS.indexOf(`${sel} {`)));
  for (const sel of ['.lv-plate .lv-count', '.lv-choice .lv-pickname']) {
    assert.doesNotMatch(rule(sel), /border:/, `${sel} bevels with inset shadows`);
    assert.match(rule(sel), /padding: 0 14px;/, `${sel} adds no height`);
  }
  assert.match(LV2_CSS, /\.lv-plate \.lv-howto \{ position: absolute;/, 'the how-to takes no room from the figure');
  assert.ok(ENHANCED_CSS.includes('LV2: THE ASCEND SCREEN'));
});
