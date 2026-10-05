// WALLET1 (2026-10-05, Mac: "We need to develop a wallet item that holds forms of currency and sits in the inventory"):
// THE WALLET - a bound, weightless, pack-only piece every character carries, holding its currencies: the letters of
// credit, the Deadlands Embers and the Welkynd Shards out of the enhanced pack's pages and into its own sheet, beside the
// purse's gold and the account's silver; on the classic skin, DFU's four tabs as they were and the wallet's Use its box.
// An organizer, never a second list: every piece stays in `entity.items`, where every spender reads it.
// bible/06-Systems/Wallet.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  WALLET_TEMPLATE, WALLET_ROW, WALLET_HOLDS, WALLET_CARD_LINES, WALLET_GIFT, isWalletItem, hasWallet, walletHolds, mintWallet,
  giveWallet, giveWalletGift, setWalletSilver, walletSilver, refreshWalletSilver, walletContents, walletLines, _resetWalletForTests,
} from '../src/systems/walletItem.js';
import { assignStartingGear, addSurvivalProvisions } from '../src/systems/startingGear.js';
import { snapshotPlayer, restorePlayer } from '../src/systems/save.js';
import { templateByIndex } from '../src/systems/itemTemplates.js';
import { LETTER_OF_CREDIT_TEMPLATE, letterOfCredit, effectiveUnitWeightInKg } from '../src/systems/inventory.js';
import { sigilStone, welkyndShards, portalStones, SIGIL_STONE_TEMPLATE, WELKYND_SHARD_TEMPLATE } from '../src/systems/gateSpoils.js';
import { isBound, boundRefusesPut, BOUND_KEEPS, packOnlyText } from '../src/systems/itemBound.js';
import { SMALL_CART_TEMPLATE } from '../src/systems/inventorySession.js';
import { destroyEnhancedNotice } from '../src/ui/enhancedNotice.js';
import { BOUND_TEMPLATES } from '../src/net/realmTradeLaw.js';
import { useItem } from '../src/systems/useItem.js';
import { pageOf } from '../src/ui/packPages.js';
import { packModel, useResultAction, mountEnhancedInventory, inventoryQuickAct } from '../src/ui/enhancedInventory.js';
import { NativeInventoryWindow } from '../src/ui/nativeInventory.js';
import * as qs from '../src/systems/quickslots.js';
import { itemInfoRows } from '../src/systems/itemInfo.js';
import { withDom, fakeDom } from './invdrag.mjs';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const ICONS = { getTexture: async () => ({ recordCount: 0 }), uploadRecord: () => {}, textures: new Map() };
const flush = async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); };
/** invdrag.mjs's withDom, awaited (test/fb0930_hoodsaid.test.js's): the silver's answer lands a microtask after the sheet
 *  shows, and withDom puts the globals back the moment its callback returns. */
async function withDomAsync(fn) {
  const dom = fakeDom();
  const keys = ['document', 'addEventListener', 'removeEventListener', 'requestAnimationFrame', 'innerWidth', 'innerHeight'];
  const saved = Object.fromEntries(keys.map((k) => [k, [Object.hasOwn(globalThis, k), globalThis[k]]]));
  Object.assign(globalThis, {
    document: dom.doc, addEventListener: dom.win.addEventListener, removeEventListener: dom.win.removeEventListener,
    requestAnimationFrame: () => 0, innerWidth: dom.w, innerHeight: dom.h,
  });
  try { return await fn(dom); } finally {
    for (const [k, [had, v]] of Object.entries(saved)) { if (had) globalThis[k] = v; else delete globalThis[k]; }
  }
}
const pack = () => {
  const embers = Object.assign(sigilStone(), { stackCount: 12 });
  const shards = welkyndShards(40);
  const letters = [letterOfCredit(5000), letterOfCredit(7000)];
  const e = { name: 'Aelwyn', stats: { strength: 50 }, goldPieces: 1240, items: [] };
  e.items = [{ group: 'Weapons', templateIndex: 121, name: 'Katana' }, letters[0], embers, mintWallet(), shards, letters[1], portalStones(3)];
  return { e, embers, shards, letters };
};

