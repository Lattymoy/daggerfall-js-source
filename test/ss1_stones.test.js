// SS1 (2026-09-27, Mac: "make sigil stones bound items and stackable, raise the prices on the new boss vendor"): the
// Sigil Stone BOUND (systems/itemBound.js - never handed to another player: the trade will not hold one out, and a
// peer's lot carrying one is refused whole) and STACKING with its own kind alone (systems/gateSpoils.js), the stones a
// save holds from before folded into their stacks on load (systems/save.js, below its index-keyed relinks), and the
// card's line. The Broker's count, sale and prices over the stacks are test/set7_broker.test.js's. SS3 (the world
// will not take one), SS4 (the Broker's wares bound too, and neither counter sells a bound piece) and SS5 (a ware
// dismantled in the pack for a share of its stones) below.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sigilStone, restackStones, isSigilStone, SIGIL_STONE_TEMPLATE } from '../src/systems/gateSpoils.js';
import { isBound, BOUND_LINE, BOUND_TRADE_TEXT, BOUND_KEEPS, boundRefusesPut, boundText, unbound } from '../src/systems/itemBound.js';
import { NativeInventoryWindow, tabAccepts } from '../src/ui/nativeInventory.js';
import { NativeTradeWindow } from '../src/ui/nativeTrade.js';
import { mountEnhancedTrade } from '../src/ui/enhancedTrade.js';
import { mountBrokerWindow } from '../src/ui/brokerWindow.js';
import { brokerStock, brokerSale, brokerDay, BROKER_DAY_MS, BROKER_PRICES, BROKER_DISMANTLE_SHARE, dismantleStones, dismantleRefusal, dismantleWare, dismantleAsk, DISMANTLE_INSTEAD, DISMANTLE_WORN, DISMANTLED, stonesText, brokerBought, markBrokerBought, _resetBrokerForTests } from '../src/systems/sigilBroker.js';
import { stonesText as windowStonesText } from '../src/ui/brokerWindow.js';
import { YesNoBoxWindow } from '../src/ui/yesNoBox.js';
import { destroyEnhancedNotice } from '../src/ui/enhancedNotice.js';
import { fitBoxRows, BOX_FIT_W, layoutMessageBox } from '../src/ui/messageBox.js';
import { measureText } from '../src/ui/text.js';
import { equipItem, isEquipped } from '../src/systems/equip.js';
import { isDeclaredItemField } from '../src/systems/itemFields.js';
import { validLootItem } from '../src/systems/loot.js';
import { itemLongName } from '../src/systems/itemInfo.js';
import { applyInteriorLoot, interiorLootRecords } from '../src/world/interiorShared.js';
import { SMALL_CART_TEMPLATE } from '../src/systems/inventorySession.js';
import { isLocked, setLocked, lockRefuses, lockedText } from '../src/systems/itemLock.js';
import { tradeRefusal, createTradePack } from '../src/systems/tradePack.js';
import { createTradeManager, inTradeRange } from '../src/net/tradeSession.js';
import { validTradeData } from '../src/net/wire.js';
import { addItem, stacksWith, splitStack } from '../src/systems/inventory.js';
import { mintCondition, setItemFields, templateByIndex } from '../src/systems/itemTemplates.js';
import { restorePlayer, snapshotPlayer } from '../src/systems/save.js';
import { withDom, fakeDom } from './invdrag.mjs';
import { mountEnhancedInventory } from '../src/ui/enhancedInventory.js';
import { _resetForTests as _resetPrefsForTests } from '../src/systems/uiPrefs.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const ruby = () => mintCondition(setItemFields({ group: 'Gems', templateIndex: 0 }));
const stack = (n) => Object.assign(sigilStone(), { stackCount: n });
const summary = (list) => list.map((i) => [i.name, i.stackCount ?? 1, isLocked(i)]);

test('SS1 the stone is bound by its row: every stone, one minted before the row said so too, and no mark on the record unbinds it; SS4: a piece carrying the mark itself is bound too (the Broker\'s wares), and nothing else is - a gem, no item at all; the binding is not the lock - the player\'s lock is its own word (mutants: the row unbound; a record unbinding its row; the mark ignored)', () => {
  assert.equal(templateByIndex(SIGIL_STONE_TEMPLATE).bound, true, 'the row says it');
  assert.equal(isBound(sigilStone()), true);
  assert.equal(isBound({ group: 'Gems', templateIndex: SIGIL_STONE_TEMPLATE, name: 'Sigil Stone' }), true, 'a record from before SS1: bound, by its row');
  assert.equal(isBound({ ...sigilStone(), bound: false }), true, 'no field on the record unbinds it');
  assert.equal(isBound({ ...ruby(), bound: true }), true, 'SS4: a piece carrying the mark itself is bound');
  assert.equal(isBound(ruby()), false);
  assert.equal(isBound(null), false);
  assert.equal(isBound(undefined), false);
  const stone = sigilStone();
  assert.equal(isLocked(stone), false, 'bound is not locked');
  for (const way of ['drop', 'sell', 'trade']) assert.equal(lockRefuses(stone, way), false, `the lock's ${way} is the player's word alone`);
  assert.equal(BOUND_LINE, 'Bound - it cannot be dropped, traded or sold.');
  assert.equal(BOUND_TRADE_TEXT, 'Bound items cannot be traded.');
});

test('SS1 the trade: a bound piece is never put on the table (the pack\'s own refusal, in words), never taken out of the pack for a lot, and a peer\'s lot carrying one - an older build, a forged frame - is refused whole (mutants: the table takes a bound piece; a peer\'s bound lot taken)', () => {
  const stone = sigilStone();
  assert.equal(tradeRefusal(stone), BOUND_TRADE_TEXT);
  assert.equal(tradeRefusal(ruby()), null, 'a gem is traded as ever');
  const e = { items: [stone, ruby()], goldPieces: 10 };
  const pack = createTradePack(e);
  assert.equal(pack.offerable(stone), BOUND_TRADE_TEXT);
  assert.equal(pack.take([{ item: stone, count: 1 }], 0), null, 'never reserved for a lot');
  assert.equal(e.items.length, 2, 'and never out of the pack');
  const wired = (it) => JSON.parse(JSON.stringify(it));
  assert.equal(pack.unwire([wired(ruby()), wired(stack(3))]), null, 'a lot carrying a stone: refused whole');
  assert.equal(pack.unwire([wired(ruby())]).length, 1, 'a lot without one: taken');
});

/** Two players over a fake wire, each with a REAL trade pack (systems/tradePack.js) - test/trade_session.test.js's rig. */
function rig(aItems, bItems) {
  const q = [], said = { A: [], B: [] };
  const ents = { A: { items: aItems, goldPieces: 100 }, B: { items: bItems, goldPieces: 100 } };
  const mk = (me, other, id) => createTradeManager({
    pack: createTradePack(ents[me]), now: () => 0, say: (t) => said[me].push(t), peerName: () => other, selfId: () => id,
    send: (d) => { const v = validTradeData(d); if (!v) return false; q.push({ from: id, to: v.to, d: v }); return true; },
    near: () => inTradeRange([0, 0, 0], [1, 0, 0]), open: () => {},
  });
  const A = mk('A', 'B', 'peerAAAA'), B = mk('B', 'A', 'peerBBBB');
  const mgrs = { peerAAAA: A, peerBBBB: B };
  const pump = () => { while (q.length) { const f = q.shift(); mgrs[f.to].onFrame(f.from, f.d); } };
  assert.deepEqual(A.request('peerBBBB'), { ok: true }); pump();
  assert.deepEqual(B.request('peerAAAA'), { ok: true }); pump();
  assert.ok(A.session && B.session, 'a trade open between them');
  return { A, B, ents, said, pump, q };
}

test('SS1 the trade, end to end over the wire: my stone is refused at the table, with its words; a peer that sends one anyway (the frame the session\'s own offer writes, a stone on it) ends the trade as refused on my side, and nothing of mine moves (mutants: the table takes a bound piece; a peer\'s bound lot taken)', () => {
  const stone = stack(4);
  const r = rig([stone, ruby()], [ruby()]);
  const sa = r.A.session;
  assert.deepEqual(sa.setOffer([{ item: stone, count: 2 }], 0), { ok: false, why: BOUND_TRADE_TEXT });
  assert.deepEqual(sa.mine.entries, [], 'the offer stays as it was');
  assert.equal(sa.setOffer([{ item: r.ents.A.items[1], count: 1 }], 0).ok, true, 'a gem goes on the table');
  r.pump();
  assert.equal(r.B.session?.theirs.items.length, 1, 'and reaches the peer');
  // B's build holds a stone out (a forged frame: the offer B's session would write, a stone on it)
  const sb = r.B.session;
  const frame = { k: 'offer', s: sb.sid, to: 'peerAAAA', r: sb.rev + 1, items: [JSON.parse(JSON.stringify(stack(2)))], g: 0 };
  const v = validTradeData(frame);
  assert.ok(v, 'the wire itself carries it - the refusal is the receiver\'s');
  r.A.onFrame('peerBBBB', v);
  assert.equal(r.A.session, null, 'the trade is over on my side');
  assert.deepEqual(summary(r.ents.A.items), [['Sigil Stone', 4, false], ['Ruby', 1, false]], 'nothing of mine moved');
});

