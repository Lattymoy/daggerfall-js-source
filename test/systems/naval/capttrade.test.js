// CAPT-TRADE, CAPT-CHARTS (2026-10-11, the owner: "giving a reason to players to experience it" - and of the Eltheric Ocean,
// "exotic resources"; bible/03-World/Captains-Sea.md) - THE EXCHANGE AND THE TREASURE CHARTS: the Bay's goods made cheap
// where they are made and sold dear where they are wanted, the Eltheric Ocean's wanted everywhere, a day's prices the same
// for every client, a port's day's dealing; the goods as items in a ship's hold; a chart among a pirate's papers, read
// and marked, its cache raised and paid; the exchange's tab. tools/mutants/capttrade.json.
import '../../modsOff.js';
import { byClass } from '../../chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  GOODS, GOODS_TEMPLATE, GOODS_ROWS, goodById, goodTemplate, goodOfTemplate, mintGood, goodIn, takeGood, goodsWeight, MADE_K, WANT_K, PRICE_DRIFT, SPREAD, EXOTIC_K,
  CROWN_TRADE, DAY_STOCK, portTrade, standOf, priceOf, exchangeOf,
} from '../../../src/systems/naval/tradeGoods.js';
import { CHART_TEMPLATE, CHART_ROW, CHART_CHANCE, CHART_PX, CACHE_GOLD, CHART_SITE, mintChart, isChart, chartAboard, chartSite, cacheGold } from '../../../src/systems/naval/treasureCharts.js';
import { templateByIndex } from '../../../src/systems/item/itemTemplates.js';
import { createCaptainLedger, CHARTS_MAX } from '../../../src/systems/naval/captainLedger.js';
import { createHarbourOffice } from '../../../src/scenes/harbourOffice.js';
import { exchangeText, mountNavalYardWindow } from '../../../src/ui/naval/navalYardWindow.js';
import { classById } from '../../../src/systems/naval/navalShips.js';
import { SITE_LOT, CACHE_LOTS } from '../../../src/scenes/naval/navalHost.js';
import { STRONGBOX_KEY, STRONGBOX_RARITY_TIER } from '../../../src/systems/naval/navalPlunder.js';
import { sea } from '../../navalSea.mjs';

const rd = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const WAYREST = { key: '100,100', name: 'Wayrest', px: 100, py: 100, region: 23, crown: 'Wayrest' };
const SENTINEL = { key: '120,100', name: 'Sentinel', px: 120, py: 100, region: 20, crown: 'Sentinel' };
/** AUDIT CAPTAIN'S SEA B12/H8: a port of Sentinel's that WANTS wine (its own good twisted so) - Sentinel's own key above
 *  makes it, and the margin's check never ran. */
const WINE_WANTED = { key: '101,100', name: 'Hegathe', px: 101, py: 100, region: 20, crown: 'Sentinel' };
const ISLE = { key: 'e:1', name: 'Driftholm', ether: true };
const seaAt = (x, y) => x >= 100 || y >= 104;

test('CAPT-TRADE the goods: the Bay\'s eight and the Eltheric Ocean\'s three, each a stackable item of the port\'s own from GOODS_TEMPLATE on - its weight and base the row\'s; minted, counted, taken and weighed in a hold (mutants: the template, the count, the take, the weight)', () => {
  assert.equal(GOODS_TEMPLATE, 1331);
  assert.deepEqual(GOODS.map((g) => g.id), ['wine', 'grain', 'wool', 'iron', 'spice', 'silk', 'silver', 'ivory', 'etheramber', 'starglass', 'voidsilk']);
  assert.deepEqual(GOODS.filter((g) => g.ether).map((g) => g.id), ['etheramber', 'starglass', 'voidsilk']);
  for (const [i, g] of GOODS.entries()) {
    const t = templateByIndex(GOODS_TEMPLATE + i);
    assert.deepEqual([t?.name, t?.baseWeight, t?.basePrice, t?.stackable], [g.name, g.kg, g.base, true], g.id);
    assert.equal(goodTemplate(g.id), GOODS_TEMPLATE + i);
    assert.equal(goodOfTemplate(GOODS_TEMPLATE + i), g);
  }
  assert.equal(GOODS_ROWS.length, GOODS.length);
  assert.equal(goodOfTemplate(GOODS_TEMPLATE + GOODS.length), null);
  assert.equal(goodById('nope'), null);
  const hold = [mintGood('wine', 5), { templateIndex: 1330, stackCount: 3 }, mintGood('wine', 2), mintGood('iron', 1)];
  assert.equal(goodIn(hold, 'wine'), 7);
  assert.equal(goodsWeight(hold), 7 * 10 + 12);
  assert.equal(takeGood(hold, 'wine', 6), 6);
  assert.equal(goodIn(hold, 'wine'), 1);
  assert.equal(takeGood(hold, 'wine', 9), 1, 'no more than she carries');
  assert.equal(goodIn(hold, 'wine'), 0);
  assert.equal(hold.length, 2, 'spent stacks gone, the stores untouched');
});

