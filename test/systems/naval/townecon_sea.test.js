// SEA-TRADE (2026-10-18, Mac: "Ensure the sea trade routes plug into this system also"; bible/06-Systems/Town-Economy-Arc.md
// section 8) - THE SEA'S TRADE IN THE TOWN ECONOMY: a port town's sea lanes in its Prosperity, its exchange priced by its
// town's economy (the pay never above the ask), a good bought there carrying what it cost and the counter's mark (no
// patron takes it; no shop buys it, B2's), and every dealing told to the players' share. tools/mutants/townecon4.json.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  TOWN_SEA_LANE, TOWN_SEA_LANES_MAX, TOWN_SEA_REACH_PX, TOWN_SEA_TICK_S, townSeaTerm, townProsperity, townExchangeFactors, townBuyFactor, townSaleFactor,
  townReasonLine, TOWN_REASONS, townKeyOf, townDayOf, townTipOf, townBandOf,
} from '../../../src/net/townEconLaw.js';
import { exchangeOf, GOODS, TRADE_MOST, mintGood } from '../../../src/systems/naval/tradeGoods.js';
import { createCaptainLedger } from '../../../src/systems/naval/captainLedger.js';
import { createHarbourOffice } from '../../../src/scenes/harbourOffice.js';
import { exchangeText } from '../../../src/ui/naval/navalYardWindow.js';
import { tradeCost, getTradePrice } from '../../../src/systems/tradeModes.js';
import { shopBuysItem } from '../../../src/systems/shopStock.js';
import { COUNTER_PAID_MARK, PATRON_COUNTER_MARK, patronTakes } from '../../../src/net/patronLaw.js';
import { createTownEconHost } from '../../../src/scenes/townEconHost.js';
import { mintWatchReceipt } from '../../../src/net/watchReceipt.js';
import { hostText } from '../../hostText.mjs';   // HOST-SPLIT 2: the world host whole

const rd = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const WAYREST = { key: '100,100', name: 'Wayrest', px: 100, py: 100, region: 23, crown: 'Wayrest' };
const SENTINEL = { key: '120,100', name: 'Sentinel', px: 120, py: 100, region: 20, crown: 'Sentinel' };
const ISLE = { key: 'e:1', name: 'Driftholm', ether: true };
const PS = Array.from({ length: 101 }, (_, i) => i);
/** The trade window's sale walks run online (tradeModes.js reads the page's own flag). */
const online = (fn) => { const was = globalThis.location; globalThis.location = { search: '?online=1' }; try { return fn(); } finally { globalThis.location = was; } };
const BEST = Object.freeze({ mercantile: 100, personality: 100 });

