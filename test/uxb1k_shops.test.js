// UXB1-K / UXB1-L (2026-09-25, the UX backlog, Shops: "Countdown timer/estimate for repairs when not instant." and
// "Split stacks of items in shops (Shop sells 12 oil but you only want 2, for example)").
//
// K: the port had DFU's repair clock (systems/repairService.js - booked jobs, the scheduler, "DONE" / "%d days") and
// NO skin said it: the classic counter tinted a job and the enhanced one dimmed it, and neither told a player when to
// come back. The classic counter now draws DFU's own misc label (RepairItemLabelTextHandler, :282-288); the enhanced
// one counts it down on each row and names the hour and the day on the strip.
//
// L: DFU's trade window inherits TransferItem's split - "Pick how many items (max N)?" on a Control-click, or when
// only part of a stack fits (DaggerfallInventoryWindow.cs:1509-1558) - and neither shop skin had it: a stack moved
// whole or silently shrank. The classic counter asks DFU's question through the pack's own popup (one law, exported
// from nativeInventory.js); the enhanced counter carries a count on the selected stack, and goods put back rejoin
// their stack on the shelf.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { repairCountdown, repairCountdownText, repairStatusLabel } from '../src/systems/repairService.js';
import { OIL_TEMPLATE, GLASS_BOTTLE_TEMPLATE, splitsCleanly } from '../src/systems/inventory.js';
import { NativeTradeWindow } from '../src/ui/nativeTrade.js';
import { HOW_MANY_ITEMS, splitRequired } from '../src/ui/nativeInventory.js';
import { planTake } from '../src/systems/itemTransfer.js';
import { mountEnhancedTrade, repairReadyLine } from '../src/ui/enhancedTrade.js';
import { withDom } from './invdrag.mjs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const DAY = 1440;
const oil = (n) => ({ group: 'UselessItems2', templateIndex: OIL_TEMPLATE, name: 'Oil', value: 4, stackCount: n });
const REMOTE_SLOT0 = [290, 48 + 20];   // the middle of the classic shelf's first slot (test/nativetrade.test.js)

// ── K: THE CLOCK, AS LAW ─────────────────────────────────────────

test('UXB1-K: when a job is ready - a booked job\'s committed time, a staged one\'s estimate, nothing for an undamaged item', () => {
  const now = 523530 + 10 * DAY;
  const booked = { currentCondition: 10, maxCondition: 100, repairData: { buildingKey: 7, timeStarted: now - 100, repairTime: 2000 } };
  assert.deepEqual(repairCountdown(booked, now), { done: false, doneAt: now + 1900, minutesLeft: 1900, estimate: false });
  assert.equal(repairCountdownText(repairCountdown(booked, now)), 'Ready in 2 days', 'DFU\'s own unit and ceiling while a day or more is left');
  assert.equal(repairStatusLabel(booked, now), '2 days', '(the same count DFU\'s label says)');
  const soon = { ...booked, repairData: { ...booked.repairData, repairTime: 100 + 290 } };
  assert.equal(repairCountdownText(repairCountdown(soon, now)), 'Ready in 5 hours', 'under a day, hours - "1 days" said nothing about this evening');
  const lastHour = { ...booked, repairData: { ...booked.repairData, repairTime: 101 } };
  assert.equal(repairCountdownText(repairCountdown(lastHour, now)), 'Ready in 1 hour');
  const done = { ...booked, repairData: { ...booked.repairData, repairTime: 50 } };
  assert.equal(repairCountdownText(repairCountdown(done, now)), 'Ready');
  const staged = { currentCondition: 50, maxCondition: 100 };
  assert.deepEqual(repairCountdown(staged, now, 3 * DAY), { done: false, doneAt: now + 3 * DAY, minutesLeft: 3 * DAY, estimate: true });
  assert.equal(repairCountdownText(repairCountdown(staged, now, 3 * DAY)), 'About 3 days', 'a staged job\'s figure is an estimate and says so');
  assert.equal(repairCountdown({ currentCondition: 100, maxCondition: 100 }, now), null, 'nothing owed');
  assert.equal(repairCountdownText(null), null);
  assert.match(repairReadyLine(repairCountdown(booked, now)), /^Ready by \d\d:\d\d, \w+ the \d+\w\w of [\w ]+\.$/, 'the hour and the day');
  assert.equal(repairReadyLine(repairCountdown(done, now)), 'Ready to collect.');
  assert.match(repairReadyLine(repairCountdown(staged, now, DAY)), /^Ready about /);
});

