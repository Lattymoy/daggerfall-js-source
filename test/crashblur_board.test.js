// CRASH-BLUR (from play, 2026-10-07): "NotFoundError: Failed to execute 'replaceChildren' on 'Element': The node to be
// removed is no longer a child of this node. Perhaps it was moved in a 'blur' event handler?" - at the Notice Board's
// Market, a list's change repainted the window, the repaint took the focused list out, the browser blurred it, and the
// Market's answer held for that list (marketTab.js's redraw) repainted INSIDE the first repaint. The fake DOM blurs a
// node taken out and throws on a child already moved, as a browser does (chargenDom.mjs's replaceChildren).
import './chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { byClass } from './chargenDom.mjs';
import { mountNoticeBoard } from '../src/ui/noticeWindow.js';
import { createMarketBook } from '../src/net/marketBook.js';

const T = 1_800_000_000;
const tick = (n = 4) => new Promise((r) => { let i = 0; const go = () => (++i >= n ? r() : setTimeout(go, 0)); setTimeout(go, 0); });
const EMPTY = { notes: [], notices: [], me: {} };
const bookOf = (board) => ({
  seenAt: () => T - 1000, read: async () => ({ board }), markSeen: () => {}, cached: () => board,
  draft: () => ({ subject: '', body: '', days: 7, button: '' }), noticeDraft: () => ({ subject: '', body: '', days: 3 }),
  readGuild: async () => ({ data: null, error: 'no-guild' }),
});
function marketOver() {
  let reads = 0;
  const door = { account: () => 'acct-1', read: async (b) => { reads++; return { ok: true, data: { view: b.view, rows: [], balance: 10 } }; } };
  const book = createMarketBook({ door, character: () => 'c', now: () => 1_000_000, sleep: async () => {} });
  const market = { book, stores: () => new Map(), region: 17, regionName: 'Daggerfall', regionNameOf: () => 'Wayrest', hubs: {},
    name: (k) => k, countName: (k) => k, pieces: () => [], take: () => true, putBack: () => {}, mint: () => {}, pieceName: () => 'a piece',
    weavers: [], stock: async () => ({ ok: true }) };
  return { market, reads: () => reads };
}
const family = (host) => byClass(host, 'market-select').find((s) => s.getAttribute('aria-label') === 'Family');

test('CRASH-BLUR a Market list changed while the answer before it waited on that list\'s blur repaints once, after - never a repaint inside a repaint, which threw NotFoundError and crashed the game (mutant: noticeWindow.js\'s render without its painting guard)', async () => {
  const thrown = [];
  const heard = (e) => thrown.push(e);
  process.on('unhandledRejection', heard);   // the change's read is an async load: the throw left it as a rejection, the game's crash screen
  const m = marketOver();
  const host = document.createElement('div');
  mountNoticeBoard(host, { town: { name: 'Anticlere', mapId: 1 }, book: bookOf(EMPTY), nowS: () => T, market: m.market });
  await tick();
  byClass(byClass(host, 'notice-tabs')[0], 'notice-tab').find((t) => t.textContent === 'Market').onclick();
  await tick();
  // the list pressed open: a read under way answers while it is held, and its redraw waits on the list's blur
  const held = family(host);
  assert.ok(held, 'the Family list');
  held.value = held.children[1].value;
  held.onchange();
  const open = family(host);
  open.focus();   // pressed open again before the read it asked answers
  await tick();
  const before = m.reads();
  open.value = open.children[2].value;
  open.onchange();   // the read the change asks repaints while the window still holds this list
  await tick();
  process.off('unhandledRejection', heard);
  assert.deepEqual(thrown.map((e) => e?.name), [], 'nothing thrown');
  assert.ok(m.reads() > before, 'the change still read');
  assert.ok(family(host), 'the window drawn whole after');
  assert.equal(byClass(host, 'notice-tabs').length, 1, 'one strip of tabs - drawn once, never twice into one window');
});
