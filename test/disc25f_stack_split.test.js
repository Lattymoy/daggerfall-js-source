// DISC25-F (2026-09-25, Satranath on Discord, crediting Starempire42: "It doesn't appear possible to split stacks
// currently, either in inventory or in shops when making a purchase").
//
// DFU splits in TransferItem (DaggerfallInventoryWindow.cs:1515-1539): a stack whose planned amount is short of it,
// or any stack under Control, pushes "Pick how many items (max N)?" and only its answer moves (:1546-1559). The trade
// window INHERITS the member (DaggerfallTradeWindow.cs:31) - buying (:842), selling (:795) and taking back (:803) all
// run it. The port had it on the classic pack alone (CM5): the classic counter took what fit unasked and moved stacks
// whole, and neither enhanced window ever asked. Now:
//   F1 the law has one home (systems/itemTransfer.js) and reads as int.TryParse does;
//   F2 the classic counter pushes CM5's box - under Control, and when a partial fit forces it;
//   F3 the enhanced pack's card and the enhanced counter's strip carry the question as a field beside the button that
//      moves the stack, seeded with the most that would move, so pressing unread is the popup's Return.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import {
  HOW_MANY_ITEMS, SPLIT_INPUT_MAX, parseSplitAmount, splitRequired,
} from '../src/systems/itemTransfer.js';
import * as nativeInventory from '../src/ui/nativeInventory.js';
import { NativeTradeWindow } from '../src/ui/nativeTrade.js';
import { InputMessageBoxWindow } from '../src/ui/inputMessageBox.js';
import { mountEnhancedInventory } from '../src/ui/enhancedInventory.js';
import { mountEnhancedTrade } from '../src/ui/enhancedTrade.js';
import { howManyField } from '../src/ui/howManyField.js';
import { withDom } from './invdrag.mjs';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const ARROWS = (n) => ({ group: 'Weapons', templateIndex: 131, name: 'Arrow', value: 1, stackCount: n });