// ─── THE PIECE ───────────────────────────────────────────────────────

test('WALLET1 the piece: template 580 on its own row - DFU\'s Small Sack\'s picture and price, no weight, one to a slot, bound and pack-only; minted UselessItems2, named Wallet (mutants: the weight; the binding; the pack-only; the picture)', () => {
  assert.equal(WALLET_TEMPLATE, 580);
  assert.deepEqual([WALLET_ROW.worldTextureArchive, WALLET_ROW.worldTextureRecord], [205, 18], 'DFU\'s own Small Sack (ItemTemplates 86)');
  assert.deepEqual([templateByIndex(86).worldTextureArchive, templateByIndex(86).worldTextureRecord], [205, 18]);
  assert.deepEqual([WALLET_ROW.baseWeight, WALLET_ROW.hasNoEncumbrance, WALLET_ROW.basePrice, WALLET_ROW.stackable, WALLET_ROW.bound, WALLET_ROW.packOnly], [0, true, templateByIndex(86).basePrice, false, true, true]);
  assert.equal(templateByIndex(WALLET_TEMPLATE).name, 'Wallet', 'registered');
  const w = mintWallet();
  assert.deepEqual([w.group, w.templateIndex, w.name], ['UselessItems2', 580, 'Wallet']);
  assert.equal(isWalletItem(w), true);
  assert.equal(isWalletItem({ group: 'Gems', templateIndex: 580 }), false, 'its template and its group');
  assert.equal(effectiveUnitWeightInKg(w), 0, 'weightless');
  assert.equal(isBound(w), true);
});

test('WALLET1 the gift: a new character\'s kit holds one - DFU\'s kit and a mod\'s alike, the port\'s own tail; a character from before the wallet is given one as its save is restored, ONCE (PORTAL-GIFT\'s mark), and a round trip gives none (mutants: given twice; the mark unread; the kit ungiven)', () => {
  const e = { items: [] };
  assert.equal(giveWallet(e), 1);
  assert.equal(giveWallet(e), 0, 'one is carried');
  assert.equal(e.items.filter(isWalletItem).length, 1);
  assert.equal(giveWallet({}), 1, 'a pack made where there was none');
  assert.equal(hasWallet(null), false);
  // the kit
  const kid = { items: [], gender: 'female' };
  assignStartingGear(kid, { classIndex: 13, rolls: () => 0.1, torchesFromItems: false });
  assert.equal(kid.items.filter(isWalletItem).length, 1, 'DFU\'s kit');
  const modKid = { items: [] };
  addSurvivalProvisions(modKid);
  assert.equal(modKid.items.filter(isWalletItem).length, 1, 'the port\'s tail, which a mod\'s kit rides');
  // a save from before the wallet: given once; a round trip after: none
  const old = snapshotPlayer({ items: [], stats: {}, skills: [] });
  delete old.walletGift;
  const back = {};
  restorePlayer(back, old);
  assert.deepEqual([back.items.filter(isWalletItem).length, back.walletGift], [1, WALLET_GIFT], 'given, and marked');
  const again = {};
  restorePlayer(again, snapshotPlayer(back));
  assert.equal(again.items.filter(isWalletItem).length, 1, 'never given twice');
  const born = {};
  restorePlayer(born, snapshotPlayer({ items: [], stats: {}, skills: [] }));
  assert.deepEqual([born.items.length, born.walletGift], [0, WALLET_GIFT], 'a character born after the wallet has its kit\'s - the load gives none');
  assert.equal(giveWalletGift({ walletGift: WALLET_GIFT, items: [] }), 0);
});