test('CAPT-TRADE a port\'s trade: its crown\'s makes and wants, twisted by one good of its own off its key; an Eltheric isle makes the Eltheric goods and wants the Bay\'s; the Eltheric goods wanted in every port of the Bay (mutants: the twist, the isle, the exotic want)', () => {
  assert.deepEqual(CROWN_TRADE.Wayrest, { makes: ['wine', 'silver'], wants: ['iron', 'ivory', 'grain'] });
  const t = portTrade(WAYREST);
  const base = [...CROWN_TRADE.Wayrest.makes, ...CROWN_TRADE.Wayrest.wants];
  const extra = [...t.makes, ...t.wants].filter((g) => !base.includes(g));
  assert.equal(extra.length, 1, 'one good of its own');
  assert.ok(!GOODS.find((g) => g.id === extra[0]).ether);
  const twists = new Set(Array.from({ length: 30 }, (_, i) => JSON.stringify(portTrade({ key: `p${i}`, crown: 'Wayrest' }))));
  assert.ok(twists.size > 3, 'ports of a crown differ');
  // PIN MOVED (ISLE-TRADE, 2026-10-17): an isle makes its own good of the Bay besides (tradeGoods.js isleGood - Driftholm's
  // key draws iron), and wants every other good of the Bay
  assert.deepEqual(portTrade(ISLE), { makes: ['etheramber', 'starglass', 'voidsilk', 'iron'], wants: ['wine', 'grain', 'wool', 'spice', 'silk', 'silver', 'ivory'] });
  assert.equal(standOf(WAYREST, 'wine'), 'makes');
  assert.equal(standOf(WAYREST, 'iron'), 'wants');
  assert.equal(standOf(WAYREST, 'starglass'), 'wants', 'the Eltheric goods wanted in the Bay');
  assert.equal(standOf(ISLE, 'starglass'), 'makes');
  assert.equal(standOf(WAYREST, 'nope'), 'neither');
});

test('CAPT-TRADE the price: a good\'s base at MADE_K where made, WANT_K where wanted (EXOTIC_K for the other sea\'s), drifting within PRICE_DRIFT a day, the same for every client; the exchange sells SPREAD over it and buys SPREAD under it (mutants: each mood, the drift, the day, the spread)', () => {
  assert.deepEqual([MADE_K, WANT_K, PRICE_DRIFT, SPREAD, EXOTIC_K], [0.6, 1.55, 0.12, 0.08, 1.4]);
  for (let day = 0; day < 40; day++) {
    const made = priceOf(WAYREST, 'wine', day), wanted = priceOf(WINE_WANTED, 'wine', day);
    assert.ok(made.mid >= 30 * 0.6 * 0.88 - 1e-9 && made.mid <= 30 * 0.6 * 1.12 + 1e-9, `${made.mid}`);
    assert.equal(made.sell, Math.round(made.mid * 1.08));
    assert.equal(made.buy, Math.round(made.mid * 0.92));
    // PIN MOVED (AUDIT CAPTAIN'S SEA H8): `assert.ok(wanted)` held for any price - the wanted port's own, read
    assert.equal(wanted.stand, 'wants');
    assert.ok(wanted.mid >= 30 * 1.55 * 0.88 - 1e-9 && wanted.mid <= 30 * 1.55 * 1.12 + 1e-9, `${wanted.mid}`);
    const ex = priceOf(WAYREST, 'starglass', day);
    assert.ok(ex.mid >= 320 * 1.4 * 0.88 - 1e-9 && ex.mid <= 320 * 1.4 * 1.12 + 1e-9, 'the other sea\'s, wanted');
  }
  assert.deepEqual(priceOf(WAYREST, 'wine', 7), priceOf(WAYREST, 'wine', 7));
  assert.notDeepEqual(priceOf(WAYREST, 'wine', 7).mid, priceOf(WAYREST, 'wine', 8).mid, 'a new day, a new price');
  const iron = priceOf(WAYREST, 'iron', 3);
  assert.ok(iron.mid >= 24 * 1.55 * 0.88 && iron.mid <= 24 * 1.55 * 1.12);
  assert.equal(priceOf(WAYREST, 'nope', 1), null);
  // a run of the trade: Wayrest's wine to Sentinel - the margin a voyage is worth
  // PIN MOVED (AUDIT CAPTAIN'S SEA B12): the margin read where wine is wanted - the guarded check never ran at Sentinel's key
  const w = priceOf(WAYREST, 'wine', 5), s = priceOf(WINE_WANTED, 'wine', 5);
  assert.equal(standOf(WINE_WANTED, 'wine'), 'wants');
  assert.ok(s.buy > w.sell * 1.5, 'carried to where it is wanted: half again and more');
});

