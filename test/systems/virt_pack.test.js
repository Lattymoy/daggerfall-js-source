// VIRT (2026-10-16) - THE LONG PACK: a long list draws the rows on screen, a landed picture goes into its own tile, an
// ask keeps a fitted picture, and an item's line is read once a pass.
//
// The windowing is DRIVEN over a document that lays its rows out (a wrapping grid of fixed rows and a gap, the dock's
// shape, or one column, the loot window's): every drawn row must stand exactly where the whole list stands it, the list
// must be exactly as tall, and the rows a scroll keeps must be the same nodes. The picture is driven too - a real
// replacement record through requestIcon and the fitted door into a mounted pack - and the browser half is
// tools/packVirtProbe.mjs (700 pieces, a container, the player's storage and the pack, a desktop and a phone).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { virtualRows, VIRTUAL_MIN, VIRTUAL_FIRST } from '../../src/ui/virtualRows.js';
import { requestFittedPicture, requestFittedIcon, _fittedKeys, FIT_CACHE_MAX, FIT_CACHE_BYTES } from '../../src/ui/textureCanvas.js';
import { setDfmodSources, clearDfmodSources } from '../../src/systems/dfmodTextures.js';
import { mountEnhancedInventory, itemLine } from '../../src/ui/enhanced/enhancedInventory.js';
import { fakeDom, withDom } from '../invdrag.mjs';
import { makeCanvas, FakeImage, settle, canvases } from '../virtFakes.mjs';   // TRADE-VIRT: the picture fakes, the trade windows' pins' too
import { createWeapon } from '../../src/combat/enemyEquipment.js';
import { inventoryItemImage } from '../../src/systems/item/itemTemplates.js';
import { textureKey, setTextureReplacements, clearTextureReplacements, preloadTextureRecord } from '../../src/systems/textureReplacement.js';
import { setValue, _resetForTests as _resetSettings } from '../../src/systems/settings/settings.js';
import { _resetForTests } from '../../src/systems/uiPrefs.js';

// ── A DOCUMENT THAT LAYS OUT ─────────────────────────────────────

/** One list in a box that scrolls: its children flow `cols` to a line of `rowH`, `gap` between lines, `pad` above the
 *  first; a spacer (`.vrows-gap`) is a whole line of its own height. Every rect is computed from the flow as it stands. */
function laidList({ cols = 4, rowH = 50, gap = 6, pad = 8, top = 100, view = 300, measurable = true, around = [] } = {}) {
  const heard = new Map();
  const doc = { createElement: (t) => mk(t), activeElement: null };
  /** @returns {any} */
  function mk(tag) {
    const n = {
      tagName: tag.toUpperCase(), nodeType: 1, children: [], parentElement: null, style: {}, className: '', attrs: {}, ownerDocument: doc,
      get isConnected() { let a = n; while (a.parentElement) a = a.parentElement; return a === root; },
      get firstChild() { return n.children[0] ?? null; },
      contains(x) { for (let a = x; a; a = a.parentElement) if (a === n) return true; return false; },
      hasAttribute(k) { return k in n.attrs; },
      focus() { doc.activeElement = n; },
      append(...cs) { for (const c of cs) { c.remove(); c.parentElement = n; n.children.push(c); } },
      insertBefore(c, ref) { c.remove(); c.parentElement = n; const i = ref ? n.children.indexOf(ref) : -1; if (i < 0) n.children.push(c); else n.children.splice(i, 0, c); return c; },
      remove() { const p = n.parentElement; if (!p) return; p.children.splice(p.children.indexOf(n), 1); n.parentElement = null; },
      setAttribute(k, v) { n.attrs[k] = String(v); },
      addEventListener(t, f) { heard.set(t, [...(heard.get(t) ?? []), f]); },
      removeEventListener(t, f) { heard.set(t, (heard.get(t) ?? []).filter((x) => x !== f)); },
      getBoundingClientRect() { return rectOf(n); },
    };
    return n;
  }
  const list = mk('div');
  list.scrollTop = 0;
  // AUDIT VIRT: the boxes round the list, innermost first - each its own box and its own style (a clip, a fixed box)
  let root = list;
  for (const a of around) { const b = mk('div'); b._rect = { top: a.top, bottom: a.bottom, height: a.bottom - a.top }; b._cs = { overflowY: a.overflowY ?? 'visible', position: a.position ?? 'static' }; root.parentElement = b; b.children.push(root); root = b; }
  /** Each child's top in the content, and the content's height. */
  const flow = () => {
    const at = new Map();
    let y = pad, inLine = 0;
    for (const c of list.children) {
      if (c.className === 'vrows-gap') {
        if (inLine) { y += rowH + gap; inLine = 0; }
        at.set(c, y);
        y += parseFloat(c.style.height) + gap;
        continue;
      }
      at.set(c, y);
      if (++inLine === cols) { y += rowH + gap; inLine = 0; }
    }
    if (inLine) y += rowH + gap;
    return { at, height: y - gap + pad };
  };
  const rectOf = (n) => {
    if (n._rect) return n._rect;
    if (n === list) return { top, bottom: top + view, height: view };
    if (!measurable) return { top: 0, bottom: 0, height: 0 };
    const y = top + flow().at.get(n) - list.scrollTop;
    const h = n.className === 'vrows-gap' ? parseFloat(n.style.height) : rowH;
    return { top: y, bottom: y + h, height: h };
  };
  const frames = [];
  return {
    list, mk, heard, doc, frames,
    /** Run the frames asked for so far, as the browser's next one would. */
    flush: () => { const fs = frames.splice(0); for (const f of fs) f(); return fs.length; },
    /** The list scrolled, as the browser tells it: its listeners hear it. */
    scroll: (y) => { list.scrollTop = y; for (const f of heard.get('scroll') ?? []) f(); },
    height: () => flow().height,
    /** The whole list's content height for `n` rows. */
    whole: (n) => pad + Math.ceil(n / cols) * (rowH + gap) - gap + pad,
    /** Where the whole list stands row `i`. */
    placeOf: (i) => pad + Math.floor(i / cols) * (rowH + gap),
    topOf: (n) => flow().at.get(n),
    set cols(c) { cols = c; },
  };
}
const withLayout = (fn) => {
  const saved = { cs: globalThis.getComputedStyle, ih: globalThis.innerHeight, raf: globalThis.requestAnimationFrame };
  return (dom) => {
    globalThis.getComputedStyle = (n) => n._cs ?? { overflowY: n === dom.list ? 'auto' : 'visible', position: 'static' };
    globalThis.innerHeight = 1000;
    globalThis.requestAnimationFrame = (f) => { dom.frames.push(f); return dom.frames.length; };
    try { return fn(dom); } finally { globalThis.getComputedStyle = saved.cs; globalThis.innerHeight = saved.ih; globalThis.requestAnimationFrame = saved.raf; }
  };
};
const items = (n) => Array.from({ length: n }, (_, i) => ({ i }));
/** Draw `its` into the laid list; every row it builds is counted, and carries its item's index. */
const drawInto = (dom, its) => {
  let built = 0;
  const v = virtualRows(dom.list, its, (it) => { built++; const r = dom.mk('button'); r.className = 'itemrow'; r.i = it.i; return r; });
  return { v, built: () => built };
};
const drawn = (dom) => dom.list.children.filter((c) => c.className === 'itemrow');
/** Every drawn row stands where the whole list stands it, and the list is the whole list's height. */
const placedRight = (dom, n) => {
  for (const r of drawn(dom)) assert.equal(dom.topOf(r), dom.placeOf(r.i), `row ${r.i} at its place`);
  assert.equal(dom.height(), dom.whole(n), 'the list as tall as the whole list');
};
/** The rows whose box meets the view, by index. */
const seen = (dom) => drawn(dom).filter((r) => { const b = r.getBoundingClientRect(); return b.bottom > 100 && b.top < 400; }).map((r) => r.i);

