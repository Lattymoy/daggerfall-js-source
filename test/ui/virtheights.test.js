// AUDIT TRADE-VIRT (2026-10-20, the owner: "I need you to audit this and ensure this is perfect and fidelity isnt lost";
// ui/virtualRows.js, bible/07-Rendering/Performance-Priority.md TRADE-VIRT, the audit) - A LONG LIST'S ROWS ARE EACH THEIR
// OWN HEIGHT. The window sized every line at the first two lines' pitch, and a trade's rows are not one height (a book's
// title wraps: 68 px against 52; a phone's weapons 52, 64 and 82): a list whose first row was tall scrolled into blank
// stretches, rows jumped, a click's repaint moved the rows under a still pointer, and the scrollbar was the wrong length.
// Held here, on a layout whose rows are three heights and whose first is the tallest: every stop of a scroll shows rows
// across the whole band; a sync never moves what is on the screen; rows reached from above stand where the whole list
// stands them and the list is its whole height; a repaint over the kept heights shows the same rows at the same place; a
// resize lets the heights go.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { virtualRows } from '../../src/ui/virtualRows.js';

/** One list that scrolls (its own box, `view` tall from `top`): its children flow `cols` to a line, a line as tall as
 *  its tallest row, `gap` between lines; a spacer (`.vrows-gap`) a whole line of its own height. A row's height is
 *  `heightOf(i)` - its item's index. */
function laid({ cols = 1, gap = 4, pad = 0, top = 100, view = 400, heightOf }) {
  const doc = { createElement: (t) => mk(t), activeElement: null };
  function mk(tag) {
    const n = {
      tagName: tag.toUpperCase(), nodeType: 1, children: [], parentElement: null, style: {}, className: '', attrs: {}, ownerDocument: doc,
      get isConnected() { return true; },
      get firstChild() { return n.children[0] ?? null; },
      contains(x) { for (let a = x; a; a = a.parentElement) if (a === n) return true; return false; },
      hasAttribute(k) { return k in n.attrs; },
      focus() { doc.activeElement = n; },
      append(...cs) { for (const c of cs) { c.remove(); c.parentElement = n; n.children.push(c); } },
      insertBefore(c, ref) { c.remove(); c.parentElement = n; const i = ref ? n.children.indexOf(ref) : -1; if (i < 0) n.children.push(c); else n.children.splice(i, 0, c); return c; },
      remove() { const p = n.parentElement; if (!p) return; p.children.splice(p.children.indexOf(n), 1); n.parentElement = null; },
      setAttribute(k, v) { n.attrs[k] = String(v); },
      addEventListener() {}, removeEventListener() {},
      getBoundingClientRect() { return rectOf(n); },
    };
    return n;
  }
  const list = mk('div');
  list.scrollTop = 0;
  const hOf = (c) => (c.className === 'vrows-gap' ? parseFloat(c.style.height) : heightOf(c.i));
  const flow = () => {
    const at = new Map();
    let y = pad, line = [], tallest = 0;
    const close = () => { if (!line.length) return; y += tallest + gap; line = []; tallest = 0; };
    for (const c of list.children) {
      if (c.className === 'vrows-gap') { close(); at.set(c, y); y += hOf(c) + gap; continue; }
      at.set(c, y); line.push(c); tallest = Math.max(tallest, hOf(c));
      if (line.length === cols) close();
    }
    close();
    return { at, height: y - gap + pad };
  };
  const rectOf = (n) => {
    if (n === list) return { top, bottom: top + view, height: view };
    const y = top + flow().at.get(n) - list.scrollTop, h = hOf(n);
    return { top: y, bottom: y + h, height: h };
  };
  /** the whole list's own flow, every row drawn */
  const whole = (count) => {
    const at = [];
    let y = pad;
    for (let l = 0; l * cols < count; l++) {
      let tallest = 0;
      for (let i = l * cols; i < Math.min(count, (l + 1) * cols); i++) { at[i] = y; tallest = Math.max(tallest, heightOf(i)); }
      y += tallest + gap;
    }
    return { at, height: y - gap + pad };
  };
  return { list, mk, doc, top, view, flow, whole, scrollTo: (y) => { list.scrollTop = y; } };
}

