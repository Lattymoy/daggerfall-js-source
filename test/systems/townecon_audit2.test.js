// AUDIT TOWN-ECON 2 (2026-10-18, Mac: "Lets audit everything and ensure perfection"; bible/01-Overview/audits/
// Audit-Town-Econ-2.md) - THE PRICE LANE'S FIXES: LAW-3's share by the purchase's own asks (PRICE-1), never a 0 where the
// lot paid a gold a piece (PRICE-5), an improvement the player's own (PRICE-6); a counter's piece never laundered through
// the Stores (PRICE-2: kept out of every put-in but a station's own) nor through a socket (its mark kept on the socket and
// given back with the stone). tools/mutants/townecon5.json.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setPref, _resetForTests } from '../../src/systems/uiPrefs.js';
import * as LR from '../../src/systems/loot/lootRarity.js';
import * as G from '../../src/systems/gems.js';
import * as RF from '../../src/systems/reforge.js';
import { createWeapon } from '../../src/combat/enemyEquipment.js';
import { mintCondition } from '../../src/systems/item/itemTemplates.js';
import { lawfulItem, itemFindings } from '../../src/systems/item/itemLaw.js';
import { markCounterBought, buyItemPrice, tradeCost, getTradePrice, counterValueOf } from '../../src/systems/tradeModes.js';
import { HOLIDAYS } from '../../src/systems/holidays.js';
import { COUNTER_PAID_MARK, COUNTER_VALUE_MARK, PATRON_COUNTER_MARK } from '../../src/net/patronLaw.js';
import { addItem, splitStack } from '../../src/systems/inventory.js';
import { heldOf, takeCarried, counterPiece } from '../../src/systems/materialsBag.js';
import { createProfBook } from '../../src/net/profBook.js';
import { hostText } from '../hostText.mjs';

const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const online = (fn) => { const was = globalThis.location; globalThis.location = { search: '?online=1' }; try { return fn(); } finally { globalThis.location = was; } };
const BEST = Object.freeze({ mercantile: 100, personality: 100 });
const seeded = (n) => { let x = n >>> 0; return () => ((x = (Math.imul(x, 1664525) + 1013904223) >>> 0) / 4294967296); };
const cuirass = () => mintCondition({ group: 'Armor', templateIndex: 102, material: 0x0209, name: 'Cuirass', flags: 0 });
const sellOf = (it, q, adj = 2500) => { const l = tradeCost('Sell', [it], { quality: q, priceAdjustment: adj }); return getTradePrice('Sell', l.cost, q, BEST, l.pieces, l.resale); };

test('AUDIT TOWN-ECON 2 PRICE-1: LAW-3 SHARES A LOT BY THE PURCHASE\'S OWN ASKS - on Warriors Festival a weapon is halved and the armour beside it is not, so the katana is marked with its halved share and the cuirass with its full one; sold at the dearest counter the kept cuirass never fetches more than it cost (by the no-holiday asks it was held under what it cost and the katana over); the window\'s commit hands the holiday and the guild (mutants: TOWNECON-AUDIT2-PRICE1-asks-plain, TOWNECON-AUDIT2-PRICE1-commit-unpassed)', () => {
  online(() => {
    const ctx = { holidayId: HOLIDAYS.Warriors_Festival, guildFactionId: null };
    const lot = () => [createWeapon(123, 9, seeded(4)), cuirass()];
    const [k, c] = lot();
    const asks = [buyItemPrice(k, { quality: 10, online: true, ...ctx }), buyItemPrice(c, { quality: 10, online: true, ...ctx })];
    assert.ok(asks[0] < buyItemPrice(k, { quality: 10, online: true }), 'the festival halves the weapon');
    const priced = tradeCost('Buy', [k, c], { quality: 10, priceAdjustment: 1000, ...ctx });
    const price = getTradePrice('Buy', priced.cost, 10, BEST, priced.pieces);
    markCounterBought([k, c], { price, ...ctx });
    const rest = price - 2;
    assert.deepEqual([k[COUNTER_PAID_MARK], c[COUNTER_PAID_MARK]], asks.map((a) => 1 + Math.floor((rest * a) / (asks[0] + asks[1]))));
    // the cuirass bought alone that festival day cost its own ask's price - kept, it sells for no more than that
    const alone = tradeCost('Buy', [cuirass()], { quality: 10, priceAdjustment: 1000, ...ctx });
    const alonePrice = getTradePrice('Buy', alone.cost, 10, BEST, alone.pieces);
    for (let q = 1; q <= 20; q++) assert.ok(sellOf(c, q) <= Math.max(c[COUNTER_PAID_MARK], alonePrice), `q${q}`);
    const [k0, c0] = lot();
    markCounterBought([k0, c0], { price });   // the old split: no holiday
    assert.ok(c0[COUNTER_PAID_MARK] < c[COUNTER_PAID_MARK] && k0[COUNTER_PAID_MARK] > k[COUNTER_PAID_MARK], 'the no-holiday asks held the cuirass to less and the katana to more');
  });
  const wm = rd('src/scenes/worldModes.js');
  assert.match(wm, /commit: \(m, staged, price, proceeds\) => commitTrade\(shelf, m, staged, price, proceeds, identifySpell, \{ holidayId: getHolidayId\(Math\.floor\(skyMinutes\(\)\), b\.regionIndex \?\? 0\), guildFactionId \}\),/);
  assert.match(wm, /const r = commitTrade\(shelf, m, staged, price, proceeds, identifySpell, \{ holidayId: getHolidayId\(Math\.floor\(skyMinutes\(\)\), b\.regionIndex \?\? 0\), guildFactionId \}\);/);
});