test('VIRT rows: a list under VIRTUAL_MIN is drawn whole, every row in order, with no spacer - what every list was', () => {
  withLayout((dom) => {
    const { v, built } = drawInto(dom, items(VIRTUAL_MIN - 1));
    v.sync();
    assert.equal(built(), VIRTUAL_MIN - 1);
    assert.deepEqual(drawn(dom).map((r) => r.i), items(VIRTUAL_MIN - 1).map((x) => x.i));
    assert.equal(dom.list.children.length, VIRTUAL_MIN - 1, 'no spacer');
    assert.equal(dom.heard.get('scroll'), undefined, 'and nothing listened to');
  })(laidList());
});

test('VIRT rows: a long list draws the rows in view and a margin, every drawn row at the whole list\'s place, the list the whole list\'s height - at its top, its middle and its foot (mutants: the spacer\'s gap not taken off; the window never moved)', () => {
  withLayout((dom) => {
    const N = 700;
    const { v, built } = drawInto(dom, items(N));
    assert.equal(built(), VIRTUAL_FIRST, 'before it is measured: the first rows');
    v.sync({ draw: false });
    placedRight(dom, N);   // measured, and the spacer stood for the rest - a scroll given back has its room
    v.sync();
    placedRight(dom, N);
    assert.ok(drawn(dom).length < 100, `${drawn(dom).length} drawn of ${N}`);
    assert.deepEqual(seen(dom), Array.from({ length: seen(dom).length }, (_, i) => i), 'the top of the list in view');
    for (const at of [9000, 4550, 1, 0, dom.whole(N) - 300]) {
      dom.list.scrollTop = at;
      v.sync();
      placedRight(dom, N);
      const s = seen(dom);
      assert.ok(s.length >= 20, `${s.length} rows seen at ${at}`);
      const first = Math.floor(Math.max(0, at - 8) / 56) * 4;
      assert.equal(s[0], first, `the first row in view at ${at} is the whole list's`);
      assert.deepEqual(s, Array.from({ length: s.length }, (_, i) => first + i), `every row in view at ${at}, none missing`);
    }
    assert.equal(drawn(dom).at(-1).i, N - 1, 'at the foot the last piece is drawn');
    assert.equal(dom.list.children.at(-1).className, 'itemrow', '...and nothing stands below it');
  })(laidList());
});

test('VIRT rows: a scroll keeps the rows it keeps - the same nodes, never rebuilt - and a scroll inside the margin rebuilds nothing at all; one column (the loot window) is laid the same way (mutants: the window rebuilt whole on every move)', () => {
  withLayout((dom) => {
    const { v, built } = drawInto(dom, items(400));
    v.sync();
    const before = new Map(drawn(dom).map((r) => [r.i, r]));
    const n0 = built();
    dom.list.scrollTop = 56;   // one line: still inside the margin
    v.sync();
    assert.equal(built(), n0, 'a line\'s scroll builds nothing');
    dom.list.scrollTop = 600;   // ten lines: past the margin, the window overlapping the one before
    v.sync();
    const after = drawn(dom);
    const kept = after.filter((r) => before.has(r.i));
    assert.ok(built() > n0, 'the window moved');
    assert.ok(kept.length > 0 && kept.length < before.size, 'and overlaps the one before');
    for (const r of kept) assert.equal(r, before.get(r.i), `row ${r.i} is the node it was`);
    assert.equal(built() - n0, after.length - kept.length, 'only the rows that entered were built');
    placedRight(dom, 400);
  })(laidList());
  withLayout((dom) => {
    const { v } = drawInto(dom, items(300));
    v.sync();
    dom.list.scrollTop = 7000;
    v.sync();
    placedRight(dom, 300);
  })(laidList({ cols: 1, rowH: 52, gap: 0, pad: 0 }));
});

