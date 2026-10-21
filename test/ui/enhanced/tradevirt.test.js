// TRADE-VIRT (2026-10-20, a player's audit of the trading windows, handed on by the owner; bible/07-Rendering/
// Performance-Priority.md TRADE-VIRT) - THE TRADE COUNTERS TAKE VIRT'S LAW: a landed picture goes into its own tile
// (ui/enhanced/landingTiles.js, the law's one home - the pack's too), and a long list draws the rows on screen
// (ui/virtualRows.js). Measured in the browser over the freeware ARENA2's pictures (tools/tradePerfProbe.mjs): a cold
// counter of 1,000 pieces repainted itself 292 times while its pictures came in (106 s), and the trade between players,
// whose `onReady` was a fresh function a row, 2,160 times for 300 (200 s).
//
// Held here, in both windows: a cold picture landing goes into the tile that waited on it - the same window, the same
// rows, the wear bar carried - and nothing is repainted; a long pack (past VIRTUAL_MIN) is a window over its column's
// scroll, every drawn row its piece's, and a press deep in it keeps the scroll and the pieces in view; a double press
// still moves the piece; a hover card whose row the window took away goes with it; a repaint lets go of the list it
// replaced, and the unmount of every one.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { mountEnhancedTrade } from '../../../src/ui/enhanced/enhancedTrade.js';
import { mountEnhancedPlayerTrade } from '../../../src/ui/enhanced/enhancedPlayerTrade.js';
import { VIRTUAL_MIN, VIRTUAL_FIRST } from '../../../src/ui/virtualRows.js';
import { TradeSession } from '../../../src/net/tradeSession.js';
import { createTradePack } from '../../../src/systems/tradePack.js';
import { fakeDom, withDom } from '../../invdrag.mjs';
import { canvases, settle } from '../../virtFakes.mjs';
import { createWeapon } from '../../../src/combat/enemyEquipment.js';
import { inventoryItemImage } from '../../../src/systems/item/itemTemplates.js';
import { textureKey, setTextureReplacements, clearTextureReplacements, preloadTextureRecord } from '../../../src/systems/textureReplacement.js';
import { setValue, _resetForTests as _resetSettings } from '../../../src/systems/settings/settings.js';
import { _resetForTests } from '../../../src/systems/uiPrefs.js';

const hero = () => ({ isPlayer: true, name: 'Aelwyn', career: { name: 'Spellsword' }, level: 5, stats: { strength: 90, endurance: 90 }, activeEffects: [], spells: [], items: [], goldPieces: 500 });
const counterHooks = (e, mode = 'Sell') => ({ mode, shopName: 'The Shop', entity: e, packItems: () => e.items, shelfItems: () => [], accepts: () => true, enchanted: () => false,
  isEquipped: () => false, gold: () => e.goldPieces, priceCtx: () => ({ quality: 10, priceAdjustment: 1000, skills: { mercantile: 50, personality: 50 } }), onExit: () => {} });
const sessionOf = (e) => new TradeSession({ sid: 'tradevirt1', me: 'peerAAAA', peer: 'peerBBBB', peerName: 'Brenna', pack: createTradePack(e), send: () => true, near: () => true });
const mountP2p = (host, e, session) => mountEnhancedPlayerTrade(host, { session, deps: { items: () => e.items, entity: e, gold: () => e.goldPieces, onExit: () => {} } });

// ── A COLD PICTURE INTO ITS TILE ─────────────────────────────────

/** Three worn blades whose pictures are held back behind their own gates: `land(i)` lets one in. `kinds` - each test's
 *  own blades ([template, metal]): the fitted pictures are kept for the process, so a picture another test landed is warm. */