test('AUDIT TOWN-ECON 2 PRICE-5 and PRICE-6: a lot that paid a gold a piece marks every piece with one at least (forty arrows bought beside a dai-katana at a quality-1 counter had floored to 0, and sold for 0 ever after - and a found stack merged in with them); each piece marked with the value it was bought at, so an improvement since sells as the player\'s own work while the part bought stays capped; the item law, a merge (the lower) and a split keep it (mutants: TOWNECON-AUDIT2-PRICE5-floor-zero, TOWNECON-AUDIT2-PRICE6-value-unmarked, TOWNECON-AUDIT2-PRICE6-improvement-capped, TOWNECON-AUDIT2-PRICE6-merge-lost, TOWNECON-AUDIT2-PRICE6-split-lost)', () => {
  online(() => {
    const arrows = Object.assign(createWeapon(131, 0, seeded(2)), { stackCount: 40 });
    const blade = createWeapon(123, 9, seeded(4));
    const lot = tradeCost('Buy', [arrows, blade], { quality: 1, priceAdjustment: 500 });
    const price = getTradePrice('Buy', lot.cost, 1, BEST, lot.pieces);
    assert.ok(price >= 41, 'a gold a piece and more');
    markCounterBought([arrows, blade], { price });
    assert.ok(arrows[COUNTER_PAID_MARK] >= 1, `${arrows[COUNTER_PAID_MARK]}`);
    assert.ok(arrows[COUNTER_PAID_MARK] * 40 + blade[COUNTER_PAID_MARK] <= price, 'never more than the lot');
    // under a gold a piece: the floors stand
    const cheap = Object.assign(createWeapon(131, 0, seeded(2)), { stackCount: 40 });
    markCounterBought([cheap], { price: 20 });
    assert.equal(cheap[COUNTER_PAID_MARK], 0);
    // PRICE-6: the value it was bought at
    const sword = createWeapon(113, 1, seeded(9));
    markCounterBought([sword], { price: 4 });
    assert.equal(sword[COUNTER_VALUE_MARK], Math.round(counterValueOf(sword)));
    const capped = sellOf(sword, 20);
    assert.ok(capped <= 4);
    const improved = { ...sword, value: counterValueOf(sword) + 500 };
    const found = { ...improved };
    delete found[PATRON_COUNTER_MARK]; delete found[COUNTER_PAID_MARK]; delete found[COUNTER_VALUE_MARK];
    const sale = sellOf(improved, 20);
    assert.ok(sale > 4 + 0.9 * (sellOf(found, 20) - sellOf({ ...found, value: counterValueOf(sword) }, 20)), `${sale}: the improvement the player's own`);
    assert.ok(sale <= sellOf(found, 20), 'never more than uncapped');
    // the law, a merge, a split
    assert.equal(lawfulItem(sword), true);
    assert.equal(lawfulItem({ ...sword, [COUNTER_VALUE_MARK]: -1 }), false);
    const a = Object.assign(createWeapon(131, 0, seeded(2)), { stackCount: 2 }), b = Object.assign(createWeapon(131, 0, seeded(2)), { stackCount: 3 });
    markCounterBought([a], { price: 20 }); markCounterBought([b], { price: 30 });
    b[COUNTER_VALUE_MARK] = a[COUNTER_VALUE_MARK] - 1;
    const pack = [a];
    addItem(pack, b);
    assert.equal(a[COUNTER_VALUE_MARK], b[COUNTER_VALUE_MARK], 'the lower of two');
    const half = splitStack(pack, a, 2);
    assert.equal(half[COUNTER_VALUE_MARK], a[COUNTER_VALUE_MARK], 'a split keeps it');
  });
});