test('VIRT rows: measured again when the columns change (a resize), the window is laid on the new ones; a list that cannot be measured is drawn whole; a disposed list lets go of its scroll', () => {
  const lay = laidList();
  withLayout((dom) => {
    const { v } = drawInto(dom, items(500));
    v.sync();
    dom.list.scrollTop = 3000;
    v.sync();
    dom.cols = 3;
    v.sync({ remeasure: true });
    dom.list.scrollTop = 3001;
    v.sync();
    for (const r of drawn(dom)) assert.equal(dom.topOf(r), 8 + Math.floor(r.i / 3) * 56, `row ${r.i} on three columns`);
    assert.equal(dom.height(), 8 + Math.ceil(500 / 3) * 56 - 6 + 8);
    assert.equal(dom.heard.get('scroll').length, 1, 'its scroller listened to');
    v.dispose();
    assert.equal(dom.heard.get('scroll').length, 0, 'and let go');
  })(lay);
  withLayout((dom) => {
    const { v, built } = drawInto(dom, items(300));
    v.sync();
    assert.equal(built(), 300, 'no layout to measure: every row');
    assert.equal(v.whole, true);
    assert.deepEqual(drawn(dom).map((r) => r.i), items(300).map((x) => x.i));
  })(laidList({ measurable: false }));
});

test('VIRT rows: the window follows the list\'s own scroll - the browser\'s scroll heard, one frame later the rows in view drawn; and the spacers are no scroll anchor (mutants: the scroll heard and never followed; the browser\'s anchor left on)', () => {
  withLayout((dom) => {
    const { v } = drawInto(dom, items(700));
    v.sync();
    assert.equal(dom.list.style.overflowAnchor, 'none', 'a long list is no scroll anchor');
    dom.scroll(5000);
    dom.scroll(5003);   // two in one frame: one aim
    assert.equal(dom.frames.length, 1, 'one frame asked for');
    dom.flush();
    placedRight(dom, 700);
    const s = seen(dom);
    assert.equal(s[0], Math.floor((5003 - 8) / 56) * 4, 'the rows in view drawn');
    v.dispose();
    dom.scroll(9000);
    assert.equal(dom.frames.length, 0, 'disposed, it hears nothing');
  })(laidList());
  withLayout((dom) => {
    drawInto(dom, items(VIRTUAL_MIN - 1));
    assert.equal(dom.list.style.overflowAnchor, undefined, 'a short list is left as it was');
  })(laidList());
});

test('VIRT rows: a partial last line at the foot - 701 pieces on four columns: the last piece drawn alone on its line, the list the whole list\'s height, nothing built past the end (mutants: the window past the last piece; the partial line not counted)', () => {
  withLayout((dom) => {
    const { v } = drawInto(dom, items(701));
    v.sync();
    dom.scroll(dom.whole(701) - 300);
    dom.flush();
    placedRight(dom, 701);
    assert.equal(drawn(dom).at(-1).i, 700, 'the last piece');
    dom.scroll(0);
    dom.flush();
    placedRight(dom, 701);
  })(laidList());
});

test('VIRT rows: the margin is half the band and never under two lines - after a real aim, a scroll of two lines (a band of 300) or of one (a band of 50) builds nothing (mutants: the margin\'s share or its floor cut)', () => {
  for (const [view, step] of [[300, 112], [50, 56]]) {
    withLayout((dom) => {
      const { v, built } = drawInto(dom, items(700));
      v.sync();
      dom.scroll(600);
      dom.flush();
      const n0 = built();
      assert.ok(n0 > VIRTUAL_FIRST, 'it aimed');
      dom.scroll(600 + step);
      dom.flush();
      assert.equal(built(), n0, `a band of ${view}: ${step} px inside the margin`);
      placedRight(dom, 700);
    })(laidList({ view }));
  }
});

test('VIRT rows: the band is the screen cut by every box that clips the list - up to a fixed box, whose own clip-holders cut nothing; a list hidden whole by a box round it follows its own scroll (mutants: the boxes round it ignored; no stop at the fixed box; the hidden list never aimed)', () => {
  // a box round it clips to 60 px: only that band and its margin are drawn
  withLayout((dom) => {
    const { v } = drawInto(dom, items(700));
    v.sync();
    dom.scroll(3000);
    dom.flush();
    placedRight(dom, 700);
    assert.ok(drawn(dom).length <= 24, `${drawn(dom).length} drawn for a 60 px band`);
    assert.ok(seen(dom).includes(Math.floor((3000 - 8) / 56) * 4), 'the band\'s rows drawn');
  })(laidList({ around: [{ top: 100, bottom: 160, overflowY: 'hidden' }] }));
  // the same clip ABOVE a fixed box clips nothing of it
  withLayout((dom) => {
    const { v } = drawInto(dom, items(700));
    v.sync();
    dom.scroll(3000);
    dom.flush();
    const s = seen(dom);
    assert.equal(s.at(-1) - s[0] + 1, s.length, 'none missing');
    assert.ok(s.length >= 20, `${s.length} rows in view: the whole band, not 60 px of it`);
  })(laidList({ around: [{ top: 0, bottom: 1000, position: 'fixed' }, { top: 100, bottom: 130, overflowY: 'hidden' }] }));
  // a box round it that hides it whole: the window still follows the list's scroll
  withLayout((dom) => {
    const { v } = drawInto(dom, items(700));
    v.sync();
    dom.scroll(5000);
    dom.flush();
    placedRight(dom, 700);
    const s = seen(dom);
    assert.ok(s.length >= 20 && s[0] === Math.floor((5000 - 8) / 56) * 4, `the rows at the list's own scroll (${s[0]}, ${s.length})`);
  })(laidList({ around: [{ top: 500, bottom: 600, overflowY: 'hidden' }] }));
});