test('CAPT-TRADE the exchange\'s board: every good of its sea, the other sea\'s it wants; how many more it sells and buys today by DAY_STOCK and the captain\'s dealing here; the other sea\'s never sold (mutants: the stock, the dealing\'s sides, the exotic rows)', () => {
  assert.deepEqual(DAY_STOCK, { makes: { sell: 30, buy: 4 }, wants: { sell: 2, buy: 30 }, neither: { sell: 10, buy: 12 } });
  const rows = exchangeOf(WAYREST, 3);
  assert.deepEqual(rows.map((r) => r.id), GOODS.map((g) => g.id), 'the Bay\'s and the Eltheric goods it wants');
  const wine = rows.find((r) => r.id === 'wine');
  assert.deepEqual([wine.stand, wine.sells, wine.buys], ['makes', 30, 4]);
  const glass = rows.find((r) => r.id === 'starglass');
  assert.deepEqual([glass.stand, glass.sells, glass.buys], ['wants', 0, 30], 'never sold in the Bay');
  const dealt = exchangeOf(WAYREST, 3, { bought: { wine: 12 }, sold: { iron: 5 } });
  assert.equal(dealt.find((r) => r.id === 'wine').sells, 18);
  assert.equal(dealt.find((r) => r.id === 'iron').buys, 25);
  const isle = exchangeOf(ISLE, 3);
  // PIN MOVED (ISLE-TRADE): an isle sells its own good of the Bay as made (iron, Driftholm's), and none of the rest
  assert.ok(isle.find((r) => r.id === 'wine').sells === 0 && isle.find((r) => r.id === 'voidsilk').sells === 30);
  const iron = isle.find((r) => r.id === 'iron');
  assert.deepEqual([iron.stand, iron.exotic, iron.sells, iron.buys], ['makes', false, 30, 4], 'its own good: sold as made, never "not sold here"');
});

function officeOf(o = {}) {
  const log = { mid: [], say: [], paid: [], credited: [] };
  let purse = o.gold ?? 1000;
  const ledger = o.ledger ?? createCaptainLedger();
  const office = createHarbourOffice({
    ledger, now: () => 0, day: () => o.day ?? 3, level: () => o.level ?? 5, gold: () => purse,
    pay: (n) => { purse -= n; log.paid.push(n); }, credit: (n) => { purse += n; log.credited.push(n); },
    say: (t) => log.say.push(t), mid: (t) => log.mid.push(t), notorietyOf: () => 0,
    port: () => (o.port === undefined ? WAYREST : o.port), ports: () => [WAYREST, SENTINEL], seaAt, waters: () => 'Wayrest',
    stow: (hold, item) => hold.push(item),
  });
  return { office, ledger, log, purse: () => purse };
}