async function coldPictures(kinds, fn) {
  _resetForTests();
  globalThis.location = { search: '?skin=enhanced' };
  setValue('Enhancements', 'AssetInjection', 'True');
  const dom = fakeDom();
  const Image = canvases(dom);
  const frames = [];
  const saved = { doc: globalThis.document, add: globalThis.addEventListener, rem: globalThis.removeEventListener, raf: globalThis.requestAnimationFrame, img: globalThis.Image };
  Object.assign(globalThis, { document: dom.doc, addEventListener: dom.win.addEventListener, removeEventListener: dom.win.removeEventListener, requestAnimationFrame: (f) => { frames.push(f); return frames.length; }, Image });
  const flush = () => { const fs = frames.splice(0); for (const f of fs) f(); return fs.length; };
  try {
    const e = hero();
    const blades = kinds.map(([t, m]) => createWeapon(t, m));
    for (const b of blades) b.currentCondition = Math.round(b.maxCondition / 2);   // worn: each tile carries a bar
    e.items = blades;
    const keyOf = (b) => { const img = inventoryItemImage(b, e); return [img, textureKey(img.archive, img.record, 0, 'Albedo', img.dye)]; };
    const gates = new Map(), opens = new Map();
    for (const b of blades) { const [, k] = keyOf(b); gates.set(k, new Promise((res) => opens.set(k, res))); }
    clearTextureReplacements();
    setTextureReplacements([...gates.keys()].map((k) => `${k}.png`), async (name) => { await gates.get(String(name).replace(/\.png$/, '')); return new Uint8Array([1]); });
    const reads = blades.map((b) => { const [img] = keyOf(b); return preloadTextureRecord(img.archive, img.record, 0, 'Albedo', img.dye, { decode: async () => ({ width: 2, height: 2, data: new Uint8Array(16).fill(255) }) }); });
    const host = dom.mk('div');
    dom.body.append(host);
    const land = async (i) => { opens.get(keyOf(blades[i])[1])(); await reads[i]; await settle(); };
    await fn({ dom, host, e, flush, land });
  } finally {
    clearTextureReplacements();
    Object.assign(globalThis, { document: saved.doc, addEventListener: saved.add, removeEventListener: saved.rem, requestAnimationFrame: saved.raf, Image: saved.img });
    if (saved.doc === undefined) delete globalThis.document;
    if (saved.img === undefined) delete globalThis.Image;
    _resetSettings();
  }
}

/** The pictures land one, then two together, into the window's own tiles - and it is never repainted. */
async function landsInPlace({ host, flush, land }) {
  await settle();
  flush();
  const shell = host.querySelector('.trade-shell');
  const rows = host.querySelector('.packcol').querySelectorAll('.itemrow');
  assert.equal(rows.length, 3);
  const tiles = rows.map((r) => r.querySelector('.tile'));
  assert.deepEqual(tiles.map((t) => t.classList.contains('has-icon')), [false, false, false], 'cold: the initials');
  assert.ok(tiles.every((t) => t.querySelector('.wear')), 'and their wear bars');
  await land(0);
  flush();
  assert.equal(host.querySelector('.trade-shell'), shell, 'the same window - nothing repainted it');
  assert.equal(host.querySelector('.packcol').querySelectorAll('.itemrow')[0], rows[0], 'the same row');
  const now = rows[0].querySelector('.tile');
  assert.notEqual(now, tiles[0], 'its tile swapped');
  assert.equal(now.querySelector('img')?.src, 'data:image/png;src-8x8', 'for the fitted door\'s own picture');
  assert.ok(now.querySelector('.wear'), 'the wear bar carried into it');
  assert.equal(rows[1].querySelector('.tile'), tiles[1], 'the second still waits, as it was');
  await land(1);
  await land(2);
  flush();
  assert.equal(host.querySelector('.trade-shell'), shell, 'still the same window');
  assert.deepEqual(rows.map((r) => r.querySelector('.tile').querySelector('img')?.src ?? null), Array(3).fill('data:image/png;src-8x8'), 'every tile its picture');
  await settle();
  assert.equal(flush(), 0, 'nothing more to do');
}

test('TRADE-VIRT the shop counter: a cold picture landing goes into the tile that waited on it - the same window, the same row, its wear bar carried - and the counter is not repainted; two landing together, one pass (mutants: a landing repaints the counter; the landing tiles unasked)', async () => {
  await coldPictures([[113, 3], [116, 3], [120, 3]], async (rig) => {
    const view = mountEnhancedTrade(rig.host, counterHooks(rig.e));
    try { await landsInPlace(rig); } finally { view.unmount(); }
  });
});

test('TRADE-VIRT the trade between players: a cold picture landing goes into its tile - its `onReady` was a fresh function a row, each a whole repaint, up to eight a picture - and the window is not repainted (mutant: a landing repaints the window)', async () => {
  await coldPictures([[114, 5], [117, 5], [121, 5]], async (rig) => {
    const view = mountP2p(rig.host, rig.e, sessionOf(rig.e));
    try { await landsInPlace(rig); } finally { view.unmount(); }
  });
});