test('DISC25-F F1: the split popup\'s law has ONE home, and its parse is int.TryParse\'s', () => {
  assert.equal(HOW_MANY_ITEMS(12), 'Pick how many items (max 12)?', 'howManyItems, formatted (:1529)');
  assert.equal(SPLIT_INPUT_MAX, 8, 'MaxCharacters 8 (:1533)');
  assert.equal(nativeInventory.HOW_MANY_ITEMS, HOW_MANY_ITEMS, 'the classic pack re-exports the one law, it keeps no copy');
  assert.equal(nativeInventory.SPLIT_INPUT_MAX, SPLIT_INPUT_MAX);
  const code = (f) => rd(`src/ui/${f}`).replace(/\/\*[^]*?\*\//g, '').split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
  const typed = readdirSync(new URL('../src/ui/', import.meta.url)).filter((f) => f.endsWith('.js'))
    .filter((f) => /Pick how many items/.test(code(f)));
  assert.deepEqual(typed, [], 'no window types the words itself');
  // TryParse: digits, a sign, white space round them - and 1..max (:1551)
  assert.deepEqual(['3', ' 7 ', '+2', '8'].map((t) => parseSplitAmount(t, 8)), [3, 7, 2, 8]);
  assert.deepEqual(['3x', '0', '-1', '', '9', '1.5', 'abc', null, '1e1', '0x5'].map((t) => parseSplitAmount(t, 20)).slice(-2), [null, null],
    'no exponent, no hex - what Number() would take and TryParse will not');
  assert.deepEqual(['3x', '0', '-1', '', '9', '1.5', 'abc', null].map((t) => parseSplitAmount(t, 8)), Array(8).fill(null));
  // the gate (:1515-1519): a stack short of its plan, or any stack under Control; never a single thing
  assert.equal(splitRequired(ARROWS(10), 10, false), false);
  assert.equal(splitRequired(ARROWS(10), 4, false), true);
  assert.equal(splitRequired(ARROWS(10), 10, true), true);
  assert.equal(splitRequired(ARROWS(1), 1, true), false, 'IsAStack (:1519)');
});

/** nativetrade.test.js's own hooks, with the shelf and the pack the case needs. */
function counter(mode, { shelf = [], bag = [], entity } = {}) {
  let gold = 100000;
  return {
    shelf, bag, mode, entity,
    shelfItems: () => shelf, packItems: () => bag,
    accepts: () => true, enchanted: () => true,
    priceCtx: () => ({ quality: 10, skills: { mercantile: 50, personality: 50 } }),
    gold: () => gold, rows: (id) => [{ text: `#${id}`, center: true }],
    weight: () => ({ carriedWeightKg: 0, maxEncumbranceKg: 1e9 }),
    commit: () => {},
    icons: { getTexture: async () => ({ recordCount: 0 }), uploadRecord: () => {}, textures: new Map() },
  };
}
const REMOTE_SLOT0 = [290, 48 + 20];
const LOCAL_SLOT0 = [192, 48 + 20];

test('DISC25-F F2: the classic counter pushes the how-many box - under Control on any stack, and when a partial fit forces it', () => {
  // a stack that all fits and no Control: taken whole, unasked, as before
  const plain = counter('Buy', { shelf: [ARROWS(30)] });
  const w0 = new NativeTradeWindow(plain);
  w0.click(...REMOTE_SLOT0);
  assert.equal(w0.inputBox, null);
  assert.equal(w0.basket[0].stackCount, 30);
  // CONTROL: the box, seeded "0" (:1525), and only its answer moves
  const h = counter('Buy', { shelf: [ARROWS(30)] });
  const w = new NativeTradeWindow(h);
  w.input('ControlLeft');
  w.click(...REMOTE_SLOT0);
  assert.ok(w.inputBox instanceof InputMessageBoxWindow);
  assert.equal(w.inputBox.label, HOW_MANY_ITEMS(30));
  assert.equal(w.inputBox.value, '0');
  assert.equal(w.inputBox.numeric, true);
  assert.equal(w.inputBox.maxCharacters, SPLIT_INPUT_MAX);
  assert.equal(w.basket.length, 0, 'nothing moves before the answer');
  w.inputBox.value = '12';
  w.input('Enter');
  assert.equal(w.inputBox, null, 'the box goes with its answer');
  assert.equal(w.basket[0].stackCount, 12, 'twelve into the basket');
  assert.equal(h.shelf[0].stackCount, 18, 'eighteen stay on the shelf');
  w.keyup('ControlLeft');
  // Control is a HELD state: let go, and a click on the rest takes it whole
  w.click(...REMOTE_SLOT0);
  assert.equal(w.inputBox, null);
  assert.equal(h.shelf.length, 0);
  // A PARTIAL FIT FORCES IT, seeded with what fits (:1515, :1532): 75 kg of carry, 62.5 kg of cuirasses in the pack,
  // a 7.5 kg war axe - one of five fits
  const tight = counter('Buy', {
    shelf: [{ group: 'Weapons', templateIndex: 128, stackCount: 5 }],
    bag: [{ group: 'Armor', templateIndex: 102, stackCount: 5 }],
    entity: { stats: { strength: 50 }, items: [] },
  });
  const wt = new NativeTradeWindow(tight);
  wt.click(...REMOTE_SLOT0);
  assert.ok(wt.inputBox, 'asked, not silently trimmed');
  assert.equal(wt.inputBox.value, '1');
  wt.inputBox.value = '3';
  wt.input('Enter');
  assert.equal(wt.basket.length, 0, 'more than fits moves nothing (:1551)');
  assert.equal(tight.shelf[0].stackCount, 5);
  // SELLING: part of the pack's stack onto the counter (:795), and the modal box holds the window's clicks
  const s = counter('Sell', { bag: [ARROWS(10)] });
  const ws = new NativeTradeWindow(s);
  ws.input('ControlRight');
  ws.click(...LOCAL_SLOT0);
  assert.ok(ws.inputBox);
  const box = ws.inputBox;
  assert.equal(ws.click(...LOCAL_SLOT0), true, 'a click elsewhere is the box\'s');
  assert.equal(ws.inputBox, box, 'and starts nothing under it');
  ws.inputBox.value = '4';
  ws.input('Enter');
  assert.equal(ws.remoteItems[0].stackCount, 4);
  assert.equal(s.bag[0].stackCount, 6);
});

/** The first node under `root` matching `sel` (invdrag's selectors: `.a`, `.a.b`, `tag`) and, if given, reading `text`. */
const find = (root, sel, text = null) => root.querySelectorAll(sel).find((n) => text == null || n.textContent === text) ?? null;
/** The how-many field's own input, or null. */
const qtyInput = (root) => find(root, '.qtyfield')?.children.find((c) => c.tagName === 'INPUT') ?? null;

test('DISC25-F F3: the enhanced pack\'s card asks how many beside the button that moves the stack', () => {
  const had = Object.hasOwn(globalThis, 'location') ? globalThis.location : undefined;
  globalThis.location = { search: '?skin=enhanced' };
  try {
    withDom((dom) => {
      const host = dom.mk('div');
      dom.body.append(host);
      const e = { name: 'Hero', stats: { strength: 50 }, items: [ARROWS(20)], equipped: {} };
      const view = mountEnhancedInventory(host, { entity: e, items: () => e.items, onExit: () => {}, dropItem: () => {} });
      const row = find(host, '.itemrow');
      row.onclick({ timeStamp: 1 });   // a pack row picks: the card
      const field = qtyInput(host);
      assert.ok(field, 'a stack\'s card carries the field');
      assert.equal(field.value, '20', 'seeded with the most that would move');
      assert.equal(field.attrs['aria-label'], HOW_MANY_ITEMS(20));
      field.value = '5';
      field.oninput();
      find(host, 'button', 'Drop').onclick();
      assert.equal(e.items[0].stackCount, 15, 'five went, fifteen stayed');
      // a count the parse refuses moves nothing and asks again
      find(host, '.itemrow').onclick({ timeStamp: 2 });
      const again = qtyInput(host);
      again.value = '99';
      again.oninput();
      find(host, 'button', 'Drop').onclick();
      assert.equal(e.items[0].stackCount, 15);
      const said = [];
      const walk = (n) => { for (const c of n.children ?? []) { if (typeof c.textContent === 'string') said.push(c.textContent); walk(c); } };
      walk(dom.body);
      assert.ok(said.includes(HOW_MANY_ITEMS(15)), 'the popup\'s own question, on the notice');
      view.unmount?.();
    });
    // a single thing has no field
    withDom((dom) => {
      const host = dom.mk('div');
      dom.body.append(host);
      const e = { name: 'Hero', stats: { strength: 50 }, items: [ARROWS(1)], equipped: {} };
      mountEnhancedInventory(host, { entity: e, items: () => e.items, onExit: () => {}, dropItem: () => {} });
      find(host, '.itemrow').onclick({ timeStamp: 1 });
      assert.equal(qtyInput(host), null);
    });
  } finally {
    if (had === undefined) delete globalThis.location; else globalThis.location = had;
  }
});

test('DISC25-F F3: the enhanced counter asks how many - buying part of a shelf\'s stack, selling part of the pack\'s', () => {
  withDom((dom) => {
    const host = dom.mk('div');
    dom.body.append(host);
    const h = counter('Buy', { shelf: [ARROWS(30)] });
    const view = mountEnhancedTrade(host, h);
    const shelfRow = () => host.querySelectorAll('.itemrow').find((r) => /Arrow/.test(r.querySelector('.itemname')?.children?.[0]?.textContent ?? ''));
    shelfRow().onclick({ timeStamp: 1000 });   // one click: the strip, not a move
    const field = qtyInput(host);
    assert.ok(field, 'the strip asks how many');
    assert.equal(field.value, '30');
    field.value = '7';
    field.oninput();
    (find(host, '.act.primary', 'Buy') ?? find(host, '.act.primary', 'Sell')).onclick();
    assert.equal(h.shelf[0].stackCount, 23, 'seven off the shelf');
    view.unmount();
  });
  // ENTER IN THE FIELD is the popup's Return - that item, that count - and Enter in any OTHER field is not
  withDom((dom) => {
    const host = dom.mk('div');
    dom.body.append(host);
    const h = counter('Buy', { shelf: [ARROWS(30)] });
    const view = mountEnhancedTrade(host, h);
    host.querySelectorAll('.itemrow')[0].onclick({ timeStamp: 1000 });
    const enter = (target) => dom.win.fire('keydown', { key: 'Enter', code: 'Enter', target, preventDefault() {} });
    enter({ tagName: 'INPUT', closest: () => null });   // the chat's input, say
    assert.equal(h.shelf[0].stackCount, 30, 'another field\'s Enter moves nothing off the shelf');
    const field = qtyInput(host);
    field.value = '9';
    field.oninput();
    enter(field);
    assert.equal(h.shelf[0].stackCount, 21, 'nine, on the field\'s own Return');
    view.unmount();
  });
  withDom((dom) => {
    const host = dom.mk('div');
    dom.body.append(host);
    const h = counter('Sell', { bag: [ARROWS(10)] });
    const view = mountEnhancedTrade(host, h);
    host.querySelectorAll('.itemrow')[0].onclick({ timeStamp: 1000 });
    const field = qtyInput(host);
    assert.ok(field);
    field.value = '4';
    field.oninput();
    (find(host, '.act.primary', 'Buy') ?? find(host, '.act.primary', 'Sell')).onclick();
    assert.equal(h.bag[0].stackCount, 6, 'four onto the counter, six kept');
    view.unmount();
  });
  // ONE constructor for both windows (AUDIT 17i)
  assert.match(rd('src/ui/enhancedInventory.js'), /howManyField\(\{ max, text: qty\.text,/);
  assert.match(rd('src/ui/enhancedTrade.js'), /howManyField\(\{ max, text: qty\.text,/);
  assert.equal(typeof howManyField, 'function');
});
