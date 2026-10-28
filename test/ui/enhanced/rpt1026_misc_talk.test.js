// RPT1026-MISC TALK-SIDEWAYS (a private report from a phone's browser: the talk window ran off the screen and could not be
// used). Drawn in a real browser
// at a phone's sizes before the fix (the enhanced talk panel mounted alone on Vite's dev server, Playwright's Chromium):
// held sideways, 844 x 390, the panel stood 203 pixels tall (52dvh), and the head, the foot and the topics' two strips
// took all of it - the topic list 12 pixels tall, drawn past its column under the foot; at 740 x 360 the category
// buttons were under the foot. After it: the panel 378 tall, the list 166, every button the topmost thing at its centre,
// upright and desktop sizes unchanged. A node test has no layout engine, so this one reads the real stylesheet the way a
// browser cascades it - each rule for the panel's selectors, in sheet order, under the media queries that hold at a
// size - and asks what the panel's height and the columns come to there.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ENHANCED_CSS } from '../../../src/ui/enhanced/enhancedStyle.js';

/** The sheet's top-level rules in order, each with the media condition it stands under (null: none). */
function rulesOf(css) {
  const src = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const out = [];
  const walk = (text, media) => {
    let i = 0;
    while (i < text.length) {
      const open = text.indexOf('{', i);
      if (open < 0) break;
      const head = text.slice(i, open).trim();
      let depth = 1, j = open + 1;
      while (j < text.length && depth) { if (text[j] === '{') depth++; else if (text[j] === '}') depth--; j++; }
      const body = text.slice(open + 1, j - 1);
      if (head.startsWith('@media')) walk(body, head.slice(6).trim());
      else if (!head.startsWith('@')) out.push({ selectors: head.split(',').map((s) => s.trim().replace(/\s+/g, ' ')), body, media });
      i = j;
    }
  };
  walk(src, null);
  return out;
}
/** A media condition at a viewport: comma is OR, `and` is AND; a phone's pointer is coarse and has no hover. */
function holds(media, w, h) {
  if (!media) return true;
  return media.split(',').some((alt) => [...alt.matchAll(/\(([a-z-]+):\s*([a-z0-9.]+)\)/g)].every(([, f, v]) => {
    const n = parseFloat(v);
    if (f === 'max-width') return w <= n;
    if (f === 'min-width') return w >= n;
    if (f === 'max-height') return h <= n;
    if (f === 'min-height') return h >= n;
    if (f === 'orientation') return (v === 'landscape') === (w > h);
    if (f === 'pointer') return v === 'coarse';
    if (f === 'hover') return v === 'none';
    return false;
  }));
}
/** The value the cascade gives `prop` on `selector` at w x h (equal specificity: the sheet's last word). */
function computed(rules, selector, prop, w, h) {
  let value = null;
  for (const r of rules) {
    if (!r.selectors.includes(selector) || !holds(r.media, w, h)) continue;
    for (const m of r.body.matchAll(new RegExp(`(?:^|;)\\s*${prop}:\\s*([^;]+)`, 'g'))) value = m[1].trim();
  }
  return value;
}
/** A length in pixels: px, vw, vh, dvh inside min(), max() and calc(). */
function px(expr, w, h) {
  const js = expr.replace(/(-?[\d.]+)(px|dvh|vh|vw)/g, (_, n, u) => String(Number(n) * (u === 'px' ? 1 : u === 'vw' ? w / 100 : h / 100)))
    .replace(/\bmin\(/g, 'Math.min(').replace(/\bmax\(/g, 'Math.max(').replace(/\bcalc\(/g, '(');
  assert.match(js, /^[\d.\s()+\-*/,Mathminx]+$/, `a length this test can read: ${expr}`);
  return Function(`return ${js}`)();
}

test('RPT1026-MISC TALK-SIDEWAYS: on a phone held sideways the talk panel stands the screen\'s height, its topics beside the conversation - upright phones and desktops as they were (mutants: rpt1026-misc-talk-sideways-short, rpt1026-misc-talk-sideways-stacked)', () => {
  const rules = rulesOf(ENHANCED_CSS);
  const panel = (w, h) => px(computed(rules, '.talk-shell .talk-panel', 'height', w, h), w, h);
  for (const [w, h] of [[844, 390], [740, 360], [640, 360], [915, 412]]) {
    assert.ok(panel(w, h) >= h * 0.9, `${w} x ${h}: the panel ${panel(w, h)} px of ${h}`);
    assert.ok(panel(w, h) <= h, `${w} x ${h}: and never past it`);
    const cols = computed(rules, '.talk-main', 'grid-template-columns', w, h);
    assert.equal(cols.split(/\s+(?![^(]*\))/).length, 2, `${w} x ${h}: the conversation and the topics side by side (${cols})`);
  }
  // the report's screen before the fix: 52dvh of 390 left the list nothing - the old rule is still the desktop's
  assert.equal(computed(rules, '.talk-shell .talk-panel', 'height', 1400, 900), 'min(440px, 52dvh)');
  assert.equal(computed(rules, '.talk-shell .talk-panel', 'height', 390, 844), 'min(600px, 70dvh)', 'a phone upright: the stacked panel it had');
  assert.equal(computed(rules, '.talk-main', 'grid-template-columns', 390, 844), '1fr');
  assert.equal(computed(rules, '.talk-main', 'grid-template-columns', 1400, 900), '1fr minmax(240px, 34%)');
});