test('CAPT-TRADE the exchange dealt with: goods bought into the hold - as many as it sells today and the purse pays for - and sold out of it - as many as she carries and it buys - the day\'s dealing kept, the sale in the log; nothing without a hold (mutants: the purse, the stock, the stow, the take, the credit, the log)', () => {
  const h = officeOf({ gold: 1000 });
  const hold = [];
  const x = h.office.exchange({ uid: 42, cargo: hold });
  const wine = x.rows.find((r) => r.id === 'wine');
  const r1 = x.buy('wine', 10);
  assert.equal(r1.ok, true);
  assert.equal(goodIn(hold, 'wine'), 10);
  assert.deepEqual(h.log.paid, [10 * wine.sell]);
  assert.equal(r1.text, `Bought 10 casks of Wine for ${(10 * wine.sell).toLocaleString('en-US')} gold.`);
  assert.equal(h.office.exchange({ cargo: hold }).rows.find((r) => r.id === 'wine').sells, 20, 'the day\'s dealing kept');
  const poor = officeOf({ gold: 3 });
  assert.deepEqual(poor.office.exchange({ cargo: [] }).buy('wine', 1), { ok: false, text: `Not enough gold - ${wine.sell} gold a cask.` });
  const many = officeOf({ gold: 99999 });
  const big = [];
  many.office.exchange({ cargo: big }).buy('wine', 99);
  assert.equal(goodIn(big, 'wine'), 30, 'no more than it sells today');
  assert.equal(many.office.exchange({ cargo: big }).buy('wine', 1).ok, false);
  // sold where it is wanted is not here - sold here, what Wayrest buys of what it makes: DAY_STOCK.makes.buy
  const s1 = h.office.exchange({ cargo: hold }).sell('wine', Infinity);
  assert.equal(s1.ok, true);
  assert.equal(goodIn(hold, 'wine'), 10 - 4, 'Wayrest takes four of its own wine a day');
  assert.equal(h.ledger.log.traded, h.log.credited[0]);
  assert.equal(h.office.exchange({ cargo: hold }).sell('wine', 1).ok, false, 'glutted');
  assert.deepEqual(h.office.exchange({ cargo: [] }).sell('iron', 1), { ok: false, text: 'You carry no Iron.' });
  assert.equal(h.office.exchange(null).buy('wine', 1).ok, false, 'no hold, no goods');
  assert.equal(officeOf({ port: null }).office.exchange({ cargo: [] }), null);
  const L = h.ledger;
  const M = createCaptainLedger();
  M.restoreSaveData(JSON.parse(JSON.stringify(L.getSaveData())));
  assert.deepEqual(M.dealtAt('100,100', 3), L.dealtAt('100,100', 3));
  assert.deepEqual(M.dealtAt('100,100', 4), { bought: {}, sold: {} }, 'another day: nothing dealt');
});

test('CAPT-CHARTS a chart among a pirate\'s papers: CHART_CHANCE of a pirate\'s, more in the deep and a flagship\'s, by her seed - never a trader\'s or a crown\'s; the chart an item of the port\'s own, its seed its message (mutants: the chances, the trade, the seed)', () => {
  assert.equal(CHART_TEMPLATE, 1342);
  assert.deepEqual(CHART_CHANCE, { pirate: 0.08, deep: 0.18, flagship: 0.6 });
  assert.equal(templateByIndex(CHART_TEMPLATE).name, 'Treasure Chart');
  assert.equal(CHART_ROW.stackable, false);
  const sloop = classById('pirateSloop'), flag = classById('pirateFlagship');
  const share = (cls, deep) => { let n = 0; for (let i = 1; i <= 4000; i++) if (chartAboard(cls, i * 2654435761 >>> 0, { deep }) != null) n++; return n / 4000; };
  assert.ok(Math.abs(share(sloop, false) - 0.08) < 0.02);
  assert.ok(Math.abs(share(sloop, true) - 0.18) < 0.025);
  assert.ok(Math.abs(share(flag, false) - 0.6) < 0.03);
  for (let i = 1; i <= 200; i++) {
    assert.equal(chartAboard(classById('merchantGalleon'), i), null, 'a trader carries none');
    assert.equal(chartAboard(classById('navyCutter'), i, { deep: true }), null, 'a crown\'s ship none');
  }
  let seed = 1; while (chartAboard(sloop, seed) == null) seed++;
  assert.equal(chartAboard(sloop, seed), chartAboard(sloop, seed), 'the same chart on every client');
  const c = mintChart(chartAboard(sloop, seed));
  assert.ok(isChart(c) && c.message === chartAboard(sloop, seed));
});

