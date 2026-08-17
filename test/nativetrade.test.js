// U8c: the native trade window - the composed geometry + the click
// trade machine over fake hooks (the transaction core is the host's).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NativeTradeWindow, TRADE_RECTS, LIST_SLOTS, SLOT_H, CELL_W } from '../src/ui/nativeTrade.js';

const hooks = () => {
  const shelf = [{ templateIndex: 277, name: 'Book A' }, { templateIndex: 277, name: 'Book B' }];
  const bag = [{ templateIndex: 277, name: 'Mine' }];
  let gold = 100;
  return {
    shelf, bag,
    shelfItems: () => shelf,
    sellables: () => bag,
    buy: (it) => { if (gold < 10) return null; gold -= 10; shelf.splice(shelf.indexOf(it), 1); bag.push(it); return 10; },
    sell: (it) => { gold += 8; bag.splice(bag.indexOf(it), 1); shelf.push(it); return 8; },
    gold: () => gold,
    icons: { getTexture: async () => ({ recordCount: 0 }), uploadRecord: () => {}, textures: new Map() },
  };
};

test('nativeTrade: the composed rects + the click trade machine', () => {
  // DFU geometry: inventory lists + the trade panels
  assert.deepEqual([...TRADE_RECTS.localList], [163, 48, 59, 152]);
  assert.deepEqual([...TRADE_RECTS.remoteList], [261, 48, 59, 152]);
  assert.deepEqual([...TRADE_RECTS.costPanel], [49, 13, 111, 9]);
  assert.deepEqual([...TRADE_RECTS.actionPanel], [222, 10, 39, 190]);
  assert.equal(SLOT_H, 38);
  assert.equal(LIST_SLOTS, 4);
  assert.equal(CELL_W, 50, 'ItemListScroller itemButtonRects4');
  const h = hooks();
  const w = new NativeTradeWindow(h);
  // click remote slot 0 (below the 12px scroll band) -> buys
  assert.ok(w.click(290, 48 + 20));
  assert.equal(w.lastPrice, 10);
  assert.equal(h.gold(), 90);
  assert.equal(h.shelf.length, 1);
  assert.equal(h.bag.length, 2);
  // click local slot 0 -> sells (back onto the shelf)
  assert.ok(w.click(192, 48 + 20));
  assert.equal(w.lastPrice, 8);
  assert.equal(h.gold(), 98);
  assert.equal(h.shelf.length, 2);
  // the right 9px scroll strip never picks items (ItemListScroller's
  // arrow strip beside the 50-wide buttons)
  const before = h.shelf.length;
  assert.ok(w.click(261 + 52, 48 + 20));    // strip, top half -> up
  assert.ok(w.click(261 + 52, 48 + 130));   // strip, bottom half -> down
  assert.equal(h.shelf.length, before, 'the strip scrolls, never trades');
  // outside every rect: not consumed; exit closes
  assert.equal(w.click(10, 100), false);
  assert.ok(w.click(241, 188));
  assert.ok(w.done);
  // keyboard: digits buy visible remote slots
  const h2 = hooks();
  const w2 = new NativeTradeWindow(h2);
  w2.input('Digit1');
  assert.equal(h2.gold(), 90);
  w2.input('Escape');
  assert.ok(w2.done);
});

test('nativeTrade: icon draws V-FLIP the record texture (the bottom-up GL rows)', () => {
  // getColor32 stores records bottom-up (DFU's verbatim mesh flip);
  // drawScreenQuad samples v0 at the TOP - the icon draw must flip
  // (Mac's catch: the shelf books rendered upside down).
  const h = hooks();
  const w = new NativeTradeWindow(h);
  const key = '209_2';   // the Book template's world texture
  w._iconWarm.add(key);
  w._iconSizes = new Map([[key, { width: 32, height: 16 }]]);
  h.icons.textures.set(key, 'gl-tex');
  let captured = null;
  const fakeRenderer = { drawScreenQuad: (tex, dst, src) => { captured = { tex, src }; } };
  const m = { s: 1, ox: 0, oy: 0 };
  assert.ok(w._drawIcon(fakeRenderer, m, { templateIndex: 277 }, [261, 48, 59, 152], 0));
  assert.equal(captured.tex, 'gl-tex');
  assert.deepEqual(captured.src, { u0: 0, v0: 1, u1: 1, v1: 0 }, 'the V-flipped source rect');
});

test('nativeTrade: icons NEVER upscale and centre in the 50x38 cell (ItemListScroller MaxAutoScale 1)', () => {
  const h = hooks();
  const w = new NativeTradeWindow(h);
  const key = '209_2';
  w._iconWarm.add(key);
  w._iconSizes = new Map([[key, { width: 8, height: 8 }]]);   // tiny icon
  h.icons.textures.set(key, 'gl-tex');
  let captured = null;
  const fakeRenderer = { drawScreenQuad: (tex, dst, src) => { captured = { dst, src }; } };
  const m = { s: 1, ox: 0, oy: 0 };
  assert.ok(w._drawIcon(fakeRenderer, m, { templateIndex: 277 }, [261, 48, 59, 152], 0));
  assert.equal(captured.dst.w, 8, 'no upscale');
  assert.equal(captured.dst.h, 8);
  assert.equal(captured.dst.x, 261 + (50 - 8) / 2, 'centred in the 50-wide BUTTON, not the 59 scroller');
  assert.equal(captured.dst.y, 48 + (38 - 8) / 2);
  // an oversized icon scales DOWN to fit
  w._iconSizes.set(key, { width: 100, height: 38 });
  w._drawIcon(fakeRenderer, m, { templateIndex: 277 }, [261, 48, 59, 152], 0);
  assert.equal(captured.dst.w, 50, 'downscaled to the cell');
});