test('SEA-TRADE the law: a port town\'s lanes each TOWN_SEA_LANE, TOWN_SEA_LANES_MAX of them at most, a whole number or nothing; its Prosperity carries them, and its card says its harbour when nothing nearer does; the exchange\'s factors the town\'s asking and paying factors, the pay never above the ask (mutants: TOWNECON4-lane-term, TOWNECON4-lanes-max, TOWNECON4-lanes-unread, TOWNECON4-harbour-first, TOWNECON4-factors-swapped)', () => {
  assert.deepEqual([TOWN_SEA_LANE, TOWN_SEA_LANES_MAX, TOWN_SEA_REACH_PX, TOWN_SEA_TICK_S], [2, 3, 1, 600]);
  assert.deepEqual([0, 1, 2, 3, 4, 9].map(townSeaTerm), [0, 2, 4, 6, 6, 6]);
  for (const bad of [-1, 1.5, NaN, Infinity, '2', null, undefined]) assert.equal(townSeaTerm(bad), 0, String(bad));
  const key = townKeyOf(212, 151), day = townDayOf(1_800_000_000_000);
  for (const type of [0, 1, 2]) {
    const bare = townProsperity({ key, type, day });
    assert.equal(townProsperity({ key, type, day, lanes: 0 }), bare);
    for (const lanes of [1, 2, 3, 5]) assert.equal(townProsperity({ key, type, day, lanes }), Math.min(100, bare + townSeaTerm(lanes)), `${type}/${lanes}`);
  }
  assert.equal(townReasonLine({ lanes: 2 }), TOWN_REASONS.harbour);
  assert.equal(townReasonLine({ lanes: 0 }), null);
  assert.equal(townReasonLine({ lanes: 2, players: 3 }), TOWN_REASONS.players, 'the players\' share nearer');
  assert.equal(townReasonLine({ lanes: 2, raided: true }), TOWN_REASONS.raid);
  assert.equal(TOWN_REASONS.harbour, 'Its harbor brings trade.');   // PIN MOVED (VOICE2): American spelling (Voice.md rule 8)
  assert.ok(townTipOf({ name: 'Wayrest', p: 60, prev: 60, area: null, lanes: 1 }).lines.includes(TOWN_REASONS.harbour));
  for (const p of PS) {
    const f = townExchangeFactors(p);
    assert.deepEqual({ ...f }, { ask: townBuyFactor(p), pay: townSaleFactor(p) }, String(p));
    assert.ok(Object.isFrozen(f));
    assert.ok(f.pay <= f.ask + 1e-12 || p < 50, `${p}: a Booming town pays no more than it asks`);
  }
});

test('SEA-TRADE the exchange by its town: no town (offline, an isle) its prices exactly as they were; a town\'s factors on what it sells and pays - a Booming port\'s goods cheaper, a Destitute port\'s dearer, a Steady port\'s as they were; over every Prosperity, port, good, day and the captain\'s every edge it still buys under what it sells, and buying and selling back at one port never pays; a factor not a number reads 1 and a pay above the ask is held to it (mutants: TOWNECON4-ask-unread, TOWNECON4-pay-unread, TOWNECON4-pay-unheld, TOWNECON4-bad-factor)', () => {
  for (const port of [WAYREST, SENTINEL, ISLE]) for (const day of [0, 7, 400]) {
    assert.deepEqual(exchangeOf(port, day, {}, 0, null), exchangeOf(port, day), 'none: as they were');
    assert.deepEqual(exchangeOf(port, day, {}, 0, townExchangeFactors(50)), exchangeOf(port, day), 'a Steady port as it was');
    for (const bad of [{ ask: NaN, pay: NaN }, { ask: 0, pay: -1 }, { ask: '0.8', pay: undefined }, {}]) assert.deepEqual(exchangeOf(port, day, {}, 0, /** @type {any} */ (bad)), exchangeOf(port, day), JSON.stringify(bad));
    for (const p of [0, 13, 37, 50, 64, 85, 100]) for (const edge of [0, 0.3, TRADE_MOST, 2]) {
      const rows = exchangeOf(port, day, {}, edge, townExchangeFactors(p));
      for (const r of rows) {
        assert.ok(r.sell >= 2 && r.buy >= 1 && r.buy < r.sell, `${port.name} ${r.id} p${p} e${edge}: ${r.buy} < ${r.sell}`);
      }
    }
  }
  const at = (p) => Object.fromEntries(exchangeOf(WAYREST, 3, {}, 0, townExchangeFactors(p)).map((r) => [r.id, r]));
  const boom = at(100), steady = at(50), poor = at(0);
  for (const g of GOODS) {
    assert.ok(boom[g.id].sell <= steady[g.id].sell && steady[g.id].sell <= poor[g.id].sell, `${g.id}: ${boom[g.id].sell} ${steady[g.id].sell} ${poor[g.id].sell}`);
    assert.ok(poor[g.id].buy <= steady[g.id].buy && boom[g.id].buy <= steady[g.id].buy, `${g.id}: the Steady port pays the most`);
  }
  assert.ok(GOODS.some((g) => boom[g.id].sell < steady[g.id].sell) && GOODS.some((g) => poor[g.id].sell > steady[g.id].sell), 'the town moves its prices');
  assert.ok(GOODS.some((g) => poor[g.id].buy < steady[g.id].buy) && GOODS.some((g) => boom[g.id].buy < steady[g.id].buy), 'and what it pays');
  // a pay above the ask held to it
  const odd = exchangeOf(SENTINEL, 3, {}, 0, { ask: 0.8, pay: 0.95 });
  const held = exchangeOf(SENTINEL, 3, {}, 0, { ask: 0.8, pay: 0.8 });
  assert.deepEqual(odd, held);
});

