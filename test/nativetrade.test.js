// U8c: the native trade window - the composed geometry + the click
// trade machine over fake hooks (the transaction core is the host's).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NativeTradeWindow, TRADE_RECTS, LIST_SLOTS, SLOT_H } from '../src/ui/nativeTrade.js';

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
  // the scroll bands never pick items
  const before = h.shelf.length;
  assert.ok(w.click(290, 48 + 5));         // top band
  assert.ok(w.click(290, 48 + 152 - 5));   // bottom band
  assert.equal(h.shelf.length, before, 'bands scroll, never trade');
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