// AUDIT TRADE-VIRT (2026-10-20, the owner: "ensure this is perfect and fidelity isnt lost"): before any long pack draws its pictures
test('AUDIT TRADE-VIRT a hover on a row whose picture has landed takes the title off the tile it shows NOW - the landing swapped the tile in place, and the row\'s hover held the initials tile it was built with, so the browser\'s own tooltip stood over the hover card (mutants: the tile the row was built with)', async () => {
  await coldPictures([[115, 6], [118, 6], [119, 6]], async (rig) => {   // pieces no test before this one has drawn: their pictures cold
    const view = mountEnhancedTrade(rig.host, counterHooks(rig.e));
    try {
      await settle(); rig.flush();
      const row = rig.host.querySelector('.packcol').querySelectorAll('.itemrow')[0];
      assert.ok(!row.querySelector('.tile').classList.contains('has-icon'), 'cold: the initials');
      await rig.land(0); rig.flush();
      for (let k = 0; k < 20 && !row.querySelector('.tile').classList.contains('has-icon'); k++) { await settle(); rig.flush(); }
      const landed = row.querySelector('.tile');
      assert.ok(landed.classList.contains('has-icon'), 'its picture landed - the tile swapped in place');
      const took = [];
      const rm = landed.removeAttribute;
      landed.removeAttribute = (k) => { took.push(k); return rm.call(landed, k); };
      const hadWindow = 'window' in globalThis;
      if (!hadWindow) globalThis.window = { innerWidth: 1280, innerHeight: 720, addEventListener() {}, removeEventListener() {} };   // the hover card's own placing
      try {
        row.onmouseenter();
        assert.deepEqual(took, ['title'], 'the landed tile\'s title taken off');
        row.onmouseleave();
      } finally { if (!hadWindow) delete globalThis.window; }
    } finally { view.unmount(); }
  });
});

// ── A LONG PACK, A WINDOW OVER ITS COLUMN'S SCROLL ───────────────

/** The trade sheet's layout: each `.packcol` scrolls (`overflow-y: auto`), its head and tabs `headH` tall above its list,
 *  the list's rows one column of `rowH` (a spacer its own height). Every rect is computed from the flow as it stands. */