test('SEA-TRADE no loop out of the exchange: no shop buys its goods (AUDIT CAPTAIN\'S SEA B2), and online a good bought there carries what it cost (LAW-3) and the counter\'s mark - so no patron takes it (AUDIT LW-II-2 S1), and were a counter ever to buy one it would pay no more than the exchange was paid, over every shop quality at the dearest region, the best haggler (unmarked, the same walk paid); offline it carries nothing (mutants: TOWNECON4-good-unmarked)', () => {
  const office = (gold = 1e6) => {
    let purse = gold;
    const hold = [];
    const o = createHarbourOffice({ ledger: createCaptainLedger(), now: () => 0, day: () => 3, level: () => 5, gold: () => purse, pay: (n) => { purse -= n; }, credit: (n) => { purse += n; },
      say: () => {}, mid: () => {}, notorietyOf: () => 0, port: () => WAYREST, ports: () => [WAYREST, SENTINEL], seaAt: () => true, waters: () => 'Wayrest', stow: (h, it) => h.push(it) });
    return { o, hold };
  };
  online(() => {
    const paid = [], unmarked = [];
    for (const g of GOODS.filter((x) => !x.ether)) {
      const { o, hold } = office();
      const x = o.exchange({ uid: 1, cargo: hold });
      const row = x.rows.find((r) => r.id === g.id);
      if (!(row.sells > 0)) continue;
      assert.equal(x.buy(g.id, 1).ok, true, g.id);
      const it = hold.at(-1);
      for (const shop of [0, 1, 2, 3, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]) assert.equal(shopBuysItem(shop, it), false, `${g.id}: no shop buys it (${shop})`);
      assert.equal(it[COUNTER_PAID_MARK], row.sell, `${g.id}: what it cost`);
      assert.equal(it[PATRON_COUNTER_MARK], true);
      assert.equal(patronTakes(it), false, 'no patron\'s');
      for (let q = 1; q <= 20; q++) {
        const sl = tradeCost('Sell', [it], { quality: q, priceAdjustment: 2500 });
        const sell = getTradePrice('Sell', sl.cost, q, BEST, sl.pieces, sl.resale);
        if (sell > row.sell) paid.push(`${g.id} q${q}: ${row.sell} -> ${sell}`);
        const bare = { ...it };
        delete bare[COUNTER_PAID_MARK];
        const bl = tradeCost('Sell', [bare], { quality: q, priceAdjustment: 2500 });
        if (getTradePrice('Sell', bl.cost, q, BEST, bl.pieces, bl.resale) > row.sell) unmarked.push(g.id);
      }
    }
    assert.deepEqual(paid, []);
    assert.ok(unmarked.length > 0, 'the hole: unmarked, a shop paid more than the exchange asked');
  });
  const { o, hold } = office();
  o.exchange({ uid: 1, cargo: hold }).buy('wine', 2);
  assert.equal(hold[0][COUNTER_PAID_MARK], undefined, 'offline: nothing');
  assert.equal(hold[0][PATRON_COUNTER_MARK], undefined);
  assert.deepEqual(Object.keys(hold[0]).sort(), Object.keys(mintGood('wine', 2)).sort());
});