test('AUDIT TOWN-ECON 2 PRICE-2: A COUNTER\'S PIECE IS NO SERVICE UNIT - the bag\'s hands count the service\'s units without it and take it last, and only for a station\'s own put-in; the Stores page, a writ and the market never put it in, so no withdrawal hands it back unmarked; a station\'s shortfall still works it from the pack (mutants: TOWNECON-AUDIT2-PRICE2-held-counted, TOWNECON-AUDIT2-PRICE2-taken-first, TOWNECON-AUDIT2-PRICE2-page-takes, TOWNECON-AUDIT2-PRICE2-station-refused, TOWNECON-AUDIT2-PRICE2-world-unwired)', async () => {
  const diamond = (n, marked) => Object.assign(G.mintGem('diamond'), { stackCount: n }, marked ? { [PATRON_COUNTER_MARK]: true, [COUNTER_PAID_MARK]: 205 } : {});
  const key = 'gem:diamond';
  const e = { items: [diamond(3, false), diamond(5, true)], bagItems: [], wagonItems: [] };
  assert.equal(counterPiece(e.items[1]), true);
  assert.deepEqual([heldOf(e, key), heldOf(e, key, { counter: false })], [8, 3], 'the service\'s units without the counter\'s');
  const page = takeCarried(e, key, 5, null, 'all');
  assert.equal(page.taken, 3, 'a page\'s put-in never takes the counter\'s');
  page.back();
  assert.deepEqual(e.items.map((it) => [counterPiece(it), it.stackCount]), [[true, 8]], 'given back, the stack joined - the counter\'s mark the whole stack\'s (AUDIT LW-II-2 S1\'s merge)');
  e.items = [diamond(3, false), diamond(5, true)];
  const station = takeCarried(e, key, 5, null, 'work', { counter: true });
  assert.equal(station.taken, 5);
  assert.deepEqual(e.items.map((it) => [counterPiece(it), it.stackCount]), [[true, 3]], 'the unmarked first, then the counter\'s');
  station.back();
  // the book: a page's put-in holds the count to the service's units, a station's shortfall works the counter's too
  const sent = [];
  const hands = {
    held: (k) => heldOf(e, k, { counter: false }), heldAll: (k) => heldOf(e, k), room: () => 999, mint: () => ({ bag: 0, pack: 0, left: 0 }),
    take: (k, n, id, order, counter) => takeCarried(e, k, n, id, order, { counter }),
  };
  const door = {
    account: () => 'acct-1',
    state: async () => ({ ok: true, data: { stores: [{ material: key, own: 0, bought: 0 }], carried: [{ material: key, own: 3, bought: 0 }] } }),
    deposit: async (character, material, qty, held, order) => { sent.push({ qty, held, order }); return { ok: true, data: { material, qty, own: qty, bought: 0, gold: 0, store: { own: qty, bought: 0 }, carried: { own: 0, bought: 0 } } }; },
  };
  const book = createProfBook({ door, storage: null, character: () => 'c1', carry: hands });
  book.hear?.({ stores: [], carried: [{ material: key, own: 3, bought: 0 }] });
  assert.equal(book.carriedWorkable(key), 8, 'a station works all eight');
  assert.equal(book.walled(key) >= 5, true, 'the counter\'s five walled from a writ');
  const r = await book.deposit(key, 4, { order: 'all' });
  assert.equal(r.ok, false, 'a page\'s four: only three are the service\'s');
  assert.equal(r.error, 'carried-short');
  assert.equal(heldOf(e, key), 8, 'given back');
  const w = hostText('src/scenes/world.js');
  assert.match(w, /held: \(key\) => bagHeldOf\(playerEntity, key, \{ counter: false \}\), heldAll: \(key\) => bagHeldOf\(playerEntity, key\),/);
  assert.match(w, /take: \(key, n, stamp = null, order = null, counter = false\) => \{\n\s*const t = takeCarried\(playerEntity, key, n, stamp, order, \{ counter \}\);/);
  assert.match(w, /carriedHeld: \(k\) => bagHeldOf\(playerEntity, k, \{ counter: false \}\),/);
  // PIN MOVED (FB1020c ONE-SAVE): a station's shortfalls are one batch now - each put-in planned with the same order and counter
  assert.match(rd('src/net/profBook.js'), /plan\.push\(\{ material: k, qty: Math\.min\(left, DEPOSIT_MAX\), order: work === true \? 'work' : 'spend', counter: work === true \}\);/);
});

test('AUDIT TOWN-ECON 2 PRICE-2: A STONE A COUNTER SOLD KEEPS ITS MARK IN THE SOCKET - set, the socket remembers what it cost; its share of the piece\'s sale is held to that; extracted, it comes out marked as it went in; shattered, the mark goes with it; a found stone none; the item law takes the sockets\' marks (mutants: TOWNECON-AUDIT2-PRICE2-socket-unmarked, TOWNECON-AUDIT2-PRICE2-extract-unmarked, TOWNECON-AUDIT2-PRICE2-socket-sale-uncapped, TOWNECON-AUDIT2-PRICE2-unset-kept)', () => {
  _resetForTests(); setPref('lootRarity', true); LR._setSocketForTests(null);
  try {
    online(() => {
      const blade = () => Object.assign(createWeapon(122, 1), { isIdentified: true, sockets: [LR.SOCKET_EMPTY, LR.SOCKET_EMPTY] });
      const player = (items) => ({ isPlayer: true, items, goldPieces: 10_000, stats: { strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 }, skills: new Array(35).fill(30), level: 5, career: {}, activeEffects: [], health: 100, maxHealth: 100 });
      const bought = Object.assign(G.mintGem('diamond'), { [PATRON_COUNTER_MARK]: true, [COUNTER_PAID_MARK]: 205 });
      const w = blade();
      const me = player([w, bought, G.mintGem('ruby')]);
      assert.equal(RF.setGemPiece(w, 'diamond', me, 0).ok, true);
      assert.deepEqual(w.socketBought, [[0, 205]]);
      assert.equal(RF.setGemPiece(w, 'ruby', me, 1).ok, true);
      assert.deepEqual(w.socketBought, [[0, 205]], 'a found stone none');
      const plainOf = (it) => { const p = { ...it }; delete p.socketBought; return p; };
      assert.deepEqual(itemFindings(w), itemFindings(plainOf(w)), 'the law takes it');
      assert.ok(itemFindings({ ...w, socketBought: [[0, -1]] }).length > itemFindings(plainOf(w)).length, 'a bad mark is a finding');
      // the sale: the diamond's share held to 205, the rest as found
      const bare = { ...w };
      delete bare.socketBought;
      const capped = sellOf(w, 20), free = sellOf(bare, 20);
      assert.ok(capped < free, `${capped} < ${free}: the stone's share held to what it cost`);
      // extracted: marked as it went in
      assert.equal(RF.extractGemPiece(w, me, 0).ok, true);
      const out = me.items.find((it) => it.group === 'Gems' && LR.gemKindOf?.(it) !== undefined && it[PATRON_COUNTER_MARK] === true);
      assert.ok(out, 'the stone out marked');
      assert.deepEqual([out[COUNTER_PAID_MARK], out[COUNTER_VALUE_MARK] > 0], [205, true]);
      assert.equal(w.socketBought, undefined, 'the socket\'s mark gone with it');
      // shattered: the mark with it
      const v = blade();
      const you = player([v, Object.assign(G.mintGem('diamond'), { [PATRON_COUNTER_MARK]: true })]);
      RF.setGemPiece(v, 'diamond', you, 1);
      assert.deepEqual(v.socketBought, [[1, null]], 'a stone marked before LAW-3: its mark, no price');
      assert.equal(RF.unsetGemPiece(v, you, 1).ok, true);
      assert.equal(v.socketBought, undefined);
    });
  } finally { _resetForTests(); setPref('lootRarity', false); LR._setSocketForTests(null); }
});