function layTrade(dom, { rowH = 52, headH = 60, top = 100, view = 300 } = {}) {
  const isCol = (n) => !!n.classList?.contains('packcol');
  const listOf = (c) => c.children.find((x) => x.classList?.contains('remotelist')) ?? null;
  const colOf = (n) => { for (let a = n; a; a = a.parent) if (isCol(a)) return a; return null; };
  const content = (l) => { let y = 0; const at = new Map(); for (const c of l?.children ?? []) { at.set(c, y); y += c.className === 'vrows-gap' ? parseFloat(c.style.height) : rowH; } return { at, height: y }; };
  const clamp = (c) => { const max = Math.max(0, headH + content(listOf(c)).height - view); if ((c._st ?? 0) > max) c._st = max; };
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
      scrollTop: { get: () => n._st ?? 0, set: (v) => { n._st = v; if (isCol(n)) clamp(n); } },
      scrollHeight: { get: () => (isCol(n) ? headH + content(listOf(n)).height : 0) },
      clientHeight: { get: () => (isCol(n) ? view : 0) },
    });
    n.addEventListener = (type, f) => heard.set(type, [...(heard.get(type) ?? []), f]);
    n.removeEventListener = (type, f) => heard.set(type, (heard.get(type) ?? []).filter((x) => x !== f));
    n.insertBefore = (c, ref) => { c.remove(); c.parent = n; const i = ref ? n.children.indexOf(ref) : -1; if (i < 0) n.children.push(c); else n.children.splice(i, 0, c); return c; };
    n.contains = (x) => { for (let a = x; a; a = a.parent) if (a === n) return true; return false; };
    n.hasAttribute = (k) => k in n.attrs;
    n.focus = () => { dom.doc.activeElement = n; };
    const rect = n.getBoundingClientRect;
    n.getBoundingClientRect = () => {
      if (isCol(n)) return { top, bottom: top + view, height: view, left: 0, right: 400, width: 400 };
      const c = colOf(n), l = c && listOf(c);
      if (!c) return n === host ? { top: 0, bottom: top + view + 100, height: top + view + 100, left: 0, right: 400, width: 400 } : rect();   // the host the window's height
      clamp(c);
      if (n === l) { const y = top + headH - c.scrollTop; return { top: y, bottom: y + content(l).height, height: content(l).height, left: 0, right: 400, width: 400 }; }
      if (n.parent !== l) return rect();
      const y = top + headH + content(l).at.get(n) - c.scrollTop, h = n.className === 'vrows-gap' ? parseFloat(n.style.height) : rowH;
      return { top: y, bottom: y + h, height: h, left: 0, right: 400, width: 400 };
    };
    return n;
  };
  const host = dom.doc.createElement('div');
  dom.body.append(host);
  const frames = [];
  const saved = { cs: globalThis.getComputedStyle, raf: globalThis.requestAnimationFrame, win: globalThis.window, had: 'window' in globalThis, ih: globalThis.innerHeight };
  globalThis.window = globalThis;   // the hover card's placing reads the window's box
  globalThis.innerHeight = Math.max(900, top + view + 100);   // the window as tall as the column it shows
  globalThis.getComputedStyle = (n) => (isCol(n) ? { overflowY: 'auto', position: 'static' } : n === host ? { overflowY: 'clip', position: 'fixed' } : { overflowY: 'visible', position: 'static' });
  globalThis.requestAnimationFrame = (f) => { frames.push(f); return frames.length; };
  const col = (i = 0) => host.querySelectorAll('.packcol')[i];
  const rowsOf = (i = 0) => listOf(col(i)).children.filter((c) => c.classList.contains('itemrow'));
  return {
    host, col,
    flush: () => { const fs = frames.splice(0); for (const f of fs) f(); return fs.length; },
    /** The pack's column scrolled, as the browser tells it: its listeners hear it. */
    scroll: (y) => { const c = col(); c.scrollTop = y; for (const f of c.heard.get('scroll') ?? []) f(); },
    /** The pack's drawn rows' pieces, in order. */
    pieces: () => rowsOf().map((r) => r._tradeItem),
    /** The pack's rows whose box meets the column's. */
    inView: () => rowsOf().filter((r) => r.getBoundingClientRect().bottom > top && r.getBoundingClientRect().top < top + view),
    listeners: () => (col().heard.get('scroll') ?? []).length,
    /** The scroll listeners on the window's host - a box round every list that clips (virtualRows' band). */
    hostHeard: () => (host.heard.get('scroll') ?? []).length,
    first: (y) => Math.floor((y - headH) / rowH),
    restore: () => { globalThis.getComputedStyle = saved.cs; globalThis.requestAnimationFrame = saved.raf; globalThis.innerHeight = saved.ih; if (saved.had) globalThis.window = saved.win; else delete globalThis.window; },
  };
}
const longPack = (n) => Array.from({ length: n }, (_, i) => createWeapon(113 + (i % 19), i % 10));

/** A long pack in a mounted window: a window over its scroll, a press deep in it keeping the scroll and its pieces, a
 *  card whose row went put away (`hover`: the counter's rows carry the pack's hover card; a trade between players' its
 *  title), a double press moving the piece, the old list let go - `moved(piece)` says it moved. */
function longPackLaw(lay, e, moved, { hover = false } = {}) {
  lay.flush();
  assert.ok(e.items.length >= VIRTUAL_MIN);
  assert.ok(lay.pieces().length < 100, `${lay.pieces().length} of ${e.items.length} drawn`);
  assert.deepEqual(lay.pieces().slice(0, 3), e.items.slice(0, 3), 'the first drawn are the pack\'s first');
  lay.scroll(5000);
  lay.flush();
  const at = () => lay.inView().map((r) => e.items.indexOf(r._tradeItem));
  const first = lay.first(5000);
  assert.deepEqual(at().slice(0, 3), [first, first + 1, first + 2], 'the rows at the scroll are the pack\'s');
  // a hover card, and the column scrolled far under it
  if (hover) {
    const hovered = lay.inView()[1];
    hovered.onmouseenter();
    assert.equal(globalThis.document.body.querySelectorAll('.inv-tip').length, 1, 'the card is up');
    lay.scroll(12000);
    lay.flush();
    assert.equal(hovered.isConnected, false, 'its row went with the window');
    assert.equal(globalThis.document.body.querySelectorAll('.inv-tip').length, 0, 'and the card with it');
  }
  // a press deep in the pack (a preview): the window repaints, and the new list stands at the same scroll on the same pieces
  lay.scroll(5000);
  lay.flush();
  const before = lay.listeners(), hostBefore = lay.hostHeard();
  lay.inView()[2].onclick({ timeStamp: 1000 });
  lay.flush();
  assert.equal(lay.col().scrollTop, 5000, 'the scroll kept through the repaint');
  assert.deepEqual(at().slice(0, 2), [first, first + 1], 'on the same pieces');
  assert.equal(lay.listeners(), before, 'the column hears one list, not one a repaint');
  assert.ok(hostBefore > 0, 'the host clips the lists: each listens to it');
  assert.equal(lay.hostHeard(), hostBefore, 'and the host the live lists alone - the old ones let go of it');
  // a double press moves the piece
  const at3 = lay.inView()[3], piece = at3._tradeItem;
  at3.onclick({ timeStamp: 5000 });
  lay.flush();
  lay.inView().find((r) => r._tradeItem === piece).onclick({ timeStamp: 5100 });
  lay.flush();
  assert.ok(moved(piece), 'the double press moved it');
  assert.ok(!lay.pieces().includes(piece), 'and the pack\'s list has it no more');
}

