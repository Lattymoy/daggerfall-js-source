// RPT1026-MISC TOUCH-FIELD (a private report from a phone's browser: the Bank's amount could not be typed, while the map's
// name field could). The Bank's amount
// is the classic window's own typed field (ui/bankWindow.js, DFU's TextBox: the window takes its keys), drawn by the
// enhanced port as words (ui/enhanced/enhancedPort.js 'field') - no element a phone can focus, so a finger on it raised
// no keyboard. The held map's name field is a real input, which is why that one worked. The touch layer's own entry (the
// nav row's "abc", TI2) types into exactly such a window; a press on the port's live field opens it now, with the number
// pad for an amount. Driven through the real Bank window, its real port view and the real touch layer's entry.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { attachTouch, openTouchEntry } from '../../../src/ui/touch/touch.js';
import { createBankAccounts } from '../../../src/systems/banking.js';
import { BankWindow } from '../../../src/ui/bankWindow.js';
import { PORT_SPECS } from '../../../src/ui/enhanced/enhancedPorts.js';

const rd = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
function stubEl() {
  return {
    textContent: '', children: [], _l: new Map(), style: { cssText: '' }, value: '',
    appendChild(c) { this.children.push(c); return c; },
    addEventListener(t, f) { if (!this._l.has(t)) this._l.set(t, []); this._l.get(t).push(f); },
    remove() { this.removed = true; },
    focus() { this.focused = true; },
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1000, height: 600 }),
    fire(t, e) { for (const f of [...(this._l.get(t) ?? [])]) f(e); },
  };
}
/** attachTouch over a document just big enough (fb0929h_touchheld.test.js's), torn down whatever happens. */
async function withTouchDom(fn) {
  const prev = { d: globalThis.document, w: globalThis.window, k: globalThis.KeyboardEvent };
  const made = [];
  const keys = [];
  globalThis.KeyboardEvent = class { constructor(type, init = {}) { this.type = type; Object.assign(this, init); } };
  globalThis.document = { createElement: () => { const e = stubEl(); made.push(e); return e; }, body: stubEl() };
  globalThis.window = { ontouchstart: null, dispatchEvent: (e) => { keys.push(e); return true; } };
  let h = null;
  try { return await fn((canvas, hooks) => (h = attachTouch(canvas, hooks)), made, keys); } finally {
    h?.dispose?.();
    globalThis.document = prev.d; globalThis.window = prev.w; globalThis.KeyboardEvent = prev.k;
  }
}

test('RPT1026-MISC TOUCH-FIELD: on a phone the Bank\'s amount field raises the number pad, and what is typed there reaches the Bank as its own keys - a deposit made by finger (mutants: rpt1026-misc-touch-field-unmarked, rpt1026-misc-touch-entry-unhooked)', async () => {
  const accounts = createBankAccounts(62);
  let purse = 1000;
  const player = { gold: () => purse, totalGold: () => purse, deductGold: (n) => { purse -= n; return n; }, addGold: (n) => { purse += n; }, wagonGold: () => 0, takeWagonGold: () => {}, takeLetter: () => null, addLetter: () => {}, carriedWeightKg: () => 0, maxEncumbranceKg: () => 1e9 };
  const w = new BankWindow({ accounts: () => accounts, regionIndex: () => 17, player, rows: (id) => [{ text: `#${id}`, center: true }], wagonGold: () => 0, dueDateText: () => '' });
  w._button('depositGold');
  const field = PORT_SPECS.bank.view(w).blocks.find((b) => b?.type === 'field');
  assert.deepEqual([field?.active, field?.numeric], [true, true], 'the port draws the open amount as a live numeric field');
  assert.equal(openTouchEntry({ numeric: true }), false, 'off a touch screen there is no entry: the keyboard types into the window');
  await withTouchDom(async (attach, made, keys) => {
    attach(stubEl(), { overlayActive: () => true });
    assert.equal(openTouchEntry({ numeric: true }), true, 'the field\'s press raises the layer\'s entry');
    const entry = made.find((e) => e.type === 'text');
    assert.ok(entry?.focused, 'a real input, focused inside the press - the phone\'s keyboard rises');
    assert.equal(entry.inputMode, 'numeric', 'the number pad');
    entry.value = '250';
    entry.fire('keydown', { key: 'Enter' });
    // the hosts hand a window's keys to it as the slot's input (code, event) - the overlay seam the Bank is on
    for (const e of keys.filter((k) => k.type === 'keydown')) w.input(e.code, e);
  });
  assert.equal(w.value, '250', 'the amount typed on the phone is the Bank\'s');
  w.input('Enter');
  assert.equal(purse, 750, 'and the deposit is made');
  assert.equal(accounts[17].accountGold, 250);
  // the port's press: a live field carries its entry's kind, and the host's click asks the layer first
  const port = rd('src/ui/enhanced/enhancedPort.js');
  assert.match(port, /if \(b\.active\) f\.dataset\.entry = b\.numeric \? 'numeric' : 'text';/);
  assert.match(port, /const typed = e\.target\.closest\?\.\('\.port-field\[data-entry\]'\);\n\s*if \(typed && openTouchEntry\(\{ numeric: typed\.dataset\.entry === 'numeric' \}\)\) \{ e\.stopPropagation\(\); return; \}/);
});