test('WALLET1 it never leaves the pack: bound - never dropped, traded or sold - and pack-only: not the wagon nor the player\'s own storage, where a bound ember still goes; the realm\'s service binds its row too; both skins refuse it in its own words (mutants: the pack-only unread; the service blind; either skin\'s refusal unsaid)', () => {
  const w = mintWallet();
  for (const kind of ['wagon', 'storage', 'ground', 'corpse', 'container', 'bag', 'reward']) assert.equal(boundRefusesPut(w, kind), true, kind);
  for (const kind of BOUND_KEEPS) assert.equal(boundRefusesPut(sigilStone(), kind), false, `an ember to the ${kind}`);
  assert.ok(BOUND_TEMPLATES.includes(WALLET_TEMPLATE), 'net/realmTradeLaw.js: a realm trade refuses it');
  assert.equal(packOnlyText('Wallet'), 'Wallet stays in your pack.');
  // the enhanced pack: the player's own storage and the ground refuse it, in its own words, and it stays
  const textOf = (n) => `${n.textContent ?? ''}${(n.children ?? []).map(textOf).join('')}`;
  for (const loot of [{ items: () => [], storage: true }, null]) {
    withDom((dom) => {
      const host = dom.mk('div'); dom.body.append(host);
      const wallet = mintWallet();
      const e = { name: 'Aelwyn', stats: { strength: 50 }, goldPieces: 0, items: [wallet] };
      const dropped = [];
      const view = mountEnhancedInventory(host, { entity: e, items: () => e.items, onExit: () => {}, dropItem: (it) => dropped.push(it), ...(loot ? { loot } : {}) });
      try {
        host.querySelectorAll('.packtab').find((t) => textOf(t).toLowerCase().includes('valu')).onclick();
        host.querySelectorAll('.itemrow').find((r) => textOf(r).includes('Wallet')).onclick({ timeStamp: 100, detail: 1 });
        const act = host.querySelectorAll('.act').find((b) => b.textContent === (loot ? 'Store' : 'Drop'));
        assert.ok(act, 'the act is offered - and speaks when pressed');
        act.onclick();
        assert.deepEqual([e.items, dropped, loot?.items() ?? []], [[wallet], [], []], 'it stays in the pack');
        assert.ok(textOf(dom.body).includes('Wallet stays in your pack.'), 'and the pack says why, in its own words');
      } finally { view.unmount(); destroyEnhancedNotice(); }
    });
  }
  // the classic pack, DFU's: Remove into the wagon - where a bound ember goes - refused in its own words, and it stays
  const wallet = mintWallet(), cart = { name: 'Small cart', group: 'Transportation', templateIndex: SMALL_CART_TEMPLATE, stackCount: 1 };
  const bag = [wallet, cart], wagon = [];
  const win = new NativeInventoryWindow({ items: () => bag, icons: ICONS, entity: { items: bag, activeEffects: [], wagonItems: wagon }, wagonItems: () => wagon });
  win.mode = 'remove';
  win.tab = 'clothing';
  win.usingWagon = true;
  win._pick(win._filtered().indexOf(wallet));
  assert.deepEqual([bag.includes(wallet), wagon.length], [true, 0], 'not stowed in the wagon');
  assert.deepEqual(win.boxes, [{ rows: [{ text: 'Wallet stays in your pack.', center: true }] }]);
});

// ─── WHAT IT HOLDS ───────────────────────────────────────────────────