test('TRADE-VIRT the shop counter: a long pack is a window over its column\'s scroll - every drawn row its piece\'s - a press deep in it keeps the scroll and the pieces in view, a card whose row the window took goes with it, a double press stages the piece, a repaint lets go of the list it replaced and the unmount of every one (mutants: the pack drawn whole; the window aimed before the scroll is given back; the card left beside nothing; the old lists kept; the lists kept past the unmount)', () => {
  _resetForTests();
  globalThis.location = { search: '?skin=enhanced' };
  withDom((dom) => {
    const lay = layTrade(dom);
    try {
      const e = hero();
      e.items = longPack(300);
      const view = mountEnhancedTrade(lay.host, counterHooks(e));
      longPackLaw(lay, e, (piece) => !lay.pieces().includes(piece) && lay.host.querySelector('.packremote').querySelectorAll('.itemrow').some((r) => r._tradeItem === piece), { hover: true });
      view.unmount();
      assert.equal(lay.listeners(), 0, 'none once the counter is gone');
      assert.equal(lay.hostHeard(), 0, 'nor on its host');
    } finally { lay.restore(); }
  });
});

test('TRADE-VIRT the trade between players: a long pack is a window over its column\'s scroll - a press deep in it keeps the scroll and the pieces in view, a card whose row went goes with it, a double press offers the piece, the lists let go (mutants: the pack drawn whole; the old lists kept; the lists kept past the unmount)', () => {
  _resetForTests();
  globalThis.location = { search: '?skin=enhanced' };
  withDom((dom) => {
    const lay = layTrade(dom);
    try {
      const e = hero();
      e.items = longPack(300);
      const session = sessionOf(e);
      const view = mountP2p(lay.host, e, session);
      longPackLaw(lay, e, (piece) => session.mine.entries.some((x) => x.item === piece));
      view.unmount();
      assert.equal(lay.listeners(), 0, 'none once the window is gone');
      assert.equal(lay.hostHeard(), 0, 'nor on its host');
    } finally { lay.restore(); }
  });
});

test('TRADE-VIRT a repaint measures its long lists before it gives their scroll back, and draws them only then: a press deep in a column taller than the measuring rows builds no row of the list\'s top past them, in both windows (mutants: the window aimed before the scroll is given back)', () => {
  for (const which of ['counter', 'trade']) {
    _resetForTests();
    globalThis.location = { search: '?skin=enhanced' };
    withDom((dom) => {
      const lay = layTrade(dom, { view: 3000 });
      try {
        const e = hero();
        e.items = longPack(300);
        const view = which === 'counter' ? mountEnhancedTrade(lay.host, counterHooks(e)) : mountP2p(lay.host, e, sessionOf(e));
        lay.flush();
        lay.scroll(9000);
        lay.flush();
        const made = [], mk = dom.doc.createElement;
        dom.doc.createElement = (t) => { const n = mk(t); made.push(n); return n; };
        try { lay.inView()[2].onclick({ timeStamp: 1000 }); lay.flush(); } finally { dom.doc.createElement = mk; }
        const built = made.map((n) => e.items.indexOf(n._tradeItem)).filter((i) => i >= 0);
        assert.ok(built.some((i) => i >= lay.first(9000)), `${which}: the rows at the scroll built`);
        assert.deepEqual(built.filter((i) => i >= VIRTUAL_FIRST && i < lay.first(9000) - 40), [], `${which}: and none of the top's past the measuring ones`);
        view.unmount();
      } finally { lay.restore(); }
    });
  }
});