test('VIRT rows: a row holding the focus that the window takes away hands it to the list - out of the Tab order - and the caller is told each time the window moves, never when it stands (mutants: the focus dropped to the page; the caller never told)', () => {
  withLayout((dom) => {
    let told = 0;
    const v = virtualRows(dom.list, items(700), (it) => { const r = dom.mk('button'); r.className = 'itemrow'; r.i = it.i; return r; }, { onAim: () => told++ });
    v.sync();
    assert.equal(told, 0, 'the first rows stand at the top: nothing moved');
    drawn(dom)[3].focus();
    dom.scroll(56);
    dom.flush();
    assert.equal(told, 0, 'a window that stands tells nothing');
    dom.scroll(20000);
    dom.flush();
    assert.equal(told, 1, 'the window moved');
    assert.equal(dom.doc.activeElement, dom.list, 'the list holds the focus');
    assert.equal(dom.list.tabIndex, -1, 'out of the Tab order');
  })(laidList());
});

// ── THE FITTED PICTURES ──────────────────────────────────────────

test('VIRT cache: a fitted picture asked for again goes to the back of the line - the bound lets go of the one asked LEAST recently, so a picture a screen keeps asking for stays (mutant: the bound by the order made)', () => {
  const key = (s) => `${s}@10x1c4`;
  requestFittedPicture('virtLRU_keep', () => null, { box: 10 });
  for (let i = 0; i < FIT_CACHE_MAX - 1; i++) requestFittedPicture(`virtLRU_${i}`, () => null, { box: 10 });
  requestFittedPicture('virtLRU_keep', () => null, { box: 10 });   // asked again: used
  requestFittedPicture('virtLRU_new', () => null, { box: 10 });
  const keys = _fittedKeys();
  assert.ok(keys.length <= FIT_CACHE_MAX);
  assert.ok(keys.includes(key('virtLRU_keep')), 'the picture asked again stays');
  assert.ok(!keys.includes(key('virtLRU_0')), 'the one asked longest ago went');
  assert.ok(keys.includes(key('virtLRU_new')));
  assert.ok(FIT_CACHE_MAX >= 2000, 'a long store\'s pictures, at two boxes, fit');
});

/** The fitted door's whole chain over the fakes above, for the length of `fn`. */
async function withPictures(fn, { pad = 0, Image = FakeImage } = {}) {
  const saved = { doc: globalThis.document, img: globalThis.Image };
  globalThis.document = { createElement: () => makeCanvas(() => pad) };
  globalThis.Image = Image;
  try { return await fn(); } finally {
    if (saved.doc === undefined) delete globalThis.document; else globalThis.document = saved.doc;
    if (saved.img === undefined) delete globalThis.Image; else globalThis.Image = saved.img;
  }
}

test('VIRT cache: a picture asked for again is the picture, every time - made once (mutant: the hit put back as nothing)', async () => {
  await withPictures(async () => {
    let asks = 0;
    const ask = () => { asks++; return 'data:image/png;src-6x6'; };
    assert.equal(requestFittedPicture('virtHit', ask, { box: 48 }), null, 'cold');
    await settle();
    const a = requestFittedPicture('virtHit', ask, { box: 48 });
    assert.deepEqual(a, { src: 'data:image/png;src-24x24', w: 24, h: 24, smooth: false });
    assert.equal(requestFittedPicture('virtHit', ask, { box: 48 }), a, 'and again');
    assert.equal(asks, 2, 'its door asked to make it and read once, never again');
  });
});

test('VIRT cache: a long store\'s pictures at both of its boxes - 312 kinds, 624 pictures, the probe\'s pile - are kept whole: a second pass down it makes none (mutant: the bound back at 600)', async () => {
  await withPictures(async () => {
    let made = 0;
    const ask = (w) => { if (!w) made++; return 'data:image/png;src-6x6'; };
    const pass = async () => { for (let k = 0; k < 312; k++) for (const box of [48, 30]) requestFittedPicture(`virtPass${k}`, ask, { box }); await settle(); };
    await pass();
    assert.equal(made, 624);
    await pass();
    assert.equal(made, 624, 'the second pass made nothing');
  });
});

test('VIRT cache: never more than FIT_CACHE_BYTES of picture - large pictures go, the one asked longest ago first, well before the count (mutant: the bytes unbounded)', async () => {
  const pad = 100_000;
  await withPictures(async () => {
    const ask = () => 'data:image/png;src-6x6';
    for (let i = 0; i < 200; i++) requestFittedPicture(`virtBig${i}`, ask, { box: 48 });
    await settle();
    const kept = _fittedKeys().filter((k) => k.startsWith('virtBig'));
    const fits = Math.floor(FIT_CACHE_BYTES / ('data:image/png;src-24x24'.length + pad));
    assert.ok(kept.length <= fits && kept.length >= fits - 1, `${kept.length} kept, ${fits} fit`);
    assert.ok(kept.includes('virtBig199@48x1c4'), 'the newest kept');
    assert.ok(!kept.includes('virtBig0@48x1c4'), 'the oldest gone');
  }, { pad });
});