test('WALLET1 what it holds: DFU\'s letters of credit, the Deadlands Embers and the Welkynd Shards - never a Portal Stone (a thing used, not spent) - and counts the purse\'s gold and the account\'s silver; a worn crystal is the doll\'s (mutants: a kind held or lost; the counts; the letters\' gold)', () => {
  assert.deepEqual([...WALLET_HOLDS], [LETTER_OF_CREDIT_TEMPLATE, SIGIL_STONE_TEMPLATE, WELKYND_SHARD_TEMPLATE]);
  assert.deepEqual([letterOfCredit(10), sigilStone(), welkyndShards(2), portalStones(1), mintWallet()].map(walletHolds), [true, true, true, false, false]);
  const { e, embers, shards, letters } = pack();
  const worn = Object.assign(sigilStone(), { stackCount: 3, equipSlot: 6 });
  e.items.push(worn);
  const c = walletContents(e.items, e, { silver: 35 });
  assert.deepEqual({ ...c, held: undefined }, { gold: 1240, silver: 35, letters: { count: 2, gold: 12000 }, embers: 12, shards: 40, held: undefined });
  assert.deepEqual(c.held, [letters[0], embers, shards, letters[1]], 'in the pack\'s own order, the worn one aside');
  assert.deepEqual(walletLines(c), ['Your wallet holds:', 'Gold: 1,240', 'Silver: 35', 'Letters of credit: 2, worth 12,000 gold', 'Deadlands Embers: 12', 'Welkynd Shards: 40']);
  assert.deepEqual(walletLines(walletContents([], { goldPieces: 0 }, { silver: null })).slice(1),
    ['Gold: 0', 'Silver: kept by your account online', 'Letters of credit: none', 'Deadlands Embers: none', 'Welkynd Shards: none']);
});

test('WALLET1 the silver: the host\'s reader (online, the marks book\'s balance) - none where it is not known, a reader that throws or answers nonsense none; the refresh the host\'s, never a throw (mutants: the reader unread; nonsense believed)', async () => {
  _resetWalletForTests();
  assert.equal(walletSilver(), null, 'offline: none');
  let asked = 0;
  setWalletSilver(() => 77, () => { asked++; });
  assert.equal(walletSilver(), 77);
  await refreshWalletSilver();
  assert.equal(asked, 1);
  for (const bad of [() => -1, () => 1.5, () => 'x', () => { throw new Error('a book'); }]) { setWalletSilver(bad, () => { throw new Error('no'); }); assert.equal(walletSilver(), null); }
  assert.equal(await refreshWalletSilver(), undefined, 'a refresh that throws');
  setWalletSilver(() => 1, () => Promise.reject(new Error('the service is down')));
  assert.equal(await refreshWalletSilver(), undefined, 'a refresh that rejects - the sheet\'s redraw waits on it');
  _resetWalletForTests();
});

// ─── THE PACK ────────────────────────────────────────────────────────

test('WALLET1 the enhanced pack: what the wallet holds leaves the pages for its sheet - the wallet itself on Valuables; with no wallet the currencies on Valuables; every unequipped piece on exactly one page or in the wallet (mutants: the pieces left on the pages; the wallet on Misc; the partition broken)', () => {
  const { e, embers, shards, letters } = pack();
  assert.equal(pageOf(mintWallet()), 'valuables');
  const m = packModel({ entity: e, items: () => e.items });
  const paged = m.tabs.flatMap((t) => t.items);
  for (const it of [embers, shards, ...letters]) assert.equal(paged.includes(it), false, `${it.name} is the wallet's`);
  assert.deepEqual(m.tabs.find((t) => t.tab === 'valuables').items.map((it) => it.name), ['Wallet']);
  assert.deepEqual(m.wallet.held, [letters[0], embers, shards, letters[1]]);
  assert.equal(m.wallet.item, e.items[3]);
  assert.equal(paged.length + m.wallet.held.length, e.items.length, 'a partition: the pages and the wallet');
  const bare = { ...e, items: e.items.filter((it) => !isWalletItem(it)) };
  const m2 = packModel({ entity: bare, items: () => bare.items });
  assert.equal(m2.wallet, null);
  assert.deepEqual(m2.tabs.find((t) => t.tab === 'valuables').items.filter((it) => it.templateIndex === LETTER_OF_CREDIT_TEMPLATE), letters, 'no wallet: the letters on Valuables, the page\'s own words (never misc, where their group alone filed them)');
});

