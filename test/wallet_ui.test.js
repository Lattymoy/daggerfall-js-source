// WALLET-UI (2026-10-07, Mac: "Polish and organize the ingame wallet item for ease of readability"): THE WALLET'S LEDGER.
// The wallet's sheet said its currencies as a stack of centred lines, the classic box's words one paragraph each. It is a
// ledger now (systems/walletItem.js walletLedger): two parts under their names - the coin (gold, silver) and what the
// wallet holds (letters of credit, Deadlands Embers, Welkynd Shards) - a row a currency, its label left and its figure
// right in one column, an empty one dimmed, a figure not counted here giving way to why, a letter's worth under its count.
// The classic box says the same rows as lines (walletLines), so the two cannot disagree. Photographed by
// tools/walletProbe.mjs. The record: bible/06-Systems/Wallet.md WALLET-UI.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mintWallet, walletContents, walletLedger, walletLine, walletLines, setWalletSilver, _resetWalletForTests } from '../src/systems/walletItem.js';
import { letterOfCredit } from '../src/systems/inventory.js';
import { sigilStone } from '../src/systems/gateSpoils.js';
import { mountEnhancedInventory } from '../src/ui/enhancedInventory.js';
import { ENHANCED_CSS } from '../src/ui/enhancedStyle.js';
import { withDom } from './invdrag.mjs';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('WALLET-UI the ledger: two parts under their names, a row a currency - a figure, `none` dimmed for an empty one, the silver\'s why where it is not counted, a letter\'s worth as its note - and the classic box says each row as its line (mutants: one part; the worth in no note; an empty one undimmed; the silver counted as nought)', () => {
  const c = walletContents([letterOfCredit(5000), Object.assign(sigilStone(), { stackCount: 3 })], { goldPieces: 0 }, { silver: null, here: false });
  const ledger = walletLedger(c);
  assert.deepEqual(ledger.map((p) => p.head), ['Coin', 'In the wallet']);
  assert.deepEqual(ledger.flatMap((p) => p.rows).map((r) => [r.key, r.label, r.figure, r.none, r.note]), [
    ['gold', 'Gold', '0', false, null],
    ['silver', 'Silver', null, false, 'kept by your account online'],
    ['letters', 'Letters of credit', '1', false, 'worth 5,000 gold'],
    ['embers', 'Deadlands Embers', '3', false, null],
    ['shards', 'Welkynd Shards', 'none', true, null],
  ]);
  assert.deepEqual(walletLines(c), ['Your wallet holds:', 'Gold: 0', 'Silver: kept by your account online', 'Letters of credit: 1, worth 5,000 gold', 'Deadlands Embers: 3', 'Welkynd Shards: none'], 'the classic box: the rows as lines, its words as they were');
  assert.equal(walletLine({ label: 'Silver', figure: '35', note: null }), 'Silver: 35');
  // an account that holds none: a figure, `none`, dimmed - never why
  const none = walletLedger(walletContents([], { goldPieces: 5 }, { silver: false, here: true }))[0].rows[1];
  assert.deepEqual([none.figure, none.none, none.note], ['none', true, null]);
});

test('WALLET-UI the sheet: the ledger drawn - each part\'s name, a row a currency with its label and its figure apart, an empty one marked to dim, the silver\'s why in the figure\'s place, the worth under its count, then the pieces it holds; the sheet\'s rules lay the figures in one column (mutants: the why for a figure lost; the silver\'s why said twice; the empty one unmarked)', () => {
  setWalletSilver(null);
  withDom((dom) => {
    const host = dom.mk('div'); dom.body.append(host);
    const e = { name: 'Aelwyn', stats: { strength: 50 }, goldPieces: 1240, items: [] };
    e.items = [mintWallet(), letterOfCredit(5000)];
    const view = mountEnhancedInventory(host, { entity: e, items: () => e.items, onExit: () => {} });
    const text = (n) => [n.textContent, ...n.children.map(text)].join(' ');
    const press = (re) => host.querySelectorAll('button').find((b) => re.test(text(b))).onclick({});
    press(/^\s*Valuables/);
    press(/Wallet/);
    const sheet = host.querySelector('.walletsheet');
    assert.ok(sheet, 'the sheet');
    assert.deepEqual(sheet.querySelectorAll('.wallet-head').map((h) => [h.tagName, h.textContent]), [['H4', 'Coin'], ['H4', 'In the wallet']]);
    const rows = sheet.querySelectorAll('.wallet-row');
    assert.deepEqual(rows.map((r) => [r.dataset.key, r.children.map((c) => c.className)]), [
      ['gold', ['wallet-k', 'wallet-v']], ['silver', ['wallet-k', 'wallet-v why']], ['letters', ['wallet-k', 'wallet-v']],
      ['embers', ['wallet-k', 'wallet-v']], ['shards', ['wallet-k', 'wallet-v']],
    ]);
    assert.equal(rows[1].children[1].textContent, 'kept by your account online', 'the silver\'s why in the figure\'s place');
    assert.deepEqual(rows.filter((r) => r.className.split(' ').includes('none')).map((r) => r.dataset.key), ['embers', 'shards'], 'the empty ones, to dim');
    assert.deepEqual(sheet.querySelectorAll('.wallet-note').map((n) => n.textContent), ['worth 5,000 gold'], 'the worth under its count, the silver\'s why said once');
    assert.equal(sheet.querySelectorAll('.itemrow').length, 1, 'then the pieces it holds');
    view.unmount();
  });
  _resetWalletForTests();
  for (const rule of [
    /\.pack-shell \.walletsheet \{ text-align: left;/,
    /\.pack-shell \.walletsheet \.wallet-row \{ display: flex; justify-content: space-between;/,
    /\.pack-shell \.walletsheet \.wallet-v \{ color: var\(--bone\); text-align: right; font-variant-numeric: tabular-nums; \}/,
    /\.pack-shell \.walletsheet \.wallet-row\.none \.wallet-v, \.pack-shell \.walletsheet \.wallet-v\.why \{ color: var\(--dim\);/,
  ]) assert.match(ENHANCED_CSS, rule);
  assert.match(src('tools/walletProbe.mjs'), /figures stand in one column/, 'the probe reads the column in a browser');
});