test('SEA-TRADE the harbour office: online its exchange priced by the port town\'s factors and said with its band, each dealing told to the town economy once - a refusal never; no town economy, the exchange as it was; the world host hands it the town economy (mutants: TOWNECON4-office-unpriced, TOWNECON4-deal-untold, TOWNECON4-refusal-told, TOWNECON4-office-unwired)', () => {
  const told = [];
  const town = { exchangeAt: (port) => (port === WAYREST ? townExchangeFactors(95) : null), bandAt: (port) => (port === WAYREST ? 'Booming' : null), seaDeal: (port) => { told.push(port.key); return true; } };
  let purse = 10_000;
  const deps = (t) => ({ ledger: createCaptainLedger(), now: () => 0, day: () => 3, level: () => 5, gold: () => purse, pay: (n) => { purse -= n; }, credit: (n) => { purse += n; },
    say: () => {}, mid: () => {}, notorietyOf: () => 0, port: () => WAYREST, ports: () => [WAYREST, SENTINEL], seaAt: () => true, waters: () => 'Wayrest', stow: (h, it) => h.push(it), ...(t ? { town: t } : {}) });
  const o = createHarbourOffice(deps(town));
  const hold = [];
  const x = o.exchange({ uid: 1, cargo: hold });
  assert.deepEqual(x.rows.map(({ have, ...r }) => r), exchangeOf(WAYREST, 3, {}, 0, townExchangeFactors(95)));
  assert.equal(x.band, 'Booming');
  assert.match(exchangeText(x).lede, / Port economy: Booming\. Exchange prices follow it\.$/);   // PIN MOVED (VOICE2, in PLAIN-SWEEP's words): no dash aside (Voice.md rule 5)
  assert.equal(x.buy('wine', 3).ok, true);
  assert.deepEqual(told, ['100,100']);
  assert.equal(x.sell('wine', 1).ok, true);
  assert.deepEqual(told, ['100,100', '100,100']);
  assert.equal(x.sell('silk', 1).ok, false, 'carries none');
  const before = told.length;
  purse = 0;
  assert.equal(o.exchange({ uid: 1, cargo: hold }).buy('wine', 1).ok, false, 'no gold');
  assert.equal(told.length, before, 'a refusal is no dealing');
  // no town economy: as it was, and no band said
  const bare = createHarbourOffice(deps(null)).exchange({ uid: 1, cargo: [] });
  assert.deepEqual(bare.rows.map(({ have, ...r }) => r), exchangeOf(WAYREST, 3));
  assert.equal(bare.band, null);
  assert.doesNotMatch(exchangeText(bare).lede, /Port economy/);
  assert.match(hostText('src/scenes/world.js'), /etherGoods: \(\) => etherOut, town: townEcon,/);
  assert.match(rd('src/scenes/harbourOffice.js'), /markCounterBought\(\[goods\], \{ price: k \* r\.sell \}\);[^\n]*\n\s*deps\.stow\?\.\(hold, goods\);/);
});