test('VIRT cache: a picture put out while it was made comes back as it lands - and the bound is kept then too (mutant: no trim at a landing)', async () => {
  await withPictures(async () => {
    let src = null;
    const wakes = [];
    requestFittedPicture('virtLate', (w) => { if (w) wakes.push(w); return src; }, { box: 48 });
    for (let i = 0; i < FIT_CACHE_MAX; i++) requestFittedPicture(`virtFill${i}`, () => null, { box: 48 });
    assert.ok(!_fittedKeys().includes('virtLate@48x1c4'), 'put out while it was made');
    src = 'data:image/png;src-6x6';
    wakes[0]();
    await settle();
    assert.ok(_fittedKeys().includes('virtLate@48x1c4'), 'it lands and is kept');
    assert.ok(_fittedKeys().length <= FIT_CACHE_MAX, `${_fittedKeys().length} kept`);
  });
});

test('VIRT cache: a source that said it landed and reads as nothing when its picture is made (the mods changed between) is asked again - never kept as a picture that never comes (mutant: the empty entry kept)', async () => {
  await withPictures(async () => {
    let src = null;
    const wakes = [];
    let told = 0;
    const ask = (w) => { if (w) wakes.push(w); return src; };
    requestFittedPicture('virtGone', ask, { box: 48, onReady: () => told++ });
    wakes[0]();
    assert.equal(told, 1, 'its screen is told to ask again');
    src = 'data:image/png;src-6x6';
    assert.equal(requestFittedPicture('virtGone', ask, { box: 48 }), null, 'asked again, it is made again');
    await settle();
    assert.equal(requestFittedPicture('virtGone', ask, { box: 48 })?.src, 'data:image/png;src-24x24');
  });
});

test('VIRT cache: the attached texture mods changing drops the fitted pictures with requestIcon\'s - a slot asked again draws the new mod\'s picture, and one made from a set replaced while it was made is not kept (mutants: the fitted cache blind to the mods; the old set\'s make kept)', async () => {
  setValue('Enhancements', 'AssetInjection', 'True');
  let open = () => {};
  const gate = new Promise((r) => { open = r; });
  let hold = false;
  const bundle = (title, size) => {
    const manifest = JSON.stringify({ ModTitle: title, ModVersion: '1.1', ModAuthor: 'K', GUID: title });
    return {
      textAssets: [{ name: `${title}.dfmod`, bytes: new TextEncoder().encode(manifest), get text() { return manifest; } }],
      textures: [{ name: '233_5-0', width: size, height: size, format: 4 }],
      rgba: async () => { if (hold) await gate; return { width: size, height: size, data: new Uint8Array(size * size * 4).fill(200) }; },
      close() {},
    };
  };
  const bundles = { 'dfmod/virta.dfmod': bundle('VirtA', 4), 'dfmod/virtb.dfmod': bundle('VirtB', 9) };
  const stored = new Map();
  const mods = { open: async (bytes) => bundles[new TextDecoder().decode(bytes)], saveIndex: async (k, j) => { stored.set(k, new TextEncoder().encode(j)); }, background: false };
  const load = async (k) => stored.get(k) ?? (bundles[k] ? new TextEncoder().encode(k) : null);
  const fit = () => requestFittedIcon(233, 5, { box: 48, dpr: 1 })?.src ?? null;
  try {
    await withPictures(async () => {
      await setDfmodSources(['dfmod/virta.dfmod'], load, mods);
      fit(); await settle();
      assert.equal(fit(), 'data:image/png;src-16x16', 'mod A\'s 4x4, fitted');
      await setDfmodSources(['dfmod/virtb.dfmod'], load, mods);
      fit(); await settle();
      assert.equal(fit(), 'data:image/png;src-36x36', 'mod B\'s 9x9 - not A\'s kept');
      // A again, its picture held in the making while the set changes back to B under it
      hold = true;
      await setDfmodSources(['dfmod/virta.dfmod'], load, mods);
      fit();
      hold = false;
      await setDfmodSources(['dfmod/virtb.dfmod'], load, mods);
      open();
      await settle();
      fit(); await settle();
      assert.equal(fit(), 'data:image/png;src-36x36', 'what A made under B is not B\'s picture');
    });
  } finally { clearDfmodSources(); _resetSettings(); }
});

test('VIRT cache: a picture still being fitted when the attached mods change is not kept - its screens ask again and get the new set\'s (mutant: the old set\'s make kept)', async () => {
  let open = () => {};
  const decoded = new Promise((r) => { open = r; });
  class HeldImage extends FakeImage { decode() { return decoded; } }
  const manifest = JSON.stringify({ ModTitle: 'VirtC', ModVersion: '1.1', ModAuthor: 'K', GUID: 'VirtC' });
  const bundle = { textAssets: [{ name: 'VirtC.dfmod', bytes: new TextEncoder().encode(manifest), get text() { return manifest; } }], textures: [{ name: '300_1-0', width: 2, height: 2, format: 4 }], rgba: async () => null, close() {} };
  const stored = new Map();
  try {
    await withPictures(async () => {
      let src = 'data:image/png;src-6x6';
      let told = 0;
      const ask = () => src;
      requestFittedPicture('virtHeld', ask, { box: 48, onReady: () => told++ });   // made at once, held in its decode
      await setDfmodSources(['dfmod/virtc.dfmod'], async (k) => stored.get(k) ?? (k === 'dfmod/virtc.dfmod' ? new TextEncoder().encode(k) : null),
        { open: async () => bundle, saveIndex: async (k, j) => { stored.set(k, new TextEncoder().encode(j)); }, background: false });
      requestFittedPicture('virtElse', () => null, { box: 48 });   // another screen asks after the change, before the landing
      src = 'data:image/png;src-7x7';
      open();
      await settle();
      assert.equal(told, 1, 'its screen told to ask again');
      assert.equal(requestFittedPicture('virtHeld', ask, { box: 48 }), null, 'the old set\'s picture was not kept');
      await settle();
      assert.equal(requestFittedPicture('virtHeld', ask, { box: 48 })?.src, 'data:image/png;src-28x28', 'the new set\'s');
    }, { Image: HeldImage });
  } finally { clearDfmodSources(); }
});