test('SS1 the stone stacks with its own kind alone: a won stone joins the stack in the pack, a locked stack takes only locked stones, a gem never joins it (mutants: the row unstacked)', () => {
  const pack = [];
  addItem(pack, sigilStone());
  addItem(pack, ruby());
  addItem(pack, sigilStone());
  addItem(pack, sigilStone());
  assert.deepEqual(summary(pack), [['Sigil Stone', 3, false], ['Ruby', 1, false]]);
  setLocked(pack[0], true);
  addItem(pack, sigilStone());
  assert.deepEqual(summary(pack), [['Sigil Stone', 3, true], ['Ruby', 1, false], ['Sigil Stone', 1, false]], 'a locked stack is its own');
  assert.equal(stacksWith(ruby(), sigilStone()), false);
});

test('SS1 the fold: a pack saved before the stone stacked - a record a stone - is one stack, each record into the first before it that it stacks with (a locked one with a locked one), its count whole, the other records in their order (mutants: the fold merging locked into unlocked; the fold losing a count)', () => {
  const r = ruby();
  const list = [sigilStone(), r, sigilStone(), Object.assign(stack(2), { locked: true }), stack(3), Object.assign(sigilStone(), { locked: true })];
  assert.equal(restackStones(list), 3, 'three records folded');
  assert.deepEqual(summary(list), [['Sigil Stone', 5, false], ['Ruby', 1, false], ['Sigil Stone', 3, true]]);
  assert.equal(list[1], r, 'a gem untouched, in its place');
  assert.equal(restackStones(list), 0, 'folded once: nothing more to fold');
  const plain = [ruby(), ruby()];
  assert.equal(restackStones(plain), 0, 'a pack with no stones is left as it is - a split gem stays split');
  assert.equal(plain.length, 2);
  assert.equal(restackStones(null), 0);
  assert.ok(list.every((i) => !isSigilStone(i) || i.stackCount >= 1));
});

const makeEntity = (over = {}) => ({
  name: 'Tester', race: 'Breton', gender: 'male', level: 3,
  stats: { strength: 50, endurance: 40, agility: 30, speed: 30, willpower: 30, intelligence: 30, luck: 30, personality: 30 },
  skills: new Array(35).fill(10), skillUses: new Array(35).fill(0),
  items: [], wagonItems: [], activeEffects: [], spells: [],
  health: 30, fatigue: 100, magicka: 10, gold: 0,
  ...over,
});

test('SS1 a load folds the stones - the pack\'s and the wagon\'s - BELOW the index-keyed relinks: a light lit after the stones in the saved list is the same light after the load (mutants: the fold never run; the fold before the relinks; the wagon left unfolded)', () => {
  const torch = { group: 'UselessItems2', templateIndex: 1, stackCount: 1, name: 'Torch' };
  const e = makeEntity({ items: [sigilStone(), sigilStone(), sigilStone(), torch], wagonItems: [stack(2), ruby(), sigilStone()] });
  e.lightSource = torch;
  const snap = snapshotPlayer(e, {});
  assert.equal(snap.lightSourceIndex, 3, 'the saved index: past the three stones');
  const t = makeEntity();
  const info = console.info;
  const lines = [];
  console.info = (s) => lines.push(String(s));
  try { restorePlayer(t, snap); } finally { console.info = info; }
  assert.deepEqual(t.items.map((i) => [i.name, i.stackCount ?? 1]), [['Sigil Stone', 3], ['Torch', 1]], 'one stack');
  assert.equal(t.lightSource, t.items[1], 'the torch is still the light - the index was read before a record moved');
  assert.deepEqual(t.wagonItems.map((i) => [i.name, i.stackCount ?? 1]), [['Sigil Stone', 3], ['Ruby', 1]], 'the wagon\'s too');
  assert.ok(lines.some((l) => l.includes('SS1') && l.includes('2 Sigil Stone record(s)')), 'said, in the console');
});