test('CAPT-CHARTS a chart read: its cache CHART_PX off a port of the Bay off its seed, in open water, the same for every client; marked on the captain\'s charts (never one twice, never past CHARTS_MAX) and the chart spent; raised, its gold paid and the log\'s `maps` (mutants: the band, the port, the mark, the raise, the gold)', () => {
  assert.deepEqual(CHART_PX, { near: 6, far: 14 });
  const site = chartSite(12345, [WAYREST, SENTINEL], seaAt);
  assert.deepEqual(chartSite(12345, [WAYREST, SENTINEL], seaAt), site);
  const port = [WAYREST, SENTINEL].find((p) => site.words.endsWith(`of ${p.name}`));
  const d = Math.max(Math.abs(site.px - port.px), Math.abs(site.py - port.py));
  assert.ok(d >= 6 && d <= 14, `${d}`);
  assert.equal(site.id, `${CHART_SITE}12345`);
  assert.equal(chartSite(12345, [], seaAt), null);
  assert.equal(chartSite(12345, [WAYREST], () => false), null);
  assert.deepEqual(CACHE_GOLD, { base: 250, level: 60 });
  const g = cacheGold(9, 5);
  assert.ok(g >= (250 + 300) * 0.8 - 1 && g <= (250 + 300) * 1.2 + 1);
  assert.equal(cacheGold(9, 5), g);
  const h = officeOf({ level: 5 });
  const item = mintChart(12345);
  assert.equal(h.office.readChart(item).ok, true);
  assert.deepEqual(h.ledger.charts().map((c) => c.id), [site.id]);
  assert.match(h.office.readChart(item).text, /marked this cache already/);
  assert.deepEqual(h.office.sites().find((x) => x.kind === 'cache'), { id: site.id, kind: 'cache', px: site.px, py: site.py, seed: 12345, n: 1 });
  assert.equal(h.office.raiseCache(site.id), cacheGold(12345, 5));
  assert.deepEqual(h.log.credited, [cacheGold(12345, 5)]);
  assert.equal(h.ledger.log.maps, 1);
  assert.equal(h.office.raiseCache(site.id), 0, 'raised once');
  const L = createCaptainLedger();
  assert.equal(L.markChart({ id: `${CHART_SITE}x`, seed: 1, px: 1, py: 1 }), true);
  assert.equal(L.markChart({ id: `${CHART_SITE}x`, seed: 1, px: 1, py: 1 }), false, 'never one twice');
  L.raiseChart(`${CHART_SITE}x`);
  for (let i = 0; i < CHARTS_MAX + 2; i++) L.markChart({ id: `${CHART_SITE}${i}`, seed: i, px: 1, py: 1, near: 'X', words: 'w' });
  assert.equal(L.charts().length, CHARTS_MAX);
  const M = createCaptainLedger();
  M.restoreSaveData(JSON.parse(JSON.stringify(L.getSaveData())));
  assert.deepEqual(M.charts(), L.charts());
  const ink = officeOf({}).office;
  assert.equal(ink.chartFor(classById('merchantGalleon'), 7), null);
});

test('CAPT-CHARTS at sea: a chart among the papers of a pirate the captain ends, given and said; a marked cache\'s chest floated within reach of its waters, hauled up for two strongbox lots and its gold (mutants: the papers, the chest, the haul\'s lots, the gold)', async () => {
  assert.equal(CACHE_LOTS, 2);
  const s = await sea({ hull: 2 });
  const given = [];
  s.deps.board.giveItems = (items) => { given.push(...items); return { left: [] }; };
  s.deps.captain = { chartFor: () => mintChart(77), raiseCache: () => 640, sites: () => [{ id: `${CHART_SITE}77`, kind: 'cache', px: 101, py: 100, seed: 77, n: 1 }] };
  s.deps.sitePoint = () => [0, 0, 250];
  s.deps.hold = (key, tier) => [{ name: `${key}@${tier}` }];
  const e = s.host._sea.get(s.host.spawnShip('pirateSloop', { range: 300 }));
  s.host._charge('sink', e.id);
  assert.ok(given.some(isChart), 'the chart to my hold');
  assert.ok(s.log.say.some((t) => /A treasure chart!/.test(t)));
  s.run(1.2);
  const chest = s.host._shots.floaters().find((f) => f.lot === `${SITE_LOT}${CHART_SITE}77`);
  assert.ok(chest, 'the cache afloat');
  assert.ok(s.log.say.includes('Your lookout spots a chest bobbing where the chart said. The cache!'));
  s.host._shots.floater(chest.id).pos = [0, 0, 0];
  s.run(0.3);
  assert.deepEqual(given.filter((it) => it.name && !isChart(it)).map((it) => it.name), [`${STRONGBOX_KEY}@${STRONGBOX_RARITY_TIER}`, `${STRONGBOX_KEY}@${STRONGBOX_RARITY_TIER}`]);
  assert.ok(s.log.say.includes('You haul up the cache: 640 gold and 2 things.'), s.log.say.join(' | '));
});