const frames = [];
const withLayout = (dom, fn) => {
  const saved = { cs: globalThis.getComputedStyle, ih: globalThis.innerHeight, raf: globalThis.requestAnimationFrame };
  globalThis.getComputedStyle = (n) => ({ overflowY: n === dom.list ? 'auto' : 'visible', position: 'static' });
  globalThis.innerHeight = 2000;
  globalThis.requestAnimationFrame = (f) => { frames.push(f); return frames.length; };
  try { return fn(); } finally { globalThis.getComputedStyle = saved.cs; globalThis.innerHeight = saved.ih; globalThis.requestAnimationFrame = saved.raf; }
};
const items = (n) => Array.from({ length: n }, (_, i) => ({ i }));
/** a trade's rows: the first a wrapped title (the tallest), every seventh a wrapped name, the rest one line */
const tradeHeights = (i) => (i === 0 ? 82 : i % 7 === 3 ? 68 : 52);
const draw = (dom, its, opts = {}) => virtualRows(dom.list, its, (it) => { const r = dom.mk('button'); r.className = 'itemrow'; r.i = it.i; return r; }, opts);
const drawn = (dom) => dom.list.children.filter((c) => c.className === 'itemrow');
/** the band's stretches no drawn row covers, in pixels */
const blank = (dom) => {
  const lo = dom.top, hi = dom.top + dom.view;
  const spans = drawn(dom).map((r) => r.getBoundingClientRect()).filter((b) => b.bottom > lo && b.top < hi).sort((a, b) => a.top - b.top);
  let at = lo, gaps = 0;
  for (const b of spans) { if (b.top > at + 8) gaps += b.top - at; at = Math.max(at, b.bottom); }   // 8: a gap's own breadth is no blank
  const listFoot = dom.top + dom.flow().height - dom.list.scrollTop;
  return gaps + Math.max(0, Math.min(hi, listFoot) - at - 8);
};

test('AUDIT TRADE-VIRT a list whose rows are three heights, its first the tallest: every stop of a scroll down and back up shows rows across the whole band - no blank stretch (mutants: one pitch for every line; the band not asked again)', () => {
  for (const cols of [1, 3]) {
    const dom = laid({ cols, heightOf: tradeHeights });
    withLayout(dom, () => {
      const v = draw(dom, items(300));
      v.sync();
      const H = dom.whole(300).height;
      for (let y = 0; y < H; y += 137) { dom.scrollTo(y); v.sync(); assert.equal(blank(dom), 0, `cols ${cols}, down at ${y}: ${blank(dom)} px blank`); }
      for (let y = H; y > 0; y -= 211) { dom.scrollTo(y); v.sync(); assert.equal(blank(dom), 0, `cols ${cols}, up at ${y}: ${blank(dom)} px blank`); }
    });
  }
});

test('AUDIT TRADE-VIRT a sync never moves what is on the screen - a jump to the foot, then back up a step at a time, the lines above it measured as they come: each row in view before a sync stands where it stood after it (mutants: no hold)', () => {
  const dom = laid({ cols: 1, heightOf: tradeHeights });
  withLayout(dom, () => {
    const v = draw(dom, items(400));
    v.sync();
    dom.scrollTo(dom.whole(400).height);   // the foot, past every line never drawn
    v.sync();
    for (let k = 0; k < 40; k++) {
      dom.scrollTo(dom.list.scrollTop - 90);
      const before = new Map(drawn(dom).map((r) => [r, r.getBoundingClientRect().top]).filter(([, t]) => t < dom.top + dom.view && t > dom.top - 100));
      v.sync();
      for (const [r, t] of before) if (r.parentElement) assert.ok(Math.abs(r.getBoundingClientRect().top - t) < 0.5, `step ${k}: row ${r.i} moved ${r.getBoundingClientRect().top - t} px`);
      assert.equal(blank(dom), 0, `step ${k}: covered`);
    }
  });
});

