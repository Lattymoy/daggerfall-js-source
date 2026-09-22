// DROPS-FONT (2026-09-22, Mac: "Ensuring enhanced font gets integrated
// with the new ui changes"): the surfaces the three drops added or
// touched wear the enhanced skin's own pixel face (FONT1's law:
// PIXEL_STACK, unsmoothed, ligatures off) and nothing under them says a
// face of its own. The trade window's root is a `.px-home` (the one
// rule that carries the stack), its gold field and the chronicle's
// Share button inherit rather than falling to the browser's form face,
// and the F-menu's Trade row rides the card that already wears it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ENHANCED_CSS } from '../src/ui/enhancedStyle.js';
import { SOCIAL_MENU_CSS } from '../src/ui/socialMenu.js';
import { PIXEL_STACK, PIXEL_FONT_CSS } from '../src/ui/pixelifyFive.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const RULES = (css) => [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)].map((m) => ({ sel: m[1].replace(/\/\*[\s\S]*?\*\//g, '').trim(), body: m[2] }));
const rule = (css, sel) => { const r = RULES(css).find((x) => x.sel === sel); assert.ok(r, `a rule for ${sel}`); return r.body; };

test('DROPS-FONT: the trade window is a .px-home, and .px-home is where the pixel face lives - the stack, unsmoothed, ligatures off; the window\'s own sheet names no face of its own', () => {
  const t = rd('src/ui/enhancedPlayerTrade.js');
  assert.match(t, /const shell = el\('div', 'px-home px-over trade-shell ptrade-shell'\);/, 'the root wears the frame class the shop counter wears');
  const px = rule(ENHANCED_CSS, '.px-home');
  assert.ok(px.includes(`font-family: ${PIXEL_STACK};`), 'the one rule that carries the stack');
  assert.match(px, /-webkit-font-smoothing: none;/);
  assert.match(px, /font-variant-ligatures: none;/);
  const sheet = t.slice(t.indexOf('const PTRADE_CSS = `'), t.indexOf('`;', t.indexOf('const PTRADE_CSS = `')));
  assert.ok(!/font-family/.test(sheet), 'nothing under the root says a face of its own');
});

test('DROPS-FONT: the gold field and the Share button INHERIT - a form control falls to the browser\'s own face unless told, and both are told; the F-menu\'s Trade row rides the card that wears PIXEL_FONT_CSS', () => {
  const t = rd('src/ui/enhancedPlayerTrade.js');
  const gold = /\.ptrade-shell \.goldbox input \{([^}]*)\}/.exec(t);
  assert.ok(gold, 'the gold field has a rule');
  assert.match(gold[1], /font: inherit;/, 'the number the player types wears the window\'s face');
  assert.match(rule(ENHANCED_CSS, '.cr-shell .cr-rm'), /font: inherit;/, 'the chronicle\'s Share button (QUEST1 gave it the .cr-rm class) wears the chronicle\'s face');
  assert.match(rd('src/ui/enhancedChronicle.js'), /const share = el\('button', 'cr-rm cr-share', 'Share'\);/);
  assert.ok(rule(SOCIAL_MENU_CSS, '.dfpeer').includes(PIXEL_FONT_CSS.trim().split('\n')[0].trim()), 'the F-menu card carries the face, so its Trade row does');
  assert.match(rd('src/ui/socialMenu.js'), /if \(canTrade !== undefined\) rows\.push\(\{ key: 'trade', label: tradeLabel \|\| 'Trade',/);
});