test('SEA-TRADE the host module: a port town\'s lanes counted off the map\'s lane network once it stands (each lane at its two ports) and read into its Prosperity and card; the lanes asked again while they do not stand (BOOT-TDZ II); a port\'s exchange factors and band its town\'s, none past the Veil or where no town stands; a dealing told to the book at the port\'s pixel; the world host hands it the MAPS location and the lanes (mutants: TOWNECON4-host-lanes-once, TOWNECON4-host-lanes-cached-empty, TOWNECON4-host-ether, TOWNECON4-host-deal-unbooked)', async () => {
  const towns = new Map([[11, { name: 'Wayrest', px: 100, py: 100, region: 23, type: 0, location: 5 }], [12, { name: 'Inland', px: 50, py: 50, region: 23, type: 1, location: 6 }]]);
  const locAt = (x, y) => { for (const [id, t] of towns) if (t.px === x && t.py === y) return { mapId: id, locationType: t.type }; return null; };
  let lanes = null, asked = 0;
  const portLanes = () => { asked += 1; if (lanes === 'throw') throw new ReferenceError('TDZ'); return lanes; };
  const door = { econ: async () => ({ ok: true, data: { towns: [] } }), witness: async () => ({ ok: true, data: {} }), watch: async () => ({ ok: true, data: {} }), me: () => 'acct-me' };
  const host = createTownEconHost({ online: () => true, townOf: (id) => towns.get(id), seatAt: () => null, seats: () => [], raidedAt: () => false, nowMs: () => 1_800_000_000_000,
    locAt, portLanes, door, storage: null });
  const key = townKeyOf(100, 100), day = townDayOf(1_800_000_000_000);
  lanes = 'throw';
  assert.equal(host.prosperityOf(11), townProsperity({ key, type: 0, day }), 'the lanes not yet standing: none');
  lanes = null;
  assert.equal(host.prosperityOf(11), townProsperity({ key, type: 0, day }));
  lanes = [{ a: { px: 100, py: 100 }, b: { px: 120, py: 100 } }, { a: { px: 90, py: 100 }, b: { px: 100, py: 100 } }, { a: { px: 90, py: 100 }, b: { px: 120, py: 100 } }];
  const n = asked;
  assert.equal(host.prosperityOf(11), townProsperity({ key, type: 0, day, lanes: 2 }), 'two lanes');
  host.prosperityOf(11); host.prosperityOf(12);
  assert.equal(asked, n + 1, 'counted once they stand');
  assert.equal(host.prosperityOf(12), townProsperity({ key: townKeyOf(50, 50), type: 1, day }), 'no port, no lanes');
  assert.ok(host.tipAt(11).lines.includes(TOWN_REASONS.harbour));
  const port = { key: '100,100', name: 'Wayrest', px: 100, py: 100 };
  assert.deepEqual(host.exchangeAt(port), townExchangeFactors(host.prosperityOf(11)));
  assert.equal(host.bandAt(port), townBandOf(host.prosperityOf(11)));
  assert.equal(host.exchangeAt({ ...port, ether: true }), null, 'past the Veil');
  assert.equal(host.bandAt(ISLE), null);
  assert.equal(host.exchangeAt({ key: '7,7', px: 7, py: 7 }), null, 'no town there');
  assert.equal(host.exchangeAt(null), null);
  assert.equal(host.seaDeal({ key: '7,7', px: 7, py: 7 }), false, 'no town, no dealing');
  assert.equal(host.seaDeal(port), false, 'no tick seen');
  const { privateKey } = await globalThis.crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const tick = await mintWatchReceipt({ s: 'acct-me', x: 101, y: 100, c: 1 }, privateKey, { subtle: globalThis.crypto.subtle, nowS: 1_800_000_000 - 30 });
  assert.equal(host.keepWatch(tick), false, 'beside the town: no footstep');
  assert.equal(host.seaDeal(port), true, 'the quay\'s tick vouches the dealing at the port\'s pixel');
  // offline: no book, the exchange as it was
  const off = createTownEconHost({ online: () => false, townOf: (id) => towns.get(id), seatAt: () => null, seats: () => [], raidedAt: () => false, nowMs: () => 1_800_000_000_000, locAt, portLanes, storage: null });
  assert.equal(off.exchangeAt(port), null);
  assert.equal(off.bandAt(port), null);
  assert.equal(off.seaDeal(port), false);
  const w = hostText('src/scenes/world.js');
  assert.match(w, /locAt: \(x, y\) => locationIndex\.get\(`\$\{x\},\$\{y\}`\)\?\.mapTableData \?\? null, portLanes: \(\) => \(_lanesReady && mapDict \? laneNet\(\) : null\) \}\);/);
  assert.match(rd('src/scenes/townEconHost.js'), /seaDeal: \(port\) => \(book && portTown\(port\) != null \? book\.seaDeal\(port\.px, port\.py\) : false\),/);
});
