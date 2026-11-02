// AUDIT RPT1026 (lane L, MISC - the audit of FIELD BUGS 2026-10-26r, bible/01-Overview/bugs/Field-Bugs-2026-10-26r.md): the
// batch's screen fixes read cold, in Chromium where they are layout (Playwright's Chromium over Vite's dev server, the
// real modules mounted alone) and here where a node test can hold them.
//   L1 - TOUCH-FIELD raised the touch layer's entry for the Bank's amount, but the entry was the layer's child: one
//        stacking context at z-index 5, under the ported window's host (z-index 13, the whole screen). Measured at
//        390 x 844 and 844 x 390: the topmost thing at the entry's centre was the Bank's own stat row and columns - the
//        amount a finger typed stood hidden behind the window, seen only once the keyboard's Enter sent it. The entry is
//        the page's own now, above the windows.
//   L2 - TALK-SIDEWAYS gave a short screen the panel's height, but under 720 pixels wide the phone rule still stacked the
//        head and the foot into two rows each: the topic list 66 pixels tall at 640 x 360, 26 at 568 x 320 (under one
//        row), and the categories ran past the panel's edge - Work cut at 640, wholly off the screen at 568. After the
//        fix: 152 and 112 pixels, 167 at 667 x 375, every press the topmost thing at its centre and none overflowing;
//        844 x 390, 740 x 360, 915 x 412, upright and desktop sizes measured unchanged.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as touchLayer from '../../src/ui/touch/touch.js';
import { PORT_CSS } from '../../src/ui/enhanced/enhancedPortStyle.js';
import { ENHANCED_CSS } from '../../src/ui/enhanced/enhancedStyle.js';

// ── L1 ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
function stubEl() {
  return {
    textContent: '', children: [], _l: new Map(), style: { cssText: '' }, value: '', parent: null,
    appendChild(c) { this.children.push(c); c.parent = this; return c; },
    addEventListener(t, f) { if (!this._l.has(t)) this._l.set(t, []); this._l.get(t).push(f); },
    remove() { this.removed = true; if (this.parent) this.parent.children = this.parent.children.filter((n) => n !== this); },
    focus() { this.focused = true; },
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1000, height: 600 }),
  };
}
/** The z-index a rule of `css` gives `selector`. */
const zOf = (css, selector) => Number(new RegExp(`${selector.replace(/[.]/g, '\\.')} \\{[^}]*?z-index: (\\d+)`).exec(css)?.[1]);

test('AUDIT RPT1026 L1: the entry a typed field raises on a phone stands over the window that raised it - the page\'s own element, above the ported window\'s host - and goes with the layer (mutants: auditl-entry-in-layer, auditl-entry-under-port, auditl-entry-left-behind)', () => {
  const prev = { d: globalThis.document, w: globalThis.window, k: globalThis.KeyboardEvent };
  globalThis.KeyboardEvent = class { constructor(type, init = {}) { this.type = type; Object.assign(this, init); } };
  globalThis.document = { createElement: () => stubEl(), body: stubEl() };
  globalThis.window = { ontouchstart: null, dispatchEvent: () => true };   // a phone: a touch screen, no media queries
  let h = null;
  try {
    h = touchLayer.attachTouch(stubEl(), { overlayActive: () => true });
    assert.ok(h?.el, 'the layer stands on a phone');
    assert.equal(touchLayer.openTouchEntry({ numeric: true }), true, 'a field\'s press raises the entry');
    const entry = globalThis.document.body.children.find((n) => n.type === 'text');
    assert.ok(entry, 'the entry is the page\'s own - never inside the layer, whose z-index 5 is under every DOM window');
    assert.ok(!h.el.children.includes(entry));
    const z = Number(/z-index:(\d+)/.exec(entry.style.cssText)?.[1]);
    const port = zOf(PORT_CSS, '.port-host');
    assert.ok(port > 0, 'the ported window\'s host has its z-index (enhancedPortStyle.js)');
    assert.ok(z > port, `the entry (z-index ${z}) stands over the ported window (${port})`);
    assert.equal(z, touchLayer.TOUCH_ENTRY_Z, 'the layer\'s own word for it');
    assert.match(entry.style.cssText, /position:fixed;/, 'placed on the screen, as the layer placed it');
    assert.equal(entry.focused, true, 'focused inside the press - the keyboard rises');
    h.dispose(); h = null;
    assert.ok(entry.removed, 'a layer gone takes its entry with it');
  } finally {
    h?.dispose?.();
    globalThis.document = prev.d; globalThis.window = prev.w; globalThis.KeyboardEvent = prev.k;
  }
});

// ── L2 ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
// The sheet read as a browser cascades it, rule by rule in sheet order under the media queries that hold at a size
// (test/ui/enhanced/rpt1026_misc_talk.test.js's reader): the value a selector's own rules give a property there.
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
function computed(rules, selector, prop, w, h) {
  let value = null;
  for (const r of rules) {
    if (!r.selectors.includes(selector) || !holds(r.media, w, h)) continue;
    for (const m of r.body.matchAll(new RegExp(`(?:^|;)\\s*${prop}:\\s*([^;]+)`, 'g'))) value = m[1].trim();
  }
  return value;
}
const tracks = (v) => String(v ?? '').split(/\s+(?![^(]*\))/).filter(Boolean).length;

test('AUDIT RPT1026 L2: a phone on its side narrower than 720 pixels keeps the talk panel\'s head and foot to one row each, and its categories shrink to their strip - as 844 x 390 has them; upright phones still stack (mutants: auditl-talk-head-stacked, auditl-talk-goodbye-row-two, auditl-talk-tone-row-two, auditl-talk-say-stacked, auditl-talk-question-row-own, auditl-talk-cats-overflow)', () => {
  const rules = rulesOf(ENHANCED_CSS);
  for (const [w, h] of [[640, 360], [667, 375], [568, 320], [700, 450], [844, 390], [740, 360]]) {
    const at = `${w} x ${h}`;
    assert.equal(tracks(computed(rules, '.talk-head', 'grid-template-columns', w, h)), 3, `${at}: the name, the tones and Goodbye side by side`);
    for (const s of ['.talk-tone', '.talk-head .door-goodbye']) {
      const row = computed(rules, s, 'grid-row', w, h);
      assert.ok(row == null || row === 'auto', `${at}: ${s} in the head's one row (${row})`);
    }
    assert.equal(tracks(computed(rules, '.talk-say', 'grid-template-columns', w, h)), 3, `${at}: the question, Note and Ask side by side`);
    const q = computed(rules, '.talk-say .talk-q', 'grid-column', w, h);
    assert.ok(q == null || q === 'auto', `${at}: the question in the foot's one row (${q})`);
    if (w <= 720) assert.equal(computed(rules, '.talk-cat', 'min-width', w, h), '0', `${at}: a category shrinks to its share of the topics' strip`);
  }
  // upright, the phone rule's stack is the panel's (it has the height for it)
  assert.equal(tracks(computed(rules, '.talk-head', 'grid-template-columns', 390, 844)), 2);
  assert.equal(computed(rules, '.talk-tone', 'grid-row', 390, 844), '2');
  assert.equal(computed(rules, '.talk-say .talk-q', 'grid-column', 390, 844), '1 / -1');
  // the desktop's own
  assert.equal(computed(rules, '.talk-head', 'grid-template-columns', 1400, 900), '1fr auto auto');
  assert.equal(computed(rules, '.talk-cat', 'min-width', 1400, 900), null);
});
