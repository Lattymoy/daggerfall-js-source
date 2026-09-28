// SHORT-TOUCH (2026-09-27, Discord - players on an AYN Thor and an Android phone: "I can login, get to the main
// screen but I'm unable to select online, load game, anything"; "I luckily have a tiny, tiny space under the title I
// can use to scroll"). The coarse-pointer layout stacked the section screen's brand, pane and rail in one column;
// on a landscape handheld 411 px tall the pane - every Continue, Load, Begin and Play online - came to 5 px (0 on a
// 393 px screen). A short landscape touch screen keeps the desk's two columns now, and the first visit's sign-in
// window takes the short screen's height. MEASURED by tools/shortTouchProbe.mjs (24 failures before, none after, on
// four handheld viewports); pinned here as the rules that make it so, and their order against the rules they beat.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/ui/enhancedStyle.js', import.meta.url), 'utf8');
const SHORT = '@media (pointer: coarse) and (orientation: landscape) and (max-height: 560px) and (min-width: 600px) {';
const block = () => {
  const at = css.indexOf(SHORT);
  assert.ok(at > 0, 'the short landscape touch rule is gone');
  return css.slice(at, css.indexOf('\n}\n', at));
};

test('SHORT-TOUCH: a short landscape touch screen keeps the two columns - the rail down the side, the pane the whole height', () => {
  const b = block();
  assert.match(b, /\.shell:not\(\.wizard\) \{ grid-template-columns: min\(var\(--side\), 34vw\) 1fr; grid-template-rows: none; \}/);
  assert.match(b, /\.shell:not\(\.wizard\) > \.side \{ display: flex; flex-direction: column; min-height: 0; \}/,
    'the phone rule dissolves the side column (display: contents) - it has to come back');
  assert.match(b, /\.shell:not\(\.wizard\) \.rail \{ order: 0; display: block; flex: 1; min-height: 0; overflow-x: hidden; overflow-y: auto;/,
    'the rail is a scrolling column, not the phone\'s wrapped bottom strip');
  assert.match(b, /\.shell:not\(\.wizard\) \.railbtn \{ display: block; width: 100%; min-height: 44px;/, 'a thumb\'s row');
  assert.match(b, /\.shell:not\(\.wizard\) > \.pane \{ order: 0; \}/);
});

test('SHORT-TOUCH: it comes AFTER the coarse-pointer stack it overrides, and never touches the wizard', () => {
  const coarse = css.indexOf('@media (max-width: 860px), (pointer: coarse) {');
  assert.ok(coarse > 0 && css.indexOf(SHORT) > coarse, 'the override must follow the rule it overrides');
  for (const line of block().split('\n').filter((l) => /^\s+\.[a-z]/.test(l))) {
    assert.match(line, /^\s+\.shell:not\(\.wizard\)/, `a rule outside the section shell: ${line.trim()}`);
  }
});

test('SHORT-TOUCH: the sign-in window takes a short screen\'s height, over PX8\'s stage padding', () => {
  const at = css.indexOf('.px-stage.px-acctstage { padding: max(10px, env(safe-area-inset-top)) 16px 10px; overflow: hidden; }');
  assert.ok(at > 0, 'the short screen\'s sign-in stage rule is gone');
  const media = css.lastIndexOf('@media', at);
  assert.equal(css.slice(media, css.indexOf('{', media)).trim(), '@media (max-height: 560px)');
  assert.match(css.slice(at, css.indexOf('\n}', at)), /\.px-win\.px-acctwin \{ max-height: calc\(100dvh - 20px\); \}/);
  // two classes: PX8's `.px-stage` short rule sits later in the sheet and would win a one-class tie
  const px8 = css.indexOf('.px-stage { justify-content: flex-start; padding: 7dvh 24px 132px; overflow-y: auto; }');
  assert.ok(px8 > at, 'PX8\'s rule is the later one - which is why this one needs its second class');
});