test('AUDIT TRADE-VIRT rows reached from the top stand where the whole list stands them, and the list is the whole list\'s height once every row has been drawn (mutants: one pitch for every line)', () => {
  for (const cols of [1, 3]) {
    const dom = laid({ cols, heightOf: tradeHeights });
    withLayout(dom, () => {
      const N = 250, v = draw(dom, items(N)), want = dom.whole(N);
      v.sync();
      for (let y = 0; y <= want.height; y += 97) {
        dom.scrollTo(y); v.sync();
        for (const r of drawn(dom)) assert.equal(dom.flow().at.get(r), want.at[r.i], `cols ${cols}: row ${r.i} at its place`);
      }
      assert.equal(dom.flow().height, want.height, `cols ${cols}: the whole list's height`);
    });
  }
});

test('AUDIT TRADE-VIRT a repaint over the heights the list kept (`sizes`) shows the same rows at the same place - the scroll it gives back is the one it took; without them, a click\'s repaint moved the rows under the pointer (mutants: the sizes unkept)', () => {
  const dom = laid({ cols: 1, heightOf: tradeHeights });
  withLayout(dom, () => {
    const its = items(300), sizes = new WeakMap();
    let v = draw(dom, its, { sizes });
    v.sync();
    for (let y = 0; y <= 6000; y += 300) { dom.scrollTo(y); v.sync(); }
    const kept = dom.list.scrollTop;
    const shown = drawn(dom).filter((r) => { const b = r.getBoundingClientRect(); return b.bottom > dom.top && b.top < dom.top + dom.view; }).map((r) => [r.i, r.getBoundingClientRect().top]);
    // the repaint: the list rebuilt, measured and spaced first, the scroll given back, the window aimed
    v.dispose();
    dom.list.children.length = 0;
    dom.list.scrollTop = 0;
    v = draw(dom, its, { sizes });
    v.sync({ draw: false });
    dom.list.scrollTop = kept;
    v.sync();
    for (const [i, t] of shown) {
      const r = drawn(dom).find((x) => x.i === i);
      assert.ok(r && Math.abs(r.getBoundingClientRect().top - t) < 0.5, `row ${i} where it stood (${r?.getBoundingClientRect().top} vs ${t})`);
    }
  });
});

test('AUDIT TRADE-VIRT one height: laid exactly as before - every drawn row at the whole list\'s place, from the first sync (the estimate is the truth)', () => {
  const dom = laid({ cols: 4, heightOf: () => 50 });
  withLayout(dom, () => {
    const N = 300, v = draw(dom, items(N)), want = dom.whole(N);
    v.sync();
    dom.scrollTo(2000); v.sync();
    for (const r of drawn(dom)) assert.equal(dom.flow().at.get(r), want.at[r.i]);
    assert.equal(dom.flow().height, want.height);
  });
});

test('AUDIT TRADE-VIRT a resize lets the kept heights go - they were another layout\'s (mutants: the heights kept across a remeasure)', () => {
  let tall = false;
  const dom = laid({ cols: 1, heightOf: (i) => (tall ? 90 : 52) + (i === 0 ? 30 : 0) });
  withLayout(dom, () => {
    const its = items(200), sizes = new WeakMap(), v = draw(dom, its, { sizes });
    v.sync();
    assert.equal(sizes.get(its[1]), 52);
    dom.scrollTo(150 * 56); v.sync();   // row 150 drawn and measured in this layout
    assert.equal(sizes.get(its[150]), 52);
    dom.scrollTo(0); v.sync();
    tall = true;   // a narrower window: every name wraps
    v.sync({ remeasure: true });
    assert.equal(sizes.get(its[1]), 90, 'measured again in the new layout');
    assert.ok(!(sizes.get(its[150]) > 0), 'and a row not drawn since holds nothing of the old one');
  });
});

test('AUDIT TRADE-VIRT a list whose first rows are tall and the rest short: a jump deep into it is covered in the one sync - the window drawn on the first rows\' guess measured short of the band, and is aimed again until it covers it (mutants: the band not asked again)', () => {
  const dom = laid({ cols: 1, view: 600, heightOf: (i) => (i < 48 ? 120 : 28) });
  withLayout(dom, () => {
    const v = draw(dom, items(600));
    v.sync();
    dom.scrollTo(9000);
    v.sync();
    assert.equal(blank(dom), 0, `covered at once: ${blank(dom)} px blank`);
  });
});