// ── A PICTURE LANDS INTO ITS TILE ────────────────────────────────

/** The fakes above, in a fake document: its canvases ours, its other nodes its own. */

test('VIRT tiles: a cold picture landing goes into the tile that waited on it - the same row, its wear bar kept, exactly the fitted door\'s picture - and the pack is not repainted; a picture landing alone leaves the others waiting, each to take its own as it lands; pictures that land together are one frame\'s pass (mutants: a landing repaints the pack; the tile left on its initials; the wear bar lost; the still-waiting tiles thrown away; a frame a landing)', async () => {
  _resetForTests();
  globalThis.location = { search: '?skin=enhanced' };
  setValue('Enhancements', 'AssetInjection', 'True');
  const dom = fakeDom();
  const Image = canvases(dom);
  const frames = [];
  const saved = { doc: globalThis.document, add: globalThis.addEventListener, rem: globalThis.removeEventListener, raf: globalThis.requestAnimationFrame, img: globalThis.Image };
  Object.assign(globalThis, { document: dom.doc, addEventListener: dom.win.addEventListener, removeEventListener: dom.win.removeEventListener, requestAnimationFrame: (f) => { frames.push(f); return frames.length; }, Image });
  const flush = () => { const fs = frames.splice(0); for (const f of fs) f(); return fs.length; };
  let view = null;
  try {
    const e = { isPlayer: true, name: 'Aelwyn', career: { name: 'Spellsword' }, level: 5, stats: { strength: 50, endurance: 48 }, activeEffects: [], spells: [], items: [], goldPieces: 0 };
    const blades = [createWeapon(113, 3), createWeapon(116, 3), createWeapon(120, 3)];
    for (const b of blades) b.currentCondition = Math.round(b.maxCondition / 2);   // worn: each tile carries a bar
    e.items = blades;
    // each record's bytes held back behind its own gate until the pack has mounted and settled (the doll's own repaint is
    // a repaint): the door's read joins the one made here, so a picture lands when its gate opens and not before
    const keyOf = (b) => { const img = inventoryItemImage(b, e); return [img, textureKey(img.archive, img.record, 0, 'Albedo', img.dye)]; };
    const gates = new Map(), opens = new Map();
    for (const b of blades) { const [, k] = keyOf(b); gates.set(k, new Promise((res) => opens.set(k, res))); }
    assert.equal(gates.size, 3, 'three pictures, not one');
    clearTextureReplacements();
    setTextureReplacements([...gates.keys()].map((k) => `${k}.png`), async (name) => { await gates.get(String(name).replace(/\.png$/, '')); return new Uint8Array([1]); });
    const reads = blades.map((b) => { const [img] = keyOf(b); return preloadTextureRecord(img.archive, img.record, 0, 'Albedo', img.dye, { decode: async () => ({ width: 2, height: 2, data: new Uint8Array(16).fill(255) }) }); });
    const host = dom.mk('div');
    dom.body.append(host);
    view = mountEnhancedInventory(host, { entity: e, items: () => e.items, onExit: () => {} });
    await settle();
    flush();
    const rows = host.querySelectorAll('.itemrow');
    const tiles = rows.map((r) => r.querySelector('.tile'));
    assert.deepEqual(tiles.map((t) => t.classList.contains('has-icon')), [false, false, false], 'cold: the initials');
    assert.ok(tiles.every((t) => t.querySelector('.wear')), 'and their wear bars');
    const repaints = JSON.parse(globalThis.__pack()).repaints;
    const land = async (i) => { opens.get(keyOf(blades[i])[1])(); await reads[i]; await settle(); };
    // the first alone
    const passes = () => JSON.parse(globalThis.__pack()).landings;
    await land(0);
    assert.ok(frames.length >= 1, 'the landing asked for a frame');
    flush();
    assert.equal(passes(), 1, 'one pass');
    const now = rows[0].querySelector('.tile');
    assert.equal(host.querySelectorAll('.itemrow')[0], rows[0], 'the same row - nothing rebuilt it');
    assert.notEqual(now, tiles[0], 'its tile swapped');
    assert.equal(now.querySelector('img')?.src, 'data:image/png;src-8x8', 'for the fitted door\'s own picture: a 2x2 record at four pixels a pixel');
    assert.ok(now.querySelector('.wear'), 'the wear bar carried into it');
    assert.equal(rows[1].querySelector('.tile'), tiles[1], 'the second still waits, as it was');
    assert.equal(rows[2].querySelector('.tile'), tiles[2], 'and the third');
    // the other two together
    await land(1);
    await land(2);
    flush();
    assert.equal(passes(), 2, 'two landings, one more pass');
    assert.deepEqual(rows.map((r) => r.querySelector('.tile').querySelector('img')?.src ?? null), ['data:image/png;src-8x8', 'data:image/png;src-8x8', 'data:image/png;src-8x8'], 'every tile its picture');
    assert.equal(JSON.parse(globalThis.__pack()).repaints, repaints, 'the pack was not repainted');
    assert.equal(JSON.parse(globalThis.__pack()).painted, 3, 'three tiles painted, each once');
    await settle();
    assert.equal(flush(), 0, 'nothing more to do');
  } finally {
    view?.unmount();
    clearTextureReplacements();
    Object.assign(globalThis, { document: saved.doc, addEventListener: saved.add, removeEventListener: saved.rem, requestAnimationFrame: saved.raf, Image: saved.img });
    if (saved.doc === undefined) delete globalThis.document;
    if (saved.img === undefined) delete globalThis.Image;
    _resetSettings();
  }
});

// ── AN ITEM'S LINE, ONCE A PASS ──────────────────────────────────