test('TRADE-VIRT the pack\'s list leaves out what the counter holds - asked of one Set a paint now, a walk of the lot it was each piece (mutant: the held pieces left in the pack)', () => {
  _resetForTests();
  globalThis.location = { search: '?skin=enhanced' };
  withDom((dom) => {
    const host = dom.mk('div');
    dom.body.append(host);
    const e = hero();
    const held = createWeapon(113, 0), mine = createWeapon(114, 0);
    for (const x of [held, mine]) x.currentCondition = Math.round(x.maxCondition / 2);
    e.items = [held, mine];
    const view = mountEnhancedTrade(host, { ...counterHooks(e, 'Repair'), otherItems: () => [held] });
    try {
      assert.deepEqual(host.querySelector('.packcol').querySelectorAll('.itemrow').map((r) => r._tradeItem), [mine], 'the piece at the smith\'s is not drawn in the pack');
    } finally { view.unmount(); }
  });
});

test('TRADE-VIRT the trade between players: a verb of mine paints the window once - an offer, a lock, an unlock - though the session tells the host of its change inside it (the host\'s answer is this repaint); a repaint the host asks of its own (the peer\'s change) paints at once (mutant: the session\'s call painting inside the verb)', () => {
  _resetForTests();
  globalThis.location = { search: '?skin=enhanced' };
  withDom((dom) => {
    const host = dom.mk('div');
    dom.body.append(host);
    let paints = 0;
    const append = host.append.bind(host);
    host.append = (...cs) => { for (const c of cs) if (c?.classList?.contains('trade-shell')) paints++; return append(...cs); };
    const e = hero();
    e.items = [createWeapon(113, 3), createWeapon(116, 3)];
    let view = null;
    const session = new TradeSession({ sid: 'tradevirt2', me: 'peerAAAA', peer: 'peerBBBB', peerName: 'Brenna', pack: createTradePack(e), send: () => true, near: () => true, onChange: () => view?.repaint() });
    view = mountP2p(host, e, session);
    const packRows = () => host.querySelector('.packcol').querySelectorAll('.itemrow');
    const count = (f) => { const p0 = paints; f(); return paints - p0; };
    assert.equal(count(() => { packRows()[0].onclick({ timeStamp: 1000 }); }), 1, 'a press, one paint');
    assert.equal(count(() => { packRows()[0].onclick({ timeStamp: 1100 }); }), 1, 'the double press that offers it: one paint, not the session\'s and the window\'s');
    assert.equal(session.mine.entries.length, 1, 'offered');
    const lockBtn = () => host.querySelector('.trade-footer').querySelectorAll('button').find((b) => b.textContent === 'Lock' || b.textContent === 'Unlock');
    assert.equal(count(() => lockBtn().onclick()), 1, 'a lock, one paint');
    assert.equal(session.myLock, true);
    assert.equal(count(() => lockBtn().onclick()), 1, 'an unlock, one paint');
    assert.equal(count(() => view.repaint()), 1, 'the host\'s own repaint (a peer\'s change) paints at once');
    view.unmount();
  });
});

// ── AUDIT TRADE-VIRT (2026-10-20, the owner: "ensure this is perfect and fidelity isnt lost") ──────────────────────

test('AUDIT TRADE-VIRT a resize measures the long lists again and repaints nothing - in the shop counter (a repaint took the focus out of the How-many field and lost the next key) and between players (a repaint put a typed stack count back to the whole stack) (mutants: the resize repaints)', async () => {
  await coldPictures([[113, 3], [116, 3]], async (rig) => {
    for (const mount of [() => mountEnhancedTrade(rig.host, counterHooks(rig.e)), () => mountP2p(rig.host, rig.e, sessionOf(rig.e))]) {
      const view = mount();
      try {
        await settle(); rig.flush();
        const shell = rig.host.querySelector('.trade-shell'), row = rig.host.querySelector('.itemrow');
        assert.ok(shell && row);
        rig.dom.win.fire('resize', {});
        rig.flush();
        assert.equal(rig.host.querySelector('.trade-shell'), shell, 'the same window');
        assert.equal(rig.host.querySelector('.itemrow'), row, 'the same rows - nothing rebuilt under a field');
      } finally { view.unmount(); }
    }
  });
});