test('UXB1-K: the CLASSIC counter draws DFU\'s misc label - "DONE" or "N days" over the scheduler\'s estimate - and none under InstantRepairs', () => {
  const now = 523530 + 10 * DAY;
  const booked = { group: 'Weapons', templateIndex: 113, name: 'Sword', currentCondition: 10, maxCondition: 100, repairData: { buildingKey: 7, timeStarted: now - 100, repairTime: 2000 } };
  const finished = { group: 'Weapons', templateIndex: 113, name: 'Axe', currentCondition: 10, maxCondition: 100, repairData: { buildingKey: 7, timeStarted: now - 3000, repairTime: 2000 } };
  const w = new NativeTradeWindow({ mode: 'Repair', repairItems: () => [booked, finished], otherItems: () => [booked, finished], nowMinutes: () => now, packItems: () => [] });
  const labels = w._repairLabels();
  assert.equal(labels.get(booked), '2 days');
  assert.equal(labels.get(finished), 'DONE');
  assert.equal(new NativeTradeWindow({ mode: 'Buy', shelfItems: () => [], packItems: () => [] })._repairLabels(), null, 'Repair mode\'s scroller only (:244)');
  // drawn where ItemListScroller's miscLabelTemplate puts it: top-left inside the button's margins
  const src = read('src/ui/nativeTrade.js');
  assert.match(src, /if \(label\) shadowText\(renderer, font, label, m, rect\[0\] \+ CELL_X \+ CELL_MARGIN, rect\[1\] \+ s \* SLOT_H \+ CELL_MARGIN\);/);
  assert.match(src, /if \(this\.mode !== 'Repair' \|\| getBool\('Controls', 'InstantRepairs'\)\) return null;/);
});

// ── L: THE CLASSIC COUNTER'S SPLIT ───────────────────────────────

const classicShop = (shelf, entity = null) => {
  const basket = [];
  const w = new NativeTradeWindow({ mode: 'Buy', shelfItems: () => shelf, packItems: () => [], entity,
    priceCtx: () => ({ quality: 10, skills: {} }), gold: () => 1e6 });
  w.basket = basket;
  return w;
};
const typeInto = (box, text) => { for (const ch of text) box.input(`Digit${ch}`); };

test('UXB1-L: the classic counter asks DFU\'s "how many" on a Control-click - the popup seeded "0", the typed count what moves', () => {
  const shelf = [oil(12)];
  const w = classicShop(shelf);
  w.click(...REMOTE_SLOT0);
  assert.equal(w.inputBox, null, 'a plain click on a stack that fits moves it whole, as DFU\'s does');
  assert.equal(w.basket[0]?.stackCount, 12);
  const w2 = classicShop([oil(12)]);
  w2.input('ControlLeft');
  w2.click(...REMOTE_SLOT0);
  assert.ok(w2.inputBox, 'Control forces the popup (:1513)');
  assert.equal(w2.inputBox.label, HOW_MANY_ITEMS(12));
  assert.equal(w2.inputBox.value, '0', 'seeded "0" under Control (:1525)');
  typeInto(w2.inputBox, '2');
  w2.input('Enter');
  assert.equal(w2.inputBox, null);
  assert.equal(w2.basket.length, 1);
  assert.equal(w2.basket[0].stackCount, 2, 'two oil in the basket');
  assert.equal(w2.hooks.shelfItems()[0].stackCount, 10, 'ten left on the shelf');
  w2.keyup('ControlLeft');
  assert.equal(w2._controlDown, false, 'the key-up clears it');
  // the click's own Control, off the pointer seam, is the same door
  const w3 = classicShop([oil(12)]);
  w3.pointer('down', ...REMOTE_SLOT0, 0, { ctrl: true, shift: false });
  w3.click(...REMOTE_SLOT0);
  assert.ok(w3.inputBox);
  w3.input('Escape');
  assert.equal(w3.basket.length, 0, 'Escape moves nothing');
});

