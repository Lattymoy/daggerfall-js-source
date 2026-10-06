// AUDIT 625 (2026-10-05, Mac: "Lets do a comprehensive audit on this"), the WALLET lens: PR #625's WALLET1, audited.
// bible/01-Overview/Audit-625.md.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { mintWallet, walletContents, walletLines, setWalletSilver, _resetWalletForTests } from '../src/systems/walletItem.js';
import { decorStandOf, decorMountOf, decorOwnEntry } from '../src/systems/decorItems.js';
import { revenantMayTake, pickTaken } from '../src/systems/revenant.js';
import { letterOfCredit } from '../src/systems/inventory.js';
import { sigilStone } from '../src/systems/gateSpoils.js';
import { SMALL_CART_TEMPLATE } from '../src/systems/inventorySession.js';
import { BAG_TEMPLATE } from '../src/net/bagLaw.js';
import { mountEnhancedInventory, inventoryQuickAct } from '../src/ui/enhancedInventory.js';
import { ITEM_FRAME_CSS } from '../src/ui/enhancedPlusStyle.js';
import * as qs from '../src/systems/quickslots.js';
import { _resetForTests as _resetPrefsForTests } from '../src/systems/uiPrefs.js';
import { withDom } from './invdrag.mjs';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const textOf = (n) => `${n.textContent ?? ''}${(n.children ?? []).map(textOf).join('')}`;

// ─── IT NEVER LEAVES THE PACK ────────────────────────────────────────

test('AUDIT 625 W1: the decorate panel never sets the wallet out - a piece set down leaves the pack (decorTool.js commitOwn: packTake), so a pack-only piece stands as none, as the Materials Bag stands as none; a gem still stands (mutants: the pack-only unread at the stand)', () => {
  const wallet = mintWallet();
  assert.equal(decorStandOf(wallet), null, 'it stands as nothing');
  assert.equal(decorMountOf(wallet), null, 'nor hangs');
  assert.equal(decorOwnEntry(wallet, 0), null, 'so the panel lists no row for it (scenes/decorTool.js ownEntries reads this door alone)');
  assert.equal(decorStandOf({ group: 'UselessItems2', templateIndex: BAG_TEMPLATE }), null, 'the Materials Bag, as ever');
  // a pack-only piece is refused by its ROW, whatever its picture: the rule is the row's `packOnly`, read at the stand
  assert.match(src('src/systems/decorItems.js'), /if \(isBagItem\(item\) \|\| isPackOnly\(item\)\) return null;/);
  const ruby = { group: 'Gems', templateIndex: 0, name: 'Ruby', stackCount: 1 };
  assert.ok(decorStandOf(ruby), 'a gem still stands');
});

test('AUDIT 625 W2: a revenant never takes the wallet - what it takes leaves the pack for its record, and one that escapes keeps it for good, while the gift is given once (PORTAL-GIFT\'s mark); the next piece is taken instead (mutants: the pack-only unread at the take)', () => {
  const wallet = mintWallet();
  assert.equal(revenantMayTake(wallet), false);
  assert.equal(pickTaken('r1', 1, null, [wallet]), null, 'a pack of a wallet alone: nothing to take');
  const ruby = { group: 'Gems', templateIndex: 0, name: 'Ruby', stackCount: 1, value: 300 };
  for (let k = 0; k < 6; k++) assert.equal(pickTaken('r1', k, null, [wallet, ruby]), ruby, `kill ${k}: the gem, never the wallet`);
  assert.equal(revenantMayTake(sigilStone()), true, 'a bound ember is still the feud\'s (RVN8 names its own exclusions)');
});

// ─── THE SHEET'S ROWS ────────────────────────────────────────────────