test('VIRT lines: a repaint reads every line again - a stack that changed under the open pack says its new count on the next repaint, in the pack and in the store beside it (mutant: the lines kept across passes; the read once a pass is pinned by the store\'s search below)', () => {
  _resetForTests();
  globalThis.location = { search: '?skin=enhanced' };
  withDom((dom) => {
    const arrows = createWeapon(131, 3);
    arrows.stackCount = 40;
    const stored = createWeapon(131, 3);
    stored.stackCount = 12;
    const e = { isPlayer: true, name: 'Aelwyn', career: { name: 'Spellsword' }, level: 5, stats: { strength: 50, endurance: 48 }, activeEffects: [], spells: [], items: [arrows], goldPieces: 0 };
    const store = [stored];
    const host = dom.mk('div');
    dom.body.append(host);
    const view = mountEnhancedInventory(host, { entity: e, items: () => e.items, loot: { items: () => store, storage: true }, onExit: () => {} });
    const names = () => host.querySelectorAll('.itemrow').map((r) => r.querySelectorAll('.itemname')[0].children[0].textContent);
    assert.deepEqual(names(), ['Arrow ×40', 'Arrow ×12']);
    arrows.stackCount = 7;
    stored.stackCount = 3;
    view.repaint();
    assert.deepEqual(names(), ['Arrow ×7', 'Arrow ×3'], 'the repaint read them again');
    view.unmount();
  });
});

// ── THE PACK'S OWN LONG LIST, LAID OUT ───────────────────────────

/** AUDIT VIRT: test/invdrag.mjs's document, with the loot window's list laid out as a browser lays it - one column of
 *  52 px rows (a spacer its own height) in a 300 px box that scrolls, its scroll CLAMPED to its content whenever it is
 *  laid out or set, as a browser clamps it - and what virtualRows and the scroll keeper read of a node (its parent,
 *  whether it is in the page, its listeners, its focus). The pack's host is a fixed box that clips, as the door's is. */
function layLoot(dom, { rowH = 52, top = 100, view = 300 } = {}) {
  const isList = (n) => !!n.classList?.contains('remotelist');
  const content = (l) => { let y = 0; const at = new Map(); for (const c of l.children) { at.set(c, y); y += c.className === 'vrows-gap' ? parseFloat(c.style.height) : rowH; } return { at, height: y }; };
  const clamp = (l) => { const max = Math.max(0, content(l).height - view); if ((l._st ?? 0) > max) l._st = max; };
  const mk0 = dom.doc.createElement;
  dom.doc.activeElement = null;
  dom.doc.createElement = (t) => {
    const n = mk0(t);
    const heard = new Map();
    n.nodeType = 1;
    n.ownerDocument = dom.doc;
    n.heard = heard;
    Object.defineProperties(n, {
      parentElement: { get: () => n.parent ?? null },
      parentNode: { get: () => n.parent ?? null },
      firstChild: { get: () => n.children[0] ?? null },
      isConnected: { get: () => { let a = n; while (a.parent) a = a.parent; return a === dom.body; } },
      scrollTop: { get: () => n._st ?? 0, set: (v) => { n._st = v; if (isList(n)) clamp(n); } },
    });
    n.addEventListener = (type, f) => heard.set(type, [...(heard.get(type) ?? []), f]);
    n.removeEventListener = (type, f) => heard.set(type, (heard.get(type) ?? []).filter((x) => x !== f));
    n.insertBefore = (c, ref) => { c.remove(); c.parent = n; const i = ref ? n.children.indexOf(ref) : -1; if (i < 0) n.children.push(c); else n.children.splice(i, 0, c); return c; };
    n.contains = (x) => { for (let a = x; a; a = a.parent) if (a === n) return true; return false; };
    n.hasAttribute = (k) => k in n.attrs;
    n.focus = () => { dom.doc.activeElement = n; };
    const rect = n.getBoundingClientRect;
    n.getBoundingClientRect = () => {
      if (isList(n)) return { top, bottom: top + view, height: view, left: 0, right: 400, width: 400 };
      const l = n.parent && isList(n.parent) ? n.parent : null;
      if (!l) return rect();
      clamp(l);
      const y = top + content(l).at.get(n) - l.scrollTop, h = n.className === 'vrows-gap' ? parseFloat(n.style.height) : rowH;
      return { top: y, bottom: y + h, height: h, left: 0, right: 400, width: 400 };
    };
    return n;
  };
  const host = dom.doc.createElement('div');
  host.className = 'virt-host';
  dom.body.append(host);
  const frames = [];
  const saved = { cs: globalThis.getComputedStyle, raf: globalThis.requestAnimationFrame, win: globalThis.window, had: 'window' in globalThis };
  globalThis.window = globalThis;   // the card's placing reads the window's box
  globalThis.getComputedStyle = (n) => (isList(n) ? { overflowY: 'auto', position: 'static' } : n === host ? { overflowY: 'clip', position: 'fixed' } : { overflowY: 'visible', position: 'static' });
  globalThis.requestAnimationFrame = (f) => { frames.push(f); return frames.length; };
  const list = () => host.querySelector('.remotelist');
  return {
    host, list,
    flush: () => { const fs = frames.splice(0); for (const f of fs) f(); return fs.length; },
    /** The list scrolled, as the browser tells it: its listeners hear it. */
    scroll: (y) => { const l = list(); l.scrollTop = y; for (const f of l.heard.get('scroll') ?? []) f(); },
    /** The drawn rows' pieces, in order. */
    pieces: () => list().children.filter((c) => c.classList.contains('itemrow')).map((r) => r._padItem),
    /** The rows whose box meets the list's. */
    inView: () => list().children.filter((c) => c.classList.contains('itemrow') && c.getBoundingClientRect().bottom > top && c.getBoundingClientRect().top < top + view),
    restore: () => { globalThis.getComputedStyle = saved.cs; globalThis.requestAnimationFrame = saved.raf; if (saved.had) globalThis.window = saved.win; else delete globalThis.window; },
  };
}
const longPile = (n) => Array.from({ length: n }, (_, i) => createWeapon(113 + (i % 19), i % 10));
const packHero = () => ({ isPlayer: true, name: 'Aelwyn', career: { name: 'Spellsword' }, level: 5, stats: { strength: 90, endurance: 90 }, activeEffects: [], spells: [], items: [], goldPieces: 0 });