test('WALLET1 the sheet: the wallet picked says its currencies, and each piece it holds is a row that opens that piece\'s own card - whose acts are the pack\'s (a stack\'s lock, its stow) - with the way back to the wallet; its Use picks it (mutants: no sheet; a piece unreachable; no way back; the Use a message)', () => {
  withDom((dom) => {
    const host = dom.mk('div'); dom.body.append(host);
    const { e } = pack();
    const view = mountEnhancedInventory(host, { entity: e, items: () => e.items, onExit: () => {} });
    const text = (n) => [n.textContent, ...n.children.map(text)].join(' ');
    const buttons = () => host.querySelectorAll('button');
    const press = (re) => { const b = buttons().find((x) => re.test(text(x))); assert.ok(b, `a button ${re}`); b.onclick({}); };
    press(/^\s*Valuables/);
    press(/Wallet/);
    const sheet = host.querySelector('.walletsheet');
    assert.ok(sheet, 'the sheet');
    assert.match(text(sheet), /Gold: 1,240/);
    assert.match(text(sheet), /Letters of credit: 2, worth 12,000 gold/);
    assert.match(text(sheet), /Deadlands Embers: 12/);
    const pieces = sheet.querySelectorAll('button');
    assert.equal(pieces.length, 4, 'a row for each piece it holds');
    pieces.find((b) => /Deadlands Ember/.test(text(b))).onclick({});
    assert.equal(host.querySelector('.walletsheet'), null, 'the ember\'s own card');
    assert.ok(buttons().some((b) => /Lock/.test(text(b))), 'the stack\'s own acts');
    press(/^\s*Wallet\s*$/);
    assert.ok(host.querySelector('.walletsheet'), 'and back to the wallet');
    // its Use opens its sheet - the pad's X over its row (PADPLUS5's quick act: no verb to wear, so Use), nothing picked
    host.querySelector('.sheet-close').onclick({});
    assert.equal(host.querySelector('.walletsheet'), null, 'put away');
    const row = host.querySelectorAll('.itemrow').find((r) => /Wallet/.test(text(r)));
    row.isConnected = true;   // the harness's tree has no document to be connected to (test/fb1004c_robes.test.js)
    assert.equal(inventoryQuickAct(row), true, 'the quick act acted');
    assert.ok(host.querySelector('.walletsheet'), 'the Use is the wallet opened');
    assert.equal(e.items.length, 7, 'and nothing spent or moved');
    view.unmount();
  });
  assert.deepEqual(useResultAction({ kind: 'wallet', item: 'w' }), { kind: 'pickWallet', item: 'w' });
});

test('WALLET1 the sheet\'s silver: asked afresh of the host once a mount, as the sheet first shows, and the sheet redrawn with the answer; an answer that lands while a piece is picked is the sheet\'s when the player comes back; the next mount asks again (mutants: asked every draw; never redrawn; an answer under a piece lost; never asked again)', async () => {
  _resetWalletForTests();
  let balance = null;
  let asked = 0;
  let answer = () => {};
  setWalletSilver(() => balance, () => { asked++; return new Promise((res) => { answer = () => { balance = 35; res(); }; }); });
  try {
    await withDomAsync(async (dom) => {
      const { e } = pack();
      const text = (n) => [n.textContent, ...n.children.map(text)].join(' ');
      const open = () => {
        const host = dom.mk('div'); dom.body.append(host);
        const view = mountEnhancedInventory(host, { entity: e, items: () => e.items, onExit: () => {} });
        const press = (re) => { const b = host.querySelectorAll('button').find((x) => re.test(text(x))); assert.ok(b, `a button ${re}`); b.onclick({}); };
        press(/^\s*Valuables/);
        press(/Wallet/);
        return { host, view, press, sheet: () => host.querySelector('.walletsheet') };
      };
      const first = open();
      assert.match(text(first.sheet()), /Silver: kept by your account online/, 'not known yet');
      assert.equal(asked, 1, 'asked as the sheet first shows');
      answer(); await flush();
      assert.match(text(first.sheet()), /Silver: 35/, 'redrawn with the answer');
      first.sheet().querySelectorAll('button')[0].onclick({});
      first.press(/^\s*Wallet\s*$/);
      assert.ok(first.sheet(), 'the sheet again');
      assert.equal(asked, 1, 'once a mount');
      first.view.unmount();
      balance = null;
      const second = open();
      assert.equal(asked, 2, 'the next mount asks again');
      second.sheet().querySelectorAll('button')[0].onclick({});
      assert.equal(second.sheet(), null, 'a piece\'s own card');
      answer(); await flush();
      second.press(/^\s*Wallet\s*$/);
      assert.match(text(second.sheet()), /Silver: 35/, 'the answer that landed under a piece is the sheet\'s when the player comes back');
      assert.equal(asked, 2, 'and nothing asked again');
      second.view.unmount();
    });
  } finally { _resetWalletForTests(); }
});