test('UXB1-L: a stack only partly carried asks too, seeded with what fits - and the popup is modal', () => {
  // an entity that can carry four flasks of oil and no more (planTake's CanCarryAmount)
  const entity = { stats: { strength: 1 }, items: [] };
  const fits = planTake(oil(12), { bag: [], entity }).amount;
  assert.ok(fits >= 1 && fits < 12, `the fixture carries part of the stack (${fits})`);
  const w = classicShop([oil(12)], entity);
  w.click(...REMOTE_SLOT0);
  assert.ok(w.inputBox, 'a partial fit asks (:1512 splitRequired)');
  assert.equal(w.inputBox.value, String(fits), 'seeded with the amount that fits');
  assert.equal(w.click(10, 10), true, 'a click elsewhere is swallowed by the popup');
  assert.ok(w.inputBox, '...and the popup stays');
  w.input('Enter');
  assert.equal(w.basket[0]?.stackCount, fits, 'Return on the seed takes all that fits');
  assert.equal(splitRequired(oil(12), 3, false), true, 'the gate: short of the stack');
  assert.equal(splitRequired(oil(12), 12, true), true, 'or Control');
  assert.equal(splitRequired(oil(1), 0, true), false, 'never a single item');
  assert.equal(splitRequired(oil(12), 12, false), false);
  // one law, both windows (the pack and the counter)
  assert.match(read('src/ui/nativeInventory.js'), /return splitRequired\(it, plan\.amount, this\._controlDown\);/);
  const trade = read('src/ui/nativeTrade.js');
  assert.match(trade, /if \(splitRequired\(item, plan\.amount, this\._controlDown\)\) \{\n\s+this\.inputBox = splitInputBox\(plan\.amount, this\._controlDown,/);
});

// ── L: THE ENHANCED COUNTER'S COUNT ──────────────────────────────

function mountShop(dom, shelf, extra = {}) {
  const host = dom.mk('div');
  dom.body.append(host);
  const bag = [];
  const hooks = { mode: 'Buy', shelfItems: () => shelf, packItems: () => bag, shopName: 'The Oil House',
    priceCtx: () => ({ quality: 10, skills: {} }), gold: () => 1e6, accepts: () => true, enchanted: () => false, ...extra };
  const view = mountEnhancedTrade(host, hooks);
  const q = (sel) => host.querySelectorAll(sel);
  const nameOf = (r) => r.children.find((c) => c.className === 'itemname')?.children[0]?.textContent ?? '';
  const rowsIn = (colCls) => (q(`.${colCls}`)[0]?.querySelectorAll('.itemrow') ?? []);
  const rowOf = (name) => rowsIn('packremote').find((r) => nameOf(r).startsWith(name));
  return { host, hooks, view, q, rowOf, bag };
}
const press = (n) => n.onclick({ timeStamp: 1e9 * Math.random() });

test('UXB1-L: the enhanced counter carries a COUNT on a selected clean stack - seeded with all that fits, and Buy takes that many', () => {
  withDom((dom) => {
    const shelf = [oil(12)];
    const shop = mountShop(dom, shelf);
    try {
      press(shop.rowOf('Oil'));
      const field = shop.q('.trade-qtyin')[0];
      assert.ok(field, 'the count, on the strip');
      assert.equal(field.value, '12', 'seeded with DFU\'s maxAmount - all that fits');
      field.value = '2';
      field.oninput();
      const buy = shop.q('.trade-primary')[0];
      assert.equal(buy.textContent, 'Buy 2', 'the footer names the count as it is typed, without a repaint under the press');
      buy.onclick();
      assert.equal(shelf.length, 1, 'the split lot left the shelf (SplitStack mints it there, then the transfer moves it)');
      assert.equal(shelf[0].stackCount, 10, 'ten left on the shelf');
      assert.match(shop.q('.trade-cost')[0].textContent, /^Cost: [1-9]\d*/, 'and two in the basket, costed');
      // Clear puts it back - into its stack, as AddItem's merge does
      shop.q('.act').find((b) => b.textContent === 'Clear').onclick();
      assert.equal(shelf.length, 1, 'rejoined, not a second row');
      assert.equal(shelf[0].stackCount, 12);
    } finally { shop.view.unmount(); }
  });
});

test('UXB1-L: the stepper and All; no count for a single item or for a stack whose split is not clean (a potion keeps its recipe)', () => {
  withDom((dom) => {
    const potion = { group: 'UselessItems1', templateIndex: GLASS_BOTTLE_TEMPLATE, name: 'Potion', value: 20, stackCount: 5, potionRecipeKey: 1234 };
    const sword = { group: 'Weapons', templateIndex: 113, name: 'Sword', value: 40 };
    const shelf = [oil(12), potion, sword];
    const shop = mountShop(dom, shelf);
    try {
      press(shop.rowOf('Oil'));
      const minus = shop.q('.trade-qty')[0].querySelectorAll('.step')[0];
      minus.onclick();
      assert.equal(shop.q('.trade-qtyin')[0].value, '11');
      shop.q('.trade-qtyall')[0].onclick();
      assert.equal(shop.q('.trade-qtyin')[0].value, '12', 'All is all that fits');
      press(shop.rowOf('Oil'));   // deselect
      press(shop.rowOf('Potion'));
      assert.equal(shop.q('.trade-qtyin').length, 0, 'a potion split would lose its recipe - no count offered');
      press(shop.rowOf('Potion'));
      press(shop.rowOf('Sword'));
      assert.equal(shop.q('.trade-qtyin').length, 0, 'one item has no count');
    } finally { shop.view.unmount(); }
  });
  assert.equal(splitsCleanly(oil(12)), true);
  assert.equal(splitsCleanly(oil(1)), false);
  assert.equal(splitsCleanly({ group: 'UselessItems1', templateIndex: GLASS_BOTTLE_TEMPLATE, stackCount: 3, potionRecipeKey: 9 }), false);
  assert.equal(splitsCleanly({ group: 'Books', templateIndex: 0, stackCount: 3, message: 42 }), false);
  assert.equal(splitsCleanly({ ...oil(12), material: 2 }), false, 'a material the fresh template would not carry');
  assert.equal(splitsCleanly({ ...oil(12), timeForItemToDisappear: 5000 }), false, 'a conjured stack: the fresh item never expires');
});

test('UXB1-L: the count field\'s Return buys that many, not the window\'s confirm', () => {
  withDom((dom) => {
    const shelf = [oil(12)];
    const shop = mountShop(dom, shelf);
    try {
      press(shop.rowOf('Oil'));
      const field = shop.q('.trade-qtyin')[0];
      field.value = '3';
      dom.win.fire('keydown', { key: 'Enter', code: 'Enter', target: field, preventDefault() {}, stopPropagation() {} });
      assert.equal(shelf[0].stackCount, 9, 'three moved');
      assert.equal(shop.q('.sb-ask').length, 0, 'and no Buy confirmation was raised');
    } finally { shop.view.unmount(); }
  });
});

test('UXB1-K: the enhanced counter counts each job down on its row, and names the hour and the day on the strip', () => {
  withDom((dom) => {
    const now = 523530 + 10 * DAY;
    const booked = { group: 'Weapons', templateIndex: 113, name: 'Sword', value: 40, currentCondition: 10, maxCondition: 100, repairData: { buildingKey: 7, timeStarted: now - 100, repairTime: 2000 } };
    const finished = { group: 'Weapons', templateIndex: 113, name: 'Axe', value: 40, currentCondition: 10, maxCondition: 100, repairData: { buildingKey: 7, timeStarted: now - 3000, repairTime: 2000 } };
    const jobs = [booked, finished];
    const shop = mountShop(dom, [], { mode: 'Repair', repairItems: () => jobs, otherItems: () => jobs, nowMinutes: () => now });
    try {
      const labels = shop.q('.itemrepair').map((n) => n.textContent);
      assert.deepEqual(labels, ['Ready in 2 days', 'Ready']);
      assert.ok(shop.q('.itemrepair')[1].className.includes('done'));
      press(shop.rowOf('Sword'));
      const ready = shop.q('.trade-ready')[0];
      assert.ok(ready, 'the strip names when');
      assert.equal(ready.textContent, repairReadyLine(repairCountdown(booked, now)));
    } finally { shop.view.unmount(); }
  });
});