test('VIRT pack: a long loot pile in the mounted pack is drawn as a window over its scroll - and a press that takes a piece keeps the scroll, the window measured before the scroll is given back; a hover card whose row a scroll takes away goes with it; the repaint lets go of the list it replaced (mutants: the window aimed before the scroll is given back; the card left beside nothing; the old lists kept)', () => {
  _resetForTests();
  globalThis.location = { search: '?skin=enhanced' };
  withDom((dom) => {
    const lay = layLoot(dom);
    try {
      const e = packHero();
      const pile = longPile(300);
      const view = mountEnhancedInventory(lay.host, { entity: e, items: () => e.items, loot: { items: () => pile }, onExit: () => {} });
      lay.flush();
      assert.ok(lay.pieces().length < 100, `${lay.pieces().length} of 300 drawn`);
      lay.scroll(5000);
      lay.flush();
      const at = () => lay.inView().map((r) => pile.indexOf(r._padItem));
      const first = Math.floor(5000 / 52);
      assert.deepEqual(at().slice(0, 3), [first, first + 1, first + 2], 'the rows at the scroll are the pile\'s');
      // a hover card - the pad's: an enter, and no leave until its cursor moves - and the list scrolled far under it
      const hovered = lay.inView()[1];
      hovered.onmouseenter();
      assert.equal(dom.body.querySelectorAll('.inv-tip').length, 1, 'the card is up');
      lay.scroll(12000);
      lay.flush();
      assert.equal(hovered.isConnected, false, 'its row went with the window');
      assert.equal(dom.body.querySelectorAll('.inv-tip').length, 0, 'and the card with it');
      // a take, deep in the pile: the pack repaints, and the new list stands at the same scroll on the same pieces
      lay.scroll(5000);
      lay.flush();
      const listeners = () => (lay.host.heard.get('scroll') ?? []).length;
      const before = listeners();
      const row = lay.inView()[2];
      const taken = row._padItem;
      row.onclick({});
      lay.flush();
      assert.ok(!pile.includes(taken) && e.items.includes(taken), 'the press took the piece');
      assert.equal(lay.list().scrollTop, 5000, 'the scroll kept through the repaint');
      assert.deepEqual(at().slice(0, 2), [first, first + 1], 'on the same pieces');
      assert.equal(listeners(), before, 'the host hears one list, not one a repaint');
      view.unmount();
      assert.equal(listeners(), 0, 'and none once the pack is gone');
    } finally { lay.restore(); }
  });
});

test('VIRT pack: the store\'s search typed deep in a long store keeps the list\'s scroll as the whole list kept it - the window measured and its spacers stood before the scroll is given back - lets go of the list it refilled, and reads no piece\'s line a second time (mutants: the refill aimed at once; the scroll not kept; the old window kept; the line read on every key)', () => {
  _resetForTests();
  globalThis.location = { search: '?skin=enhanced' };
  withDom((dom) => {
    const lay = layLoot(dom);
    try {
      let reads = 0;
      const e = packHero();
      Object.defineProperty(e, 'lightSource', { get: () => { reads++; return null; }, configurable: true });   // itemLine reads it once a line
      const store = longPile(300);
      const view = mountEnhancedInventory(lay.host, { entity: e, items: () => e.items, loot: { items: () => store, storage: true }, onExit: () => {} });
      lay.flush();
      lay.scroll(6000);
      lay.flush();
      const search = lay.host.querySelector('.storesearch');
      const type = (q) => { search.value = q; search.oninput(); lay.flush(); };
      type('a');
      const l = lay.list();
      const shown = store.filter((it) => /a/i.test(itemLine(it, e).name));
      assert.ok(shown.length * 52 > 6300, 'the filtered list is still deeper than the scroll');
      assert.equal(l.scrollTop, 6000, 'the scroll kept');
      assert.equal(lay.inView()[0]?._padItem, shown[Math.floor(6000 / 52)], 'on the filtered list\'s own pieces');
      assert.equal((l.heard.get('scroll') ?? []).length, 1, 'one window listens to the list');
      reads = 0;
      type('a ');   // a key that leaves the search as it was (the search is trimmed): the list refilled, every line known
      assert.equal(reads, 0, 'a second key read no line again');
      assert.equal((l.heard.get('scroll') ?? []).length, 1, 'still one');
      view.unmount();
    } finally { lay.restore(); }
  });
});

test('VIRT sheet: the loot window\'s rows are one height and its two tracks one width - the last row\'s border unseen, not gone; each track minmax(0, 1fr), never its widest drawn name (the browser half, driven: tools/packVirtProbe.mjs "the list is one height at every scroll", "its columns stand still as it scrolls")', () => {
  const css = readFileSync(new URL('../../src/ui/enhanced/enhancedStyle.js', import.meta.url), 'utf8');
  assert.match(css, /\.loot-win \.itemrow:last-child \{ border-bottom-color: transparent; \}/);
  assert.doesNotMatch(css, /\.loot-win \.itemrow:last-child \{ border-bottom: 0; \}/, 'a last row 2 px short of the rest');
  assert.match(css, /\.loot-win\.wide \.remotelist \{ display: grid; grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/);
});