test('WALLET1 the Use: the wallet\'s use is its own kind - the classic window shows its lines in DFU\'s own box and asks the silver afresh, the hotbar says them on the HUD\'s line; the card says what it is for (mutants: the classic box unsaid; the silver unasked; the hotbar silent; the card blank)', () => {
  const { e } = pack();
  const r = useItem(e.items[3], e.items, { entity: e });
  assert.equal(r.kind, 'wallet');
  let asked = 0;
  setWalletSilver(() => 35, () => { asked++; });
  try {
    // the classic window, DFU's: its own click-anywhere box, the wallet's lines - the window stays up
    const w = new NativeInventoryWindow({ items: () => e.items, icons: ICONS, entity: e });
    w._use(e.items[3], e.items);
    assert.deepEqual(w.boxes, [{ rows: walletLines(walletContents(e.items, e)).map((text) => ({ text, center: true })) }]);
    assert.ok(w.boxes[0].rows.some((row) => row.text === 'Silver: 35'), 'the account\'s silver');
    assert.equal(w.done, false, 'the window stays up');
    assert.equal(asked, 1, 'the silver asked afresh for the next look');
    // the hotbar: a wallet pressed is the pack's Use, its figures on the HUD's line
    qs.clearHotbar();
    qs.setHotbarSlot(0, qs.hotbarEntryForItem(e.items[3]));
    const said = [];
    let done = null;
    const doors = { quickUse: (n) => { done = qs.useQuickslot(n === 1 ? 'c1' : 'c2', { entity: e, items: e.items, hooks: {}, say: (l) => said.push(l) }); return true; } };
    assert.equal(qs.hotbarPress(0, { entity: e, doors, say: (l) => said.push(l) }).kind, 'used');
    assert.equal(done.kind, 'used');
    assert.deepEqual(said, ['Gold: 1,240 · Silver: 35 · Letters of credit: 2, worth 12,000 gold · Deadlands Embers: 12 · Welkynd Shards: 40']);
  } finally { qs.clearHotbar(); _resetWalletForTests(); }
  const rows = itemInfoRows(mintWallet(), () => []).map((x) => x.text ?? x);
  for (const line of WALLET_CARD_LINES) assert.ok(rows.some((t) => String(t).includes(line)), line);
});

test('WALLET1 the hosts: the streaming host tells the wallet the account\'s silver (the marks book\'s balance, refreshed as the sheet opens) - online alone; THE FOUR HOSTS read no door of their own (mutants: the reader unregistered; registered offline)', () => {
  const w = src('src/scenes/world.js');
  assert.match(w, /if \(marksBook\) setWalletSilver\(\(\) => \(marksBook\.state\.open === false \? null : marksBook\.state\.balance\), \(\) => marksBook\.refresh\(\)\);/);
  for (const f of ['src/scenes/exterior.js', 'src/scenes/worldModes.js', 'src/scenes/dungeonContext.js']) assert.doesNotMatch(src(f), /setWalletSilver/, f);
});