test('CAPT-TRADE the exchange\'s tab: each good\'s stand, its two prices and how many more today, what her hold carries; Buy 1, Buy 10, Sell 1, Sell all; the world\'s exchange and the chart\'s reading wired (mutants: the words, the presses, the wiring)', () => {
  const h = officeOf({ gold: 5000 });
  const hold = [mintGood('iron', 3)];
  const x = h.office.exchange({ uid: 42, cargo: hold });
  const t = exchangeText(x);
  assert.match(t.lede, /^Wayrest's exchange\. The hold carries 36 kg of goods\. You have 5,000 gold\.$/);
  const wine = t.rows.find((r) => r.id === 'wine');
  assert.match(wine.words, /^Made here: cheap - buy at \d+ gold a cask \(30 left today\) - sell at \d+ gold \(4 wanted\)$/);
  const iron = t.rows.find((r) => r.id === 'iron');
  assert.deepEqual([iron.extra, iron.canSell], ['In the hold: 3 pigs', true]);
  assert.equal(exchangeText(h.office.exchange(null)).lede, 'Wayrest\'s exchange. Trade from the helm, into the hold.');
  const proto = Object.getPrototypeOf(globalThis.document.createElement('div'));
  proto.removeAttribute ??= function removeAttribute(k) { delete this.attrs[k]; };
  const model = { name: 'Small Ship', uid: 42, offer: () => ({ rows: [], whole: 0, gold: 5000 }), ship: () => ({ hull: 1, maxHull: 1, sail: 1, maxSail: 1, crew: 1, maxCrew: 1, barrels: 0 }), exchange: () => h.office.exchange({ uid: 42, cargo: hold }) };
  const host = globalThis.document.createElement('div');
  const win = mountNavalYardWindow(host, { model });
  const [tabs] = byClass(host, 'dfnaval-tabs');
  const [, officeTab, tradeTab] = tabs.children;
  assert.equal(officeTab.style.display, 'none', 'no office handed: no harbourmaster');
  tradeTab.onclick({ stopPropagation() {} });
  const rows = byClass(host, 'dfnaval-officerow');
  const wineRow = rows.find((r) => r.attrs['data-row'] === 'wine');
  const [buy1] = byClass(wineRow, 'dfnaval-tradebuy');
  buy1.onclick({ stopPropagation() {} });
  assert.equal(goodIn(hold, 'wine'), 1, 'bought from the tab');
  win.unmount();
  const w = rd('src/scenes/world.js');
  // PIN MOVED (AUDIT CAPTAIN'S SEA B3/B11): the exchange for a ship lying to the quay at her helm alone, and her room with it
  assert.match(w, /if \(model\.atQuay\) model\.exchange = \(\) => harbourOffice\.exchange\(\{ uid: model\.uid \?\? null, cargo: model\.cargo\?\.\(\) \?\? null, room: \(\) => model\.room\?\.\(\) \?\? null \}\);/);
  assert.match(w, /registerItemUseHandler\(CHART_TEMPLATE, \(item, collection\) => \{\n\s+const r = harbourOffice\.readChart\(item\);\n\s+const i = r\.ok && Array\.isArray\(collection\) \? collection\.indexOf\(item\) : -1;\n\s+if \(i >= 0\) collection\.splice\(i, 1\);/);
  assert.match(rd('src/systems/item/itemLaw.js'), /import '\.\.\/naval\/tradeGoods\.js';[^\n]*\nimport '\.\.\/naval\/treasureCharts\.js';/);
});