/** The pack mounted with the wagon open (the cart's door pressed) and the wallet's sheet showing. */
function withSheet(items, fn) {
  _resetPrefsForTests();
  globalThis.location = { search: '?skin=enhanced' };
  const hadWin = 'window' in globalThis, prevWin = globalThis.window;
  globalThis.window = { innerWidth: 1280, innerHeight: 800 };   // the menu is placed beside the pointer (test/robesHarness.mjs)
  return withDom((dom) => {
    const host = dom.mk('div'); dom.body.append(host);
    const e = { name: 'Aelwyn', career: { name: 'Spellsword' }, stats: { strength: 50, endurance: 48 }, items, goldPieces: 10, wagonItems: [] };
    const view = mountEnhancedInventory(host, { entity: e, items: () => e.items, wagonItems: () => e.wagonItems, onExit: () => {} });
    try {
      host.querySelectorAll('button').find((b) => b.onclick && /cart|wagon/i.test(textOf(b))).onclick();
      const sheet = () => host.querySelector('.walletsheet');
      const openSheet = () => {
        host.querySelectorAll('.packtab').find((t) => textOf(t).toLowerCase().includes('valu')).onclick();
        host.querySelectorAll('.itemrow').find((r) => !r.closest('.walletsheet') && !r.closest('.loot-win') && textOf(r).includes('Wallet')).onclick({ timeStamp: 100, detail: 1 });
        assert.ok(sheet(), 'the sheet');
      };
      return fn({ dom, host, e, sheet, openSheet });
    } finally { view.unmount(); if (hadWin) globalThis.window = prevWin; else delete globalThis.window; }
  });
}