test('SS1 the card says a bound piece is bound, in the lock\'s own line style without its padlock; a gem says nothing of it (mutants: the card line missing)', () => {
  _resetPrefsForTests();
  globalThis.location = { search: '?skin=enhanced' };
  const textOf = (n) => `${n.textContent ?? ''}${(n.children ?? []).map(textOf).join('')}`;
  withDom((dom) => {
    const host = dom.mk('div');
    dom.body.append(host);
    const e = { name: 'Aelwyn', career: { name: 'Spellsword' }, stats: { strength: 50, endurance: 48 }, items: [stack(3), ruby()], goldPieces: 10 };
    const view = mountEnhancedInventory(host, { entity: e, items: () => e.items, onExit: () => {}, dropItem: () => {} });
    try {
      host.querySelectorAll('.packtab').find((t) => textOf(t).toLowerCase().includes('valu'))?.onclick();
      const rowOf = (name) => host.querySelectorAll('.itemrow').find((r) => textOf(r).includes(name)) ?? null;
      assert.ok(rowOf('Sigil Stone'), 'the stack on the Valuables page');
      rowOf('Sigil Stone').onclick({ timeStamp: 100, detail: 1 });
      assert.deepEqual(host.querySelectorAll('.boundline').map((n) => n.textContent), [BOUND_LINE], 'the card says it once');
      rowOf('Ruby').onclick({ timeStamp: 5000, detail: 1 });
      assert.deepEqual(host.querySelectorAll('.boundline'), [], 'a gem says nothing of it');
    } finally { view.unmount(); }
  });
  assert.match(read('src/ui/enhancedPlusStyle.js'), /\.card \.lockline, \.card \.boundline, \.pack-shell \.card p\.lockline, \.pack-shell \.card p\.boundline \{/, 'the lock\'s line style - on the pack\'s own card too, over `.pack-shell .card p` (AUDIT SS)');
  assert.doesNotMatch(read('src/ui/enhancedPlusStyle.js'), /\.boundline::before/, 'without its padlock');
});

test('SS2 the Broker\'s price column is one width in every row, wide enough for a two-digit price - "12 Sigil Stones" measures 108px in the window\'s 12px face, "4 Sigil Stones" 101 (tools/brokerProbe.mjs measures it on the real page; each row is its own grid, so a column sized by its text moved the Regalia\'s price 7px out of the line) (mutants: the price column sized by its text)', () => {
  const css = read('src/ui/enhancedPlusStyle.js');
  const grid = /\.broker-offer \{ display: grid; grid-template-columns: 48px minmax\(0, 1fr\) (\d+)px 148px;/.exec(css);
  assert.ok(grid, 'the price column has a width of its own');
  assert.ok(Number(grid[1]) >= 109, `wide enough for the widest price (${grid[1]}px)`);
  assert.match(css, /\.broker-price \{ font-size: 12px;/, 'the face the width was measured in');
});

// ── SS3 (2026-09-27, Mac: "They shouldnt be able to be dropped") ──

test('SS3 the law: a bound piece may be put in the player\'s wagon and the player\'s own storage alone - never the ground, a container or a reward tray; a list a peer hands over lands without one, and a refused list stays refused (mutants: the wagon closed to a bound piece; the owner\'s storage closed; a peer\'s list keeps a bound piece)', () => {
  const stone = sigilStone(), gem = ruby();
  assert.deepEqual([...BOUND_KEEPS], ['wagon', 'storage']);
  for (const kind of ['ground', 'container', 'reward', 'elsewhere']) assert.equal(boundRefusesPut(stone, kind), true, kind);
  for (const kind of ['wagon', 'storage']) assert.equal(boundRefusesPut(stone, kind), false, kind);
  for (const kind of ['ground', 'container', 'reward', 'wagon', 'storage']) assert.equal(boundRefusesPut(gem, kind), false, `a gem: ${kind}`);
  assert.equal(boundText('Sigil Stone'), 'Sigil Stone is bound to you - it cannot be dropped, traded or sold.');
  assert.equal(boundText(''), 'That is bound to you - it cannot be dropped, traded or sold.');
  assert.deepEqual(unbound([gem, stack(3), stone]), [gem]);
  assert.equal(unbound(null), null);
});

/** The enhanced pack over a remote (`loot`, or the ground), a stack of three stones and a gem in it. */
function withStonePack(loot, fn) {
  _resetPrefsForTests();
  globalThis.location = { search: '?skin=enhanced' };
  const textOf = (n) => `${n.textContent ?? ''}${(n.children ?? []).map(textOf).join('')}`;
  return withDom((dom) => {
    const host = dom.mk('div');
    dom.body.append(host);
    const stones = stack(3), gem = ruby();
    const e = { name: 'Aelwyn', career: { name: 'Spellsword' }, stats: { strength: 50, endurance: 48 }, items: [stones, gem], goldPieces: 10 };
    const dropped = [];
    const view = mountEnhancedInventory(host, { entity: e, items: () => e.items, onExit: () => {}, dropItem: (it) => dropped.push(it), ...(loot ? { loot } : {}) });
    try {
      host.querySelectorAll('.packtab').find((t) => textOf(t).toLowerCase().includes('valu'))?.onclick();
      const rowOf = (name) => host.querySelectorAll('.itemrow').find((r) => textOf(r).includes(name)) ?? null;
      const actOf = (label) => host.querySelectorAll('.act').find((b) => b.textContent === label) ?? null;
      return fn({ dom, host, e, stones, gem, dropped, rowOf, actOf, textOf });
    } finally { view.unmount(); }
  });
}

test('SS3 the enhanced pack: a stone is not dropped on the ground - it stays in the pack and the pack says why - while a gem drops as ever; the player\'s own storage takes it (mutants: the ground takes a bound piece)', () => {
  withStonePack(null, ({ dom, e, stones, gem, dropped, rowOf, actOf, textOf }) => {
    rowOf('Sigil Stone').onclick({ timeStamp: 100, detail: 1 });
    assert.ok(actOf('Drop'), 'the act is offered - and speaks when pressed');
    actOf('Drop').onclick();
    assert.ok(e.items.includes(stones) && !dropped.includes(stones), 'the stones stay in the pack');
    assert.equal(stones.stackCount, 3, 'every one of them');
    assert.ok(textOf(dom.body).includes(boundText(itemLongName(stones))), 'and the pack says why (the notice door\'s own panel)');
    rowOf('Ruby').onclick({ timeStamp: 5000, detail: 1 });
    if (!actOf('Drop')) rowOf('Ruby').onclick({ timeStamp: 9000, detail: 1 });   // LOCK1's own test: a press may first put the notice away
    actOf('Drop').onclick();
    assert.equal(e.items.includes(gem), false, 'a gem goes on the ground as it always did');
  });
  // (a body's or a stranger's container is TAKE-ONLY on this skin - MAC-M2 B - so the classic pack is where a stone could
  // have been put in one: the test below)
  const store = [];
  withStonePack({ items: () => store, storage: true }, ({ e, stones, rowOf, actOf }) => {
    rowOf('Sigil Stone').onclick({ timeStamp: 100, detail: 1 });
    actOf('Store').onclick();
    assert.ok(!e.items.includes(stones), 'out of the pack');
    assert.deepEqual(store.map((i) => [i.name, i.stackCount ?? 1]), [['Sigil Stone', 3]], 'into the owner\'s own storage, whole');
  });
});

test('SS3 the drag: a stone carried out over the world does not say "Drop" - the release would not drop it - and released there it stays in the pack; a gem\'s ghost says "Drop" as ever (mutants: the drag promising a bound drop)', () => {
  withStonePack(null, ({ dom, e, stones, rowOf }) => {
    const ghostWord = () => dom.doc.querySelectorAll('.dragghost')[0]?.querySelector('.ghostact')?.textContent ?? null;
    const down = (row) => row.onpointerdown?.({ pointerId: 7, button: 0, pointerType: 'mouse', clientX: 10, clientY: 10 });
    const move = () => dom.win.fire('pointermove', { pointerId: 7, clientX: 60, clientY: 60 });
    const up = () => dom.win.fire('pointerup', { pointerId: 7, clientX: 60, clientY: 60 });
    dom.doc.elementFromPoint = () => dom.body;   // out over the world
    down(rowOf('Ruby')); move();
    assert.equal(ghostWord(), 'Drop', 'a gem: the ground\'s own verb');
    dom.win.fire('keydown', { key: 'Escape', code: 'Escape', repeat: false, preventDefault() {}, stopPropagation() {} });
    down(rowOf('Sigil Stone')); move();
    assert.ok(dom.doc.querySelectorAll('.dragghost').length === 1, 'the stone is carried');
    assert.notEqual(ghostWord(), 'Drop', 'but promises no drop');
    up();
    assert.ok(e.items.includes(stones) && stones.stackCount === 3, 'released over the world, it stays in the pack');
  });
});

const ICONS = { getTexture: async () => ({ recordCount: 0 }), uploadRecord: () => {}, textures: new Map() };
/** The classic pack in Remove mode on the page that shows a stone (Clothing & Misc). */
function classic({ bag, loot = null, wagon = null }) {
  const w = new NativeInventoryWindow({ items: () => bag, icons: ICONS, entity: { items: bag, activeEffects: [], ...(wagon ? { wagonItems: wagon } : {}) },
    ...(loot ? { loot } : {}), ...(wagon ? { wagonItems: () => wagon } : {}) });
  w.mode = 'remove';
  w.tab = 'clothing';
  return w;
}

test('SS3 the classic pack: Remove over the ground, or into a chest, refuses a stone in its own words and keeps it; the wagon and the owner\'s storage take it (mutants: the classic ground takes a bound piece)', () => {
  const a = stack(2), bag = [a];
  const w = classic({ bag });
  w._pick(w._filtered().indexOf(a));
  assert.ok(bag.includes(a) && !w.dropped.includes(a), 'not dropped on this skin either');
  assert.deepEqual(w.boxes, [{ rows: [{ text: boundText(itemLongName(a)), center: true }] }]);
  const b = stack(2), bag2 = [b], chest = [];
  const wc = classic({ bag: bag2, loot: { items: () => chest, playerOwned: false, textureArchive: 380, textureRecord: 1 } });
  wc._pick(wc._filtered().indexOf(b));
  assert.ok(bag2.includes(b) && chest.length === 0, 'nor put in a chest');
  const c = stack(2), cart = { name: 'Small cart', group: 'Transportation', templateIndex: SMALL_CART_TEMPLATE, stackCount: 1 }, bag3 = [c, cart], wagon = [];
  const ww = classic({ bag: bag3, wagon });
  ww.usingWagon = true;
  ww._pick(ww._filtered().indexOf(c));
  assert.ok(wagon.includes(c) && !bag3.includes(c), 'stowed in the wagon');
  const d = stack(2), bag4 = [d], store = [];
  const ws = classic({ bag: bag4, loot: { items: () => store, storage: true } });
  ws._pick(ws._filtered().indexOf(d));
  assert.ok(store.includes(d) && !bag4.includes(d), 'stored in the owner\'s own storage');
});

test('SS3 what a peer hands over lands without a bound piece: a building\'s container record (run), and the dungeon\'s container records, a body\'s items on the wire and a peer\'s grant from a body (pinned at their one line each) (mutants: a building\'s container lands a bound piece; a dungeon\'s container lands one; a body on the wire lands one; a peer\'s grant lands one)', () => {
  const ctx = { containers: [{ items: [] }], shelves: [] };
  const wire = (it) => JSON.parse(JSON.stringify(it));
  const n = applyInteriorLoot(ctx, [{ k: 'container:0', r: [wire(ruby()), wire(stack(3))], d: 5 }], { today: 5 });
  assert.equal(n, 1, 'the record lands');
  assert.deepEqual(ctx.containers[0].items.map((i) => i.name), ['Ruby'], 'without the stones');
  const dc = read('src/scenes/dungeonContext.js');
  assert.match(dc, /const items = unbound\(validLootList\(rec\.r\)\);/, 'a dungeon\'s container');
  assert.match(dc, /const li = unbound\(validLootList\(sf\.items\)\);/, 'a body on the wire');
  assert.match(read('src/scenes/exteriorFoes.js'), /const grant = unbound\(validLootList\(data\.grant\)\);/, 'a peer\'s grant');
});

// ── SS4 (2026-09-27, Mac: "Also make the items sold by the oblivion vendor bound also. Can't be traded, dropped or
// sold. Sigil stones shouldnt be able to be sold") ──

const DAY = brokerDay(Date.parse('2026-09-27T12:00:00Z'));

test('SS4 the Broker\'s wares are bound: every offer of a day, and the piece a sale hands over (a fresh mint off the same list), carry the mark - a declared field, kept by a valid loot record - so the trade will not table one and the world will not take one; the mark is what binds a ware, not its row (mutants: a ware unbound)', () => {
  const stock = brokerStock(DAY);
  assert.equal(stock.length, 6);
  for (const o of stock) assert.equal(isBound(o.item), true, `${o.kind}: ${o.item.name}`);
  const sale = brokerSale(stock[0], { items: [stack(12)], bought: [], day: DAY });
  assert.equal(sale.ok, true);
  assert.notEqual(sale.give, stock[0].item, 'a fresh mint');
  assert.equal(sale.give.bound, true, 'the piece the sale hands over');
  assert.equal(isDeclaredItemField('bound'), true);
  assert.equal(validLootItem(JSON.parse(JSON.stringify(sale.give)))?.bound, true, 'a valid loot record keeps it');
  assert.equal(validLootItem({ ...JSON.parse(JSON.stringify(sale.give)), bound: 'yes' }), null, 'a mark that is not true or absent is no item');
  assert.equal(tradeRefusal(sale.give), BOUND_TRADE_TEXT);
  for (const kind of ['ground', 'container', 'reward']) assert.equal(boundRefusesPut(sale.give, kind), true, kind);
  for (const kind of BOUND_KEEPS) assert.equal(boundRefusesPut(sale.give, kind), false, kind);
  const { bound: _mark, ...copy } = sale.give;
  assert.equal(isBound(copy), false, 'without the mark, a set piece like any other');
});

test('SS4 the Broker\'s card says a ware is bound before the sale, in the pack card\'s own words; a piece without the mark says nothing of it (mutants: the Broker card silent)', () => {
  const card = (stock) => withDom(() => {
    const host = document.createElement('div');
    document.body.append(host);
    const view = mountBrokerWindow(host, {
      stock: () => stock, day: () => DAY, now: () => DAY * BROKER_DAY_MS, items: () => [], bought: () => [],
      buy: () => ({ ok: false, reason: 'stones' }), nameOf: (it) => it.name,
    });
    try { return host.querySelectorAll('.boundline').map((n) => n.textContent); } finally { view.unmount(); }
  });
  assert.deepEqual(card(brokerStock(DAY)), [BOUND_LINE], 'the card of the first offer, once');
  const unmarked = brokerStock(DAY).map((o) => { delete o.item.bound; return o; });
  assert.deepEqual(card(unmarked), [], 'no mark, no line');
});

/** test/auditmergeplus_pack.test.js C3's hooks: the classic counter in `mode` over `bag`. */
const tradeHooks = (mode, bag) => ({
  mode, shelfItems: () => [], packItems: () => bag, entity: { items: bag }, accepts: () => true, enchanted: () => true,
  priceCtx: () => ({ quality: 10, skills: { mercantile: 50, personality: 50 } }), gold: () => 1000,
  rows: (id) => [{ text: `#${id}`, center: true }], weight: () => ({ carriedWeightKg: 0, maxEncumbranceKg: 1e9 }),
  commit: () => {}, icons: ICONS,
});
/** One piece clicked from the pack's list at the classic counter in `mode`, on the page that shows it: the box's
 *  words, and whether it went on the counter. */
const PAGES = Object.freeze({ weapons: 'Weapons & Armor', magic: 'Magic Items', clothing: 'Clothing & Misc', ingredients: 'Ingredients' });
const pageOf = (item) => Object.keys(PAGES).find((t) => tabAccepts(item, t));
function classicCounter(mode, item, more = {}) {
  const bag = [item];
  const w = new NativeTradeWindow({ ...tradeHooks(mode, bag), ...more });
  w.tab = pageOf(item);
  const at = w.localList().indexOf(item);
  assert.ok(at >= 0, `${mode}: ${item.name} is on the counter's list`);
  w._pickLocal(at);
  return { said: w.box?.rows?.[0]?.text ?? null, staged: w.staged.includes(item), kept: bag.includes(item) };
}

test('SS4 the classic counter: Sell and Sell Magic refuse a Sigil Stone and a Broker ware, in the pack\'s own words, and both stay in the pack; a gem still sells; a repair and an identify still take a bound piece, because it comes back (mutants: the classic counter sells a bound piece)', () => {
  const ware = () => brokerStock(DAY)[0].item;
  for (const mode of ['Sell', 'SellMagic']) {
    for (const item of [stack(3), ware()]) {
      const r = classicCounter(mode, item);
      assert.equal(r.staged, false, `${mode}: ${item.name} is not put up for sale`);
      assert.equal(r.kept, true, `${mode}: it stays in the pack`);
      assert.equal(r.said, boundText(itemLongName(item)), `${mode}: and the box says why`);
    }
    assert.equal(classicCounter(mode, ruby()).staged, true, `${mode}: a gem sells`);
  }
  // a worn ware to the smith, an unknown one to the sage (tradeModes.js localClickDecision's own gates)
  const worn = Object.assign(ware(), { currentCondition: 1 });
  const unknown = Object.assign(ware(), { enchantments: [{ type: 1, param: 5 }], isIdentified: false });
  for (const [mode, item] of [['Repair', worn], ['Identify', unknown]]) {
    const r = classicCounter(mode, item, { allowMagicRepairs: true });
    assert.equal(isBound(item), true);
    assert.equal(r.staged, true, `${mode}: the binding closes the sale - not the smith, not the sage`);
    assert.equal(r.said, null);
  }
});

test('SS4 the enhanced counter: a Sigil Stone and a Broker ware pressed for Sell or Sell Magic stay in the pack and the counter says why, in the pack\'s own words; a gem sells; the smith still takes a worn ware (mutants: the enhanced counter sells a bound piece; the enhanced Sell Magic sells one; the binding closing the enhanced smith)', () => {
  const textOf = (n) => `${n.textContent ?? ''}${(n.children ?? []).map(textOf).join('')}`;
  const WORD = Object.freeze({ Sell: 'Sell', SellMagic: 'Sell', Repair: 'Repair' });
  /** The enhanced counter in `mode` over `bag`; `press(item)` turns to its page, picks its row and presses the mode's
   *  button, `said()` is the counter's words, `ok()` puts them away. */
  const at = (mode, bag, fn) => withDom((dom) => {
    const host = dom.mk('div');
    dom.body.append(host);
    const view = mountEnhancedTrade(host, { ...tradeHooks(mode, bag), gold: () => 100000, allowMagicRepairs: true });
    let t = 0;
    try {
      const rowOf = (name) => host.querySelectorAll('.itemrow').find((r) => textOf(r).includes(name)) ?? null;
      const press = (it) => {
        host.querySelectorAll('.packtab').find((b) => b.textContent === PAGES[pageOf(it)]).onclick();
        assert.ok(rowOf(it.name), `${mode}: ${it.name} is on the counter's list`);
        rowOf(it.name).onclick({ timeStamp: (t += 5000) });
        host.querySelectorAll('.act.primary').find((b) => b.textContent === WORD[mode]).onclick();
      };
      const said = () => host.querySelectorAll('.px-note').map((n) => n.textContent);
      const ok = () => host.querySelectorAll('.act.primary').find((b) => b.textContent === 'OK').onclick();
      return fn({ press, said, ok });
    } finally { view.unmount(); }
  });
  for (const mode of ['Sell', 'SellMagic']) {
    for (const item of [stack(3), brokerStock(DAY)[0].item]) {
      const gem = ruby(), bag = [item, gem];
      at(mode, bag, ({ press, said, ok }) => {
        press(item);
        assert.ok(bag.includes(item), `${mode}: ${item.name} stays in the pack`);
        assert.equal(item.stackCount ?? 1, item.name === 'Sigil Stone' ? 3 : 1, 'whole');
        assert.equal(said().length, 1, `${mode}: the counter says why`);
        assert.match(said()[0], /^.+ is bound to you - it cannot be dropped, traded or sold\.$/);
        assert.ok(said()[0].startsWith(item.name), 'naming the piece');
        ok();
        press(gem);
        assert.equal(bag.includes(gem), false, `${mode}: a gem goes on the counter as ever`);
      });
    }
  }
  const worn = Object.assign(brokerStock(DAY)[0].item, { currentCondition: 1 }), bag = [worn];
  at('Repair', bag, ({ press, said }) => {
    press(worn);
    assert.deepEqual(said(), [], 'the smith says nothing of the binding');
    assert.equal(bag.includes(worn), false, 'and takes the ware - it comes back');
  });
});

// ── SS5 (2026-09-27, Mac: "The ability to dismantle in the inventory and recieve back sigil stones", the Broker's wares
// alone for now) ──

/** A ware of the day's stock at `slot` - the piece a sale hands over (a fresh mint, bound and priced). */
const ware = (slot = 0) => brokerSale(brokerStock(DAY)[slot], { items: [stack(20)], bought: [], day: DAY }).give;

test('SS5 the law: every ware carries its price, and dismantles for half of it, rounded down - 4 give 2, 6 give 3, 12 give 6 - at least one; a stone, a gem, an unpriced piece and a priced piece without its binding (a price a peer wrote) give nothing (mutants: a ware unpriced; the whole price back; the floor gone; a peer\'s price pays)', () => {
  assert.equal(BROKER_DISMANTLE_SHARE, 0.5);
  const stock = brokerStock(DAY);
  for (const o of stock) {
    assert.equal(o.item.stonesPaid, o.price, `${o.kind}: the price, on the piece`);
    assert.equal(dismantleStones(o.item), Math.floor(o.price / 2), `${o.kind}: half of ${o.price}`);
  }
  assert.equal(ware(0).stonesPaid, stock[0].price, 'the sale\'s mint carries it too');
  const priced = (paid, bound = true) => ({ ...ruby(), bound, stonesPaid: paid });
  assert.deepEqual([4, 6, 12].map((p) => dismantleStones(priced(p))), [2, 3, 6]);
  assert.deepEqual([BROKER_PRICES.rare, BROKER_PRICES.legendary, BROKER_PRICES.weapon, BROKER_PRICES.regalia].map((p) => dismantleStones(priced(p))), [2, 3, 3, 6]);
  assert.equal(dismantleStones(priced(1)), 1, 'at least one');
  for (const bad of [0, -4, 1.5, '4', NaN, null, undefined]) assert.equal(dismantleStones(priced(bad)), 0, String(bad));
  assert.equal(dismantleStones(priced(12, false)), 0, 'a price without the binding: a peer\'s word, never paid');
  const { bound: _mark, ...unbound1 } = ware(0);
  assert.equal(dismantleStones(unbound1), 0);
  const { stonesPaid: _price, ...unpriced } = ware(0);
  assert.equal(dismantleStones(unpriced), 0, 'a ware bought before SS5 (no price on it)');
  for (const it of [sigilStone(), stack(3), ruby(), null, undefined]) assert.equal(dismantleStones(it), 0);
  assert.equal(isDeclaredItemField('stonesPaid'), true);
  const wired = JSON.parse(JSON.stringify(ware(5)));
  assert.equal(validLootItem(wired)?.stonesPaid, stock[5].price, 'a valid loot record keeps it');
  assert.equal(validLootItem({ ...wired, stonesPaid: 0 }), null, 'a price under one is no item');
  assert.equal(validLootItem({ ...wired, stonesPaid: 'twelve' }), null);
  assert.equal(windowStonesText, stonesText, 'the window says the law\'s own words');
  assert.deepEqual(dismantleAsk('Ebony Cuirass', 2), ['Dismantle Ebony Cuirass?', 'It is gone for good, and you get 2 Sigil Stones back.']);
  assert.equal(DISMANTLE_INSTEAD(3), 'Dismantle it for 3 Sigil Stones instead?');
  assert.equal(DISMANTLE_WORN('Ebony Cuirass'), 'Take off Ebony Cuirass before dismantling it.');
  assert.equal(DISMANTLED('Ebony Cuirass', 1), 'Dismantled: Ebony Cuirass, for 1 Sigil Stone.');
});

test('SS5 the dismantle, made: the ware out and its stones in, joining the pack\'s unlocked stack (never a locked one), the rest of the pack untouched and the day\'s mark kept; a worn, a locked, an absent or an unsold piece is refused and nothing moves (mutants: a worn ware dismantled; a locked ware dismantled; the ware kept; no stones back)', () => {
  _resetBrokerForTests();
  const offer = brokerStock(DAY)[4];
  markBrokerBought(offer);
  const w = ware(4), gem = ruby(), locked = Object.assign(stack(2), { locked: true }), loose = stack(3);
  const pack = [locked, w, gem, loose];
  assert.equal(dismantleRefusal(w), null);
  assert.deepEqual(dismantleWare(w, { items: pack }), { ok: true, stones: 3 });
  assert.deepEqual(summary(pack), [['Sigil Stone', 2, true], ['Ruby', 1, false], ['Sigil Stone', 6, false]], 'the ware gone; three stones on the unlocked stack');
  assert.equal(pack[1], gem, 'the gem untouched');
  assert.deepEqual(brokerBought(DAY), [offer.id], 'bought today still - a ware dismantled is not bought again');
  const lockedOnly = [Object.assign(stack(2), { locked: true }), ware(0)];
  assert.equal(dismantleWare(lockedOnly[1], { items: lockedOnly }).ok, true);
  assert.deepEqual(summary(lockedOnly), [['Sigil Stone', 2, true], ['Sigil Stone', 2, false]], 'a locked stack takes only locked stones');
  const refused = (item, pack2, reason) => {
    const before = summary(pack2);
    assert.deepEqual(dismantleWare(item, { items: pack2 }), { ok: false, reason });
    assert.deepEqual(summary(pack2), before, `${reason}: nothing moved`);
  };
  const worn = Object.assign(ware(1), { equipSlot: 0 });
  assert.equal(dismantleRefusal(worn), 'worn');
  refused(worn, [worn, stack(1)], 'worn');
  const lockedWare = Object.assign(ware(2), { locked: true });
  assert.equal(dismantleRefusal(lockedWare), 'locked');
  refused(lockedWare, [lockedWare], 'locked');
  refused(ware(3), [ruby()], 'gone');
  refused(gem, [gem], 'not');
  assert.deepEqual(dismantleWare(ware(0), { items: null }), { ok: false, reason: 'gone' });
  _resetBrokerForTests();
});

/** The enhanced pack over the ground, `items` in it; `open(name)` turns to the page that holds a piece and presses its
 *  row, `actOf(label)` a card button, `said()` the page's words. */
function withWarePack(items, fn, before = null) {
  _resetPrefsForTests();
  destroyEnhancedNotice();   // the notice panel is the module's: an earlier test's stands on its own document
  globalThis.location = { search: '?skin=enhanced' };
  const textOf = (n) => `${n.textContent ?? ''}${(n.children ?? []).map(textOf).join('')}`;
  return withDom((dom) => {
    const host = dom.mk('div');
    dom.body.append(host);
    const e = { name: 'Aelwyn', career: { name: 'Spellsword' }, stats: { strength: 50, endurance: 48 }, items, goldPieces: 10 };
    before?.(e);
    let exits = 0;
    const view = mountEnhancedInventory(host, { entity: e, items: () => e.items, onExit: () => { exits++; }, dropItem: () => {} });
    let t = 0;
    try {
      const rowOf = (name) => host.querySelectorAll('.itemrow').find((r) => textOf(r).includes(name)) ?? null;
      const onAnyPage = (name) => host.querySelectorAll('.packtab').some((tab) => { tab.onclick(); return !!rowOf(name); });
      const open = (name) => {
        for (const tab of host.querySelectorAll('.packtab')) {
          tab.onclick();
          if (rowOf(name)) { rowOf(name).onclick({ timeStamp: (t += 5000), detail: 1 }); if (!actOf('Info')) rowOf(name).onclick({ timeStamp: (t += 5000), detail: 1 }); return; }
        }
        assert.fail(`${name} is on no page`);
      };
      const actOf = (label) => host.querySelectorAll('.act').find((b) => b.textContent === label) ?? null;
      const dialog = () => dom.doc.querySelectorAll('.inv-dismantle')[0] ?? null;
      const dialogAct = (label) => dialog()?.querySelectorAll('.act').find((b) => b.textContent === label) ?? null;
      const said = () => textOf(dom.body);
      const panelOf = (label) => host.querySelectorAll('.wornrow').find((r) => r.onclick && textOf(r).includes(label)) ?? null;
      return fn({ dom, e, open, onAnyPage, actOf, dialog, dialogAct, said, panelOf, exits: () => exits, press: (b) => b.onclick({ timeStamp: (t += 5000), detail: 1, stopPropagation() {} }) });
    } finally { view.unmount(); }
  });
}

test('SS5 the enhanced pack: a ware\'s card offers Dismantle, which asks first - Keep leaves it, Dismantle takes it out and puts its stones in, and the pack says so; Back puts the question away and keeps the pack; a locked ware says why and asks nothing; a worn ware, a stone and a gem offer no Dismantle (mutants: the enhanced card without Dismantle; the card dismantling a worn ware; the question left standing; the lock unsaid; Back closing the pack under the question; the pages left stale)', () => {
  const w = ware(5), gem = ruby();
  const name = itemLongName(w);
  withWarePack([w, gem, stack(1)], ({ dom, e, open, onAnyPage, actOf, dialog, dialogAct, said, exits, press }) => {
    open(name);
    assert.ok(actOf('Dismantle'), 'the card offers it');
    press(actOf('Dismantle'));
    assert.ok(dialog(), 'and asks first');
    assert.equal(dialog().attrs.role, 'alertdialog');
    assert.ok(dismantleAsk(name, 6).every((line) => said().includes(line)), 'the question, and what it gives back');
    press(dialogAct('Keep'));
    assert.equal(dialog(), null, 'Keep puts the question away');
    assert.ok(e.items.includes(w), 'and the ware stays');
    press(actOf('Dismantle'));
    dom.win.fire('keydown', { key: 'Escape', code: 'Escape', repeat: false, preventDefault() {}, stopPropagation() {} });
    assert.equal(dialog(), null, 'Back puts the question away');
    assert.equal(exits(), 0, 'and keeps the pack');
    assert.ok(e.items.includes(w));
    press(actOf('Dismantle'));
    press(dialogAct('Dismantle'));
    assert.equal(dialog(), null, 'the question goes with the answer');
    assert.equal(e.items.includes(w), false, 'the ware is gone');
    assert.deepEqual(summary(e.items), [['Ruby', 1, false], ['Sigil Stone', 7, false]], 'six stones back, on the stack');
    assert.ok(said().includes(DISMANTLED(name, 6)), 'and the pack says so');
    assert.equal(onAnyPage(name), false, 'and no page lists it (the pages rebuilt from the pack)');
    open('Ruby');
    assert.equal(actOf('Dismantle'), null, 'a gem: no Dismantle');
    open('Sigil Stone');
    assert.equal(actOf('Dismantle'), null, 'a stone: none');
  });
  const lockedWare = Object.assign(ware(5), { locked: true });
  withWarePack([lockedWare], ({ e, open, actOf, dialog, said, press }) => {
    open(itemLongName(lockedWare));
    press(actOf('Dismantle'));
    assert.equal(dialog(), null, 'a locked ware asks nothing');
    assert.ok(said().includes(lockedText(itemLongName(lockedWare))), 'and says why');
    assert.ok(e.items.includes(lockedWare));
  });
  const worn = ware(5);
  withWarePack([worn], ({ panelOf, actOf, press }) => {
    assert.equal(isEquipped(worn), true, 'worn');
    press(panelOf('Right arm'));
    assert.ok(actOf('Take off'), 'its card is up, and takes it off');
    assert.equal(actOf('Dismantle'), null, 'a worn ware: taken off first');
  }, (e) => { equipItem(e, worn); });
});

test('SS5 the classic pack: Remove over the ground offers a ware\'s dismantle in DFU\'s own Yes/No box, beside its binding\'s refusal - Yes dismantles it and says so, No keeps it, and a press answers the box as a key does; into a chest a ware is refused plainly; a locked ware is refused the ground and asked nothing (mutants: the classic ground never offers it; the classic offer in a chest; the answered box left standing)', () => {
  const at = (w, loot = null) => {
    const bag = [w, stack(1)];
    const win = classic({ bag, loot });
    win.tab = pageOf(w);
    win._pick(win._filtered().indexOf(w));
    return { win, bag };
  };
  const w = ware(2), name = itemLongName(w), n = dismantleStones(w);
  const yes = at(w);
  assert.ok(yes.win.inputBox instanceof YesNoBoxWindow, 'the question');
  assert.deepEqual(yes.win.inputBox.rows.map((r) => r.text), [boundText(name), DISMANTLE_INSTEAD(n)]);
  assert.ok(yes.bag.includes(w), 'nothing moves before the answer');
  yes.win.input('KeyY');
  assert.equal(yes.win.inputBox, null);
  assert.equal(yes.bag.includes(w), false, 'Yes: dismantled');
  assert.deepEqual(summary(yes.bag), [['Sigil Stone', 1 + n, false]]);
  assert.deepEqual(yes.win.boxes, [{ rows: [{ text: DISMANTLED(name, n), center: true }] }]);
  const no = at(ware(2));
  no.win.input('KeyN');
  assert.equal(no.win.inputBox, null);
  assert.equal(no.bag.length, 2, 'No: kept');
  assert.deepEqual(no.win.boxes, []);
  const pressed = at(ware(2));
  const box = pressed.win.inputBox;
  box.click = function () { this.answer(true); return true; };   // a press on its Yes (the parchment's layout is the art's)
  pressed.win.click(10, 10);
  assert.equal(pressed.win.inputBox, null, 'a press answers the box, and the window takes its clicks again');
  assert.equal(pressed.bag.some((i) => i.stonesPaid), false, 'dismantled');
  const chest = [];
  const inChest = at(ware(2), { items: () => chest, playerOwned: false, textureArchive: 380, textureRecord: 1 });
  assert.equal(inChest.win.inputBox, null, 'into a chest: no question');
  assert.deepEqual(inChest.win.boxes, [{ rows: [{ text: boundText(itemLongName(inChest.bag[0])), center: true }] }], 'the binding\'s refusal');
  assert.equal(chest.length, 0);
  const lockedWare = Object.assign(ware(2), { locked: true });
  const lk = at(lockedWare);
  assert.equal(lk.win.inputBox, null, 'a locked ware: no question');
  assert.deepEqual(lk.win.boxes, [{ rows: [{ text: lockedText(itemLongName(lockedWare)), center: true }] }]);
  assert.ok(lk.bag.includes(lockedWare));
});

test('SS5 a classic box holds its rows on the screen: a row wider than fourteen slices less the margins (288) is wrapped under itself in its own alignment, and the parchment stands inside the 320-px panel; a row that fits, a blank row and a tab-stopped row are left as they were; the pack\'s boxes, the counter\'s and the Yes/No box all fit their rows (mutants: a long row left whole; the fit too narrow; the pack\'s box unfitted; the counter\'s box unfitted; the Yes/No box unfitted)', () => {
  assert.equal(BOX_FIT_W, 288);
  const font = { fnt: { fixedHeight: 7, fixedWidth: 5, glyphWidth: () => 4 } };   // five pixels a glyph, a space four
  const long = boundText("Ebony Guardian's Right Pauldron of Skill");
  assert.ok(measureText(font.fnt, long) > BOX_FIT_W, 'the case: a ware\'s refusal wider than the screen holds');
  const whole = layoutMessageBox(font, [{ text: long, center: true }]);
  assert.ok(whole.w > 320, `left whole, the parchment is ${whole.w} wide`);
  const blank = { text: '', center: true }, fits = { text: 'Dagger is locked. Unlock it first.', center: false };
  const tabbed = { cells: [{ x: 0, text: 'Weight' }, { x: 200, text: 'x'.repeat(40) }] };
  const out = fitBoxRows(font, [{ text: long, center: true }, blank, fits, tabbed]);
  const wrapped = out.slice(0, out.length - 3);
  assert.ok(wrapped.length >= 2, 'wrapped');
  assert.equal(wrapped.map((r) => r.text).join(' '), long, 'every word, in order');
  for (const r of wrapped) {
    assert.ok(measureText(font.fnt, r.text) <= BOX_FIT_W, `"${r.text}" fits`);
    assert.equal(r.center, true, 'in its own alignment');
  }
  assert.deepEqual(out.slice(-3), [blank, fits, tabbed], 'a blank row, a row that fits and a tab-stopped row, as they were');
  assert.equal(out[out.length - 2], fits, 'the very row');
  const laid = layoutMessageBox(font, fitBoxRows(font, [{ text: long, center: true }]));
  assert.ok(laid.w <= 320 && laid.x >= 0, `fitted, the parchment is ${laid.w} wide at ${laid.x}`);
  assert.deepEqual(fitBoxRows(font, ['a b', 'c']), ['a b', 'c'], 'string rows too');
  assert.deepEqual(fitBoxRows(null, [{ text: long }]), [{ text: long }], 'no font: nothing to measure by');
  // the three classic doors a refusal or the dismantle's question comes through (pinned at their one line each)
  assert.match(read('src/ui/nativeInventory.js'), /const rows = box\.painting \? box\.rows : fitBoxRows\(font, box\.rows\);/, 'the pack\'s boxes - never a painting\'s, whose picture wrapping would push off the panel');
  assert.match(read('src/ui/nativeTrade.js'), /this\._boxLayout = layoutMessageBox\(font, fitBoxRows\(font, this\.box\.rows\), buttons\);/, 'the counter\'s box');
  assert.match(read('src/ui/yesNoBox.js'), /const box = layoutMessageBox\(font, fitBoxRows\(font, this\.rows\), \[MB_BUTTONS\.Yes, MB_BUTTONS\.No\]\);/, 'the Yes/No box');
});

// ── AUDIT SS (2026-09-27, Mac: "audit this" - SS1-SS5 end to end) ──

test('AUDIT SS the classic question answers the LEFT button alone - a right click (this pack\'s Remove) or a middle one never presses its Yes; the piece\'s tooltip is put away when it is asked; the player\'s own pile on the ground is the ground (the offer stands there too, never for a locked ware); a reward tray refuses in DFU\'s silence (mutants: a right click answers the question; the tooltip over the question; the own pile never offered; a locked ware offered over its own pile; the reward tray speaks)', () => {
  const ask = (loot = null, w2 = ware(2)) => {
    const bag = [w2, stack(1)];
    const win = classic({ bag, loot });
    win.tab = pageOf(w2);
    let hidden = 0;
    const hide = win._tip.hide.bind(win._tip);
    win._tip.hide = () => { hidden++; hide(); };
    win._pick(win._filtered().indexOf(w2));
    return { win, bag, w2, hidden: () => hidden };
  };
  const a = ask();
  const box = a.win.inputBox;
  assert.ok(box instanceof YesNoBoxWindow);
  assert.ok(a.hidden() >= 1, 'the tooltip put away as the question comes');
  box.click = function () { this.answer(true); return true; };   // a press on its Yes (the parchment's layout is the art's)
  a.win.click(10, 10, true);
  a.win.click(10, 10, false, true);
  assert.equal(a.win.inputBox, box, 'a right or a middle click answers nothing');
  assert.ok(a.bag.includes(a.w2), 'and dismantles nothing');
  a.win.click(10, 10);
  assert.equal(a.bag.includes(a.w2), false, 'the left button answers');
  const pile = [];
  const own = ask({ items: () => pile, playerOwned: true });
  assert.ok(own.win.inputBox instanceof YesNoBoxWindow, 'the player\'s own pile on the ground: the offer');
  const lockedOwn = ask({ items: () => pile, playerOwned: true }, Object.assign(ware(2), { locked: true }));
  assert.equal(lockedOwn.win.inputBox, null, 'a locked ware is never offered');
  assert.deepEqual(lockedOwn.win.boxes, [{ rows: [{ text: boundText(itemLongName(lockedOwn.w2)), center: true }] }], 'its binding\'s refusal');
  // a reward tray: DFU refuses whatever is put there, silently (planStore's chooseOne arm) - a stone too
  const s2 = stack(2), bag2 = [s2];
  const tray = classic({ bag: bag2 });
  tray.chooseOne = { items: [] };
  tray._pick(tray._filtered().indexOf(s2));
  assert.deepEqual(tray.boxes, [], 'nothing said');
  assert.equal(tray.inputBox, null);
  assert.ok(bag2.includes(s2), 'and nothing moved');
});

test('AUDIT SS both counters put back what is staged on ANY way out - the enhanced counter\'s teardown (the door\'s dispose: the QuickDial key, a death, a building left, a load) and the classic counter\'s dispose - as their own Close does; the classic dispose once (mutants: the enhanced teardown keeps the staged goods; the classic counter with no dispose)', () => {
  withDom((dom) => {
    const host = dom.mk('div');
    dom.body.append(host);
    const gem = ruby(), bag = [gem];
    const view = mountEnhancedTrade(host, { ...tradeHooks('Sell', bag), gold: () => 100000 });
    const textOf = (n) => `${n.textContent ?? ''}${(n.children ?? []).map(textOf).join('')}`;
    host.querySelectorAll('.packtab').find((b) => b.textContent === PAGES[pageOf(gem)]).onclick();
    host.querySelectorAll('.itemrow').find((r) => textOf(r).includes('Ruby')).onclick({ timeStamp: 1000 });
    host.querySelectorAll('.act.primary').find((b) => b.textContent === 'Sell').onclick();
    assert.equal(bag.includes(gem), false, 'staged on the counter');
    view.unmount();
    assert.deepEqual(bag, [gem], 'the teardown put it back in the pack');
  });
  const gem = ruby(), bag = [gem];
  const w = new NativeTradeWindow(tradeHooks('Sell', bag));
  w.tab = pageOf(gem);
  w._pickLocal(w.localList().indexOf(gem));
  assert.equal(w.staged.includes(gem), true, 'staged at the classic counter');
  w.dispose();
  assert.deepEqual(bag, [gem], 'its dispose put it back');
  assert.equal(w.done, true);
  w.dispose();
  assert.deepEqual(bag, [gem], 'and a second dispose moves nothing');
});

test('AUDIT SS the enhanced counter quotes no sale it refuses: a bound piece picked at Sell or Sell Magic shows no price and no "how many" (the press still says why); a gem is quoted as ever (mutants: a refused sale quoted; a refused sale asked how many)', () => {
  const textOf = (n) => `${n.textContent ?? ''}${(n.children ?? []).map(textOf).join('')}`;
  for (const mode of ['Sell', 'SellMagic']) {
    withDom((dom) => {
      const host = dom.mk('div');
      dom.body.append(host);
      const stones = stack(5), gem = ruby(), bag = [stones, gem];
      const view = mountEnhancedTrade(host, { ...tradeHooks(mode, bag), gold: () => 100000 });
      try {
        const pick = (it, at) => {
          host.querySelectorAll('.packtab').find((b) => b.textContent === PAGES[pageOf(it)]).onclick();
          host.querySelectorAll('.itemrow').find((r) => textOf(r).includes(it.name)).onclick({ timeStamp: at });
        };
        pick(stones, 1000);
        assert.deepEqual(host.querySelectorAll('.trade-quote'), [], `${mode}: no price for a bound piece`);
        assert.deepEqual(host.querySelectorAll('.qtyfield'), [], `${mode}: and no "how many"`);
        pick(gem, 9000);
        assert.equal(host.querySelectorAll('.trade-quote').length, 1, `${mode}: a gem is quoted`);
      } finally { view.unmount(); }
    });
  }
});

test('AUDIT SS a split keeps its stack\'s binding and never its price - a stackable piece bound by its own mark splits into two bound halves, and the Broker\'s price stays with the one it was paid for (mutants: the split unbound)', () => {
  const arrows = { group: 'Weapons', templateIndex: 131, name: 'Arrow', value: 1, stackCount: 10, bound: true, stonesPaid: 4 };
  const list = [arrows];
  const half = splitStack(list, arrows, 4);
  assert.ok(half && half !== arrows);
  assert.equal(half.bound, true, 'the split half is bound');
  assert.equal(isBound(half), true);
  assert.equal(half.stonesPaid, undefined, 'and carries no price');
  assert.deepEqual(list.map((i) => i.stackCount), [6, 4]);
});

test('AUDIT SS nothing bound goes out on the wire: a building\'s container record is written without its bound pieces while the container keeps them (run); the dungeon\'s records (pinned at their line); the keyed shelf, the counter\'s art missing, sells no bound or locked piece; the dead quick-sell path refuses both; offline, leaving the court gathers its floor (pinned) (mutants: a building\'s record carries a bound piece; the keyed shelf lists a bound piece; the keyed sale takes one; quick sell unguarded; the offline court left ungathered)', () => {
  const gem = ruby(), stones = stack(3);
  const ctx = { containers: [{ items: [gem, stones] }], shelves: [] };
  const recs = interiorLootRecords(ctx, ['container:0']);
  assert.equal(recs.length, 1);
  assert.deepEqual(recs[0].r.map((i) => i.name), ['Ruby'], 'the record: the gem alone');
  assert.deepEqual(ctx.containers[0].items, [gem, stones], 'the container itself untouched');
  assert.match(read('src/scenes/dungeonContext.js'), /r: unbound\(held\)\.map\(\(it\) => \(\{ \.\.\.it \}\)\)/, 'the dungeon\'s records');
  const wm = read('src/scenes/worldModes.js');
  assert.match(wm, /shopBuysItem\(interiorBuilding\.buildingType, it\) && !isEquipped\(it\) && !isBound\(it\) && !lockRefuses\(it, 'sell'\)\);/, 'the keyed shelf lists neither');
  assert.match(wm, /function doSell\(shelf, it\) \{\n    if \(isBound\(it\) \|\| lockRefuses\(it, 'sell'\)\) return 0;/, 'and sells neither');
  assert.match(read('src/ui/enhancedTrade.js'), /const item = selected\.item;\n  if \(isBound\(item\) \|\| lockRefuses\(item, 'sell'\)\) return;/, 'the dead quick sell refuses both');
  assert.match(read('src/scenes/world.js'), /if \(!onlineOn && modes\?\.gateArenaDay\?\.\(\) != null\) \{ ejectFromCourt\(COURT_TEXT\.collapse\); gateCourt\?\.leave\(\);/, 'offline, the floor into the pack on the way out');
});

/** withDom for an async body (test/set7_broker.test.js's own): the fake document stands until the body settles. */
async function withDomAsync(fn) {
  const dom = fakeDom();
  const saved = { doc: globalThis.document, hadDoc: 'document' in globalThis, add: globalThis.addEventListener, rem: globalThis.removeEventListener, raf: globalThis.requestAnimationFrame };
  globalThis.document = dom.doc;
  globalThis.addEventListener = dom.win.addEventListener;
  globalThis.removeEventListener = dom.win.removeEventListener;
  globalThis.requestAnimationFrame = () => 0;
  try { return await fn(dom); } finally {
    if (saved.hadDoc) globalThis.document = saved.doc; else delete globalThis.document;
    globalThis.addEventListener = saved.add;
    globalThis.removeEventListener = saved.rem;
    globalThis.requestAnimationFrame = saved.raf;
  }
}

test('AUDIT SS the enhanced question at the keyboard and the mouse: it holds the focus on Keep and is modal; Y dismantles; N, Enter and a press on the dimmed screen keep; its document listeners are its own - asked twice in one breath, one pair stands, and none once it is answered; a piece locked while it is asked is refused in words at the press (mutants: Y not answered; the backdrop inside; the first question\'s listeners left behind; the question\'s listeners never removed; the press-time refusal silent)', async () => {
  _resetPrefsForTests();
  destroyEnhancedNotice();
  globalThis.location = { search: '?skin=enhanced' };
  await withDomAsync(async (dom) => {
    const docL = [];
    dom.doc.addEventListener = (t, fn) => docL.push({ t, fn });
    dom.doc.removeEventListener = (t, fn) => { const i = docL.findIndex((x) => x.t === t && x.fn === fn); if (i >= 0) docL.splice(i, 1); };
    const tick = () => new Promise((r) => setTimeout(r, 0));
    const textOf = (n) => `${n.textContent ?? ''}${(n.children ?? []).map(textOf).join('')}`;
    const host = dom.mk('div');
    dom.body.append(host);
    const a = ware(5), b = ware(5);
    const e = { name: 'Aelwyn', career: { name: 'Spellsword' }, stats: { strength: 50, endurance: 48 }, items: [a, stack(1)], goldPieces: 10 };
    const view = mountEnhancedInventory(host, { entity: e, items: () => e.items, onExit: () => {}, dropItem: () => {} });
    let t = 0;
    const press = (n) => n.onclick({ timeStamp: (t += 5000), detail: 1, stopPropagation() {} });
    const open = () => {
      for (const tab of host.querySelectorAll('.packtab')) {
        tab.onclick();
        const row = host.querySelectorAll('.itemrow').find((r) => textOf(r).includes(itemLongName(a)));
        if (row) { row.onclick({ timeStamp: (t += 5000), detail: 1 }); return; }
      }
      assert.fail('no row');
    };
    const dialog = () => dom.doc.querySelectorAll('.inv-dismantle')[0] ?? null;
    const ask = async () => {
      press(host.querySelectorAll('.act').find((x) => x.textContent === 'Dismantle'));
      const root = dialog();
      if (root) root.contains = (n) => { for (let p = n; p; p = p.parent) if (p === root) return true; return false; };
      return root;
    };
    const fire = (type, ev) => { for (const l of [...docL]) if (l.t === type) l.fn({ preventDefault() {}, stopPropagation() {}, ...ev }); };
    const asked = () => docL.filter((l) => l.t === 'keydown' || l.t === 'pointerdown').map((l) => l.t).sort();   // the pack's own pointerlockchange aside
    try {
      open();
      // asked twice in one breath: one question, one pair of listeners, and none after the answer
      await ask();
      await ask();
      assert.equal(dom.doc.querySelectorAll('.inv-dismantle').length, 1, 'one question');
      await tick();
      assert.deepEqual(asked(), ['keydown', 'pointerdown'], 'one pair of listeners, the standing question\'s');
      assert.equal(dialog().attrs['aria-modal'], 'true', 'modal');
      fire('keydown', { key: 'n', code: 'KeyN' });
      assert.equal(dialog(), null, 'N keeps');
      assert.deepEqual(asked(), [], 'and leaves no listener behind');
      assert.ok(e.items.includes(a));
      await ask(); await tick();
      fire('keydown', { key: 'Enter', code: 'Enter' });
      assert.equal(dialog(), null, 'Enter keeps - the default answer');
      const root = await ask(); await tick();
      const card = root.querySelectorAll('.card')[0];
      assert.ok(card, 'the question\'s card');
      fire('pointerdown', { target: card });
      assert.ok(dialog(), 'a press on the question itself does not close it');
      fire('pointerdown', { target: root });
      assert.equal(dialog(), null, 'a press on the dimmed screen keeps');
      assert.ok(e.items.includes(a));
      // locked while asked: the press says why
      await ask(); await tick();
      setLocked(a, true);
      press(dialog().querySelectorAll('.act').find((x) => x.textContent === 'Dismantle'));
      assert.equal(dialog(), null);
      assert.ok(e.items.includes(a), 'the ware stays');
      assert.ok(textOf(dom.body).includes(lockedText(itemLongName(a))), 'and the pack says why');
      setLocked(a, false);
      // Y dismantles
      open();
      await ask(); await tick();
      fire('keydown', { key: 'y', code: 'KeyY' });
      assert.equal(e.items.includes(a), false, 'Y dismantles');
      assert.deepEqual(asked(), [], 'no listener left');
      void b;
    } finally { view.unmount(); }
  });
});

test('AUDIT SS the Info box keeps the question\'s two laws: opened twice in one breath, one pair of document listeners stands and none once it is shut; a press on the dimmed screen shuts it, a press on its card does not (mutants: the Info box\'s first listeners left behind; its backdrop inside)', async () => {
  _resetPrefsForTests();
  destroyEnhancedNotice();
  globalThis.location = { search: '?skin=enhanced' };
  await withDomAsync(async (dom) => {
    const docL = [];
    dom.doc.addEventListener = (t, fn) => docL.push({ t, fn });
    dom.doc.removeEventListener = (t, fn) => { const i = docL.findIndex((x) => x.t === t && x.fn === fn); if (i >= 0) docL.splice(i, 1); };
    const asked = () => docL.filter((l) => l.t === 'keydown' || l.t === 'pointerdown').map((l) => l.t).sort();
    const fire = (type, ev) => { for (const l of [...docL]) if (l.t === type) l.fn({ preventDefault() {}, stopPropagation() {}, ...ev }); };
    const tick = () => new Promise((r) => setTimeout(r, 0));
    const textOf = (n) => `${n.textContent ?? ''}${(n.children ?? []).map(textOf).join('')}`;
    const host = dom.mk('div');
    dom.body.append(host);
    const e = { name: 'Aelwyn', career: { name: 'Spellsword' }, stats: { strength: 50, endurance: 48 }, items: [ruby()], goldPieces: 10 };
    const view = mountEnhancedInventory(host, { entity: e, items: () => e.items, onExit: () => {}, dropItem: () => {} });
    try {
      for (const tab of host.querySelectorAll('.packtab')) {
        tab.onclick();
        const row = host.querySelectorAll('.itemrow').find((r) => textOf(r).includes('Ruby'));
        if (row) { row.onclick({ timeStamp: 1000, detail: 1 }); break; }
      }
      const info = () => host.querySelectorAll('.act').find((x) => x.textContent === 'Info');
      info().onclick({ timeStamp: 6000, detail: 1 });
      info().onclick({ timeStamp: 11000, detail: 1 });
      const root = dom.doc.querySelectorAll('.inv-info')[0];
      assert.ok(root && dom.doc.querySelectorAll('.inv-info').length === 1, 'one box');
      root.contains = (n) => { for (let p = n; p; p = p.parent) if (p === root) return true; return false; };
      await tick();
      assert.deepEqual(asked(), ['keydown', 'pointerdown'], 'one pair of listeners');
      fire('pointerdown', { target: root.querySelectorAll('.card')[0] });
      assert.equal(dom.doc.querySelectorAll('.inv-info').length, 1, 'a press on its card keeps it');
      fire('pointerdown', { target: root });
      assert.equal(dom.doc.querySelectorAll('.inv-info').length, 0, 'a press on the dimmed screen shuts it');
      assert.deepEqual(asked(), [], 'and no listener is left behind');
    } finally { view.unmount(); }
  });
});