test('AUDIT 625 W3: each piece the wallet holds is the pack\'s own ROW in its sheet - every gesture its page gave it before the wallet took it in: Shift into the store beside it (SHIFT-STOW), the drag, the right click\'s menu, the pad\'s quick act, and the click that opens its card; a button that only opened the card took them away (mutants: the sheet\'s rows buttons again)', () => {
  const cart = { name: 'Small cart', group: 'Transportation', templateIndex: SMALL_CART_TEMPLATE, stackCount: 1 };
  const letters = [letterOfCredit(5000), letterOfCredit(7000)];
  withSheet([mintWallet(), cart, letters[0], letters[1]], ({ dom, host, e, sheet, openSheet }) => {
    openSheet();
    const rows = sheet().querySelectorAll('.itemrow');
    assert.equal(rows.length, 2, 'a row for each piece it holds');
    assert.deepEqual(rows.map((r) => r._padItem), letters, 'each row the piece itself - the pad\'s quick act reads it');
    assert.ok(rows.every((r) => typeof r.onpointerdown === 'function'), 'and each drags');
    // the right click: the piece's own menu, its acts
    rows[0].oncontextmenu({ preventDefault() {}, clientX: 10, clientY: 10 });
    const menu = dom.body.querySelectorAll('.inv-menu')[0];
    assert.ok(menu && /Letter of Credit/i.test(textOf(menu)), 'the menu, the piece\'s own');
    menu.remove();
    // Shift: the whole piece into the wagon beside it, as on its page
    rows[0].onclick({ timeStamp: 1_000_000, detail: 1, shiftKey: true });
    assert.deepEqual(e.wagonItems, [letters[0]], 'stowed in the wagon');
    assert.equal(e.items.includes(letters[0]), false);
    // the click that opens its card, and the way back
    openSheet();
    sheet().querySelectorAll('.itemrow')[0].onclick({ timeStamp: 2_000_000, detail: 1 });
    assert.equal(sheet(), null, 'the letter\'s own card');
    assert.ok(host.querySelectorAll('button').some((b) => textOf(b).trim() === 'Wallet'), 'with the way back');
    // the pad's X on a held row is the page's quick act (a letter: nothing to wear, so its Use)
    openSheet();
    const row = sheet().querySelectorAll('.itemrow')[0];
    row.isConnected = true;   // the harness's tree has no document to be connected to (test/fb1004c_robes.test.js)
    assert.equal(inventoryQuickAct(row), true, 'the quick act acted');
  });
  // and each is the dock's own tile: laid as the dock lays them, the tier on its frame, its pips, its count's corner and
  // a drag's insertion mark (the Plus skin's frames named the dock's rows alone)
  assert.match(src('src/ui/enhancedStyle.js'), /\.pack-shell \.walletsheet \.walletpieces \{ display: flex; flex-wrap: wrap; gap: 6px;/);
  for (const tail of ['[data-rarity] {', '[data-rarity]::before {', ' .count {', '.hasbar .count {', '[data-locked] .count {', '[data-rarity].dragover {', '.hasbar[data-rarity]::before {']) {
    const sel = tail.slice(0, -2);
    assert.ok(ITEM_FRAME_CSS.includes(`.pack-shell .walletpieces .itemrow${sel}, .pack-shell .pack-dock .itemrow${tail}`), `the wallet's tile${sel}`);
  }
  assert.ok(ITEM_FRAME_CSS.includes('.pack-shell .walletpieces .itemrow[data-rarity]:hover, .pack-shell .walletpieces .itemrow[data-rarity]:focus-visible,\n.pack-shell .pack-dock .itemrow[data-rarity]:hover'));
});

// ─── THE SILVER ──────────────────────────────────────────────────────

test('AUDIT 625 W5: the silver line says WHY it shows no figure - offline the account keeps it online; online the page is asking (every look asks afresh); an account that holds none (a guest, or the counting-houses shut) says none - and the hotbar asks afresh for its next press, as the classic box asks for its next look; one ask in flight at a time (mutants: the online wait in the offline words; none in the offline words; the hotbar never asking; asks stacked)', async () => {
  _resetWalletForTests();
  try {
    const empty = (opts) => walletLines(walletContents([], { goldPieces: 0 }, opts))[2];
    assert.equal(empty(), 'Silver: kept by your account online', 'offline: no host');
    setWalletSilver(() => null, () => {});
    assert.equal(empty(), 'Silver: asking your account', 'online, not known yet');
    setWalletSilver(() => false, () => {});
    assert.equal(empty(), 'Silver: none', 'online, an account that holds none');
    setWalletSilver(() => 35, () => {});
    assert.equal(empty(), 'Silver: 35');
    // the host's reader: false while the book says the account holds none
    assert.match(src('src/scenes/world.js'), /if \(marksBook\) setWalletSilver\(\(\) => \(marksBook\.state\.open === false \? false : marksBook\.state\.balance\), \(\) => marksBook\.refresh\(\)\);/);
    // the hotbar: says what is known now, and asks afresh for the next press
    let asked = 0;
    let settle = () => {};
    setWalletSilver(() => null, () => { asked++; return new Promise((res) => { settle = res; }); });
    const e = { name: 'Aelwyn', goldPieces: 5, items: [mintWallet()] };
    qs.clearHotbar();
    qs.setHotbarSlot(0, qs.hotbarEntryForItem(e.items[0]));
    const said = [];
    const doors = { quickUse: (n) => { qs.useQuickslot(n === 1 ? 'c1' : 'c2', { entity: e, items: e.items, hooks: {}, say: (l) => said.push(l) }); return true; } };
    assert.equal(qs.hotbarPress(0, { entity: e, doors, say: (l) => said.push(l) }).kind, 'used');
    assert.match(said[0], /Silver: asking your account/);
    assert.equal(asked, 1, 'the hotbar asked');
    qs.hotbarPress(0, { entity: e, doors, say: (l) => said.push(l) });
    assert.equal(asked, 1, 'one ask in flight - a second press waits on it');
    settle(); for (let i = 0; i < 5; i++) await Promise.resolve();
    qs.hotbarPress(0, { entity: e, doors, say: (l) => said.push(l) });
    assert.equal(asked, 2, 'settled: the next press asks again');
  } finally { qs.clearHotbar(); _resetWalletForTests(); }
});
