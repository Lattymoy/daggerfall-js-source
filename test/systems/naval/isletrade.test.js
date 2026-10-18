// ISLE-TRADE (2026-10-17, the owner: "Can you make it so each island does sell atleast one normal exchange product so you
// could feasibly live and trade out in the veil"; bible/03-World/Naval-Refit.md ISLE-TRADE) - every Eltheric isle's
// freeport makes a good of the Bay of its own and sells it as made: the isles about Veilhaven as the world host stands
// them (scenes/world.js etherPortOf's port), each one's good its key's, spread over the eight; a trade from isle to isle
// that pays without crossing the Veil; the harbour office selling it from the hold's own exchange and listing it on the
// classic skin too; and the chart's card naming it. tools/mutants/isletrade.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { GOODS, isleGood, portTrade, exchangeOf, standOf, MADE_K, DAY_STOCK, goodIn } from '../../../src/systems/naval/tradeGoods.js';
import { islesNear, veilhaven } from '../../../src/world/ethericSea.js';
import { createHarbourOffice } from '../../../src/scenes/harbourOffice.js';
import { createCaptainLedger } from '../../../src/systems/naval/captainLedger.js';
import * as CHART from '../../../src/ui/etherChartWindow.js';

const WORLD = readFileSync(new URL('../../../src/scenes/world.js', import.meta.url), 'utf8');
const BAY = GOODS.filter((g) => !g.ether).map((g) => g.id);
/** A port isle as the harbour office and the naval host read one (world.js etherPortOf - pinned below). */
const portOf = (i) => ({ key: `${i.px},${i.py}`, name: i.name, px: i.px, py: i.py, region: 61, crown: null, ether: true });
const v = veilhaven();
const PORTS = islesNear(v.px, v.py, 400).filter((i) => i.kind === 'port').map(portOf);

test('ISLE-TRADE every port isle about Veilhaven makes a good of the Bay of its own, and its exchange sells a day\'s stock of it at its made price - never "not sold here"; the rest of the Bay still wanted at the exotic price (mutants: the good made, the row listed, the row exotic)', () => {
  assert.ok(PORTS.length > 200, `the isles read: ${PORTS.length}`);
  assert.ok(PORTS.some((p) => p.name === 'Veilhaven'));
  for (const port of PORTS) {
    const own = isleGood(port);
    assert.ok(BAY.includes(own), `${port.name}: a good of the Bay`);
    assert.deepEqual(portTrade(port), { makes: ['etheramber', 'starglass', 'voidsilk', own], wants: BAY.filter((g) => g !== own) }, `${port.name}: made besides the three, the rest of the Bay wanted`);
    assert.equal(standOf(port, own), 'makes');
    const rows = exchangeOf(port, 7);
    const bay = rows.filter((r) => BAY.includes(r.id) && r.sells > 0 && !r.exotic);
    assert.deepEqual(bay.map((r) => r.id), [own], `${port.name}: sells ${own} and no other good of the Bay`);
    const row = bay[0], base = GOODS.find((g) => g.id === own).base;
    assert.deepEqual([row.stand, row.sells, row.buys], ['makes', DAY_STOCK.makes.sell, DAY_STOCK.makes.buy]);
    assert.ok(row.sell <= Math.round(base * MADE_K * 1.12 * 1.08) + 1, `${port.name}: ${own} at its made price (${row.sell} of ${base})`);
    for (const r of rows.filter((x) => BAY.includes(x.id) && x.id !== own)) assert.deepEqual([r.stand, r.exotic, r.sells], ['wants', true, 0], `${port.name} ${r.id}`);
  }
});

test('ISLE-TRADE the isles\' goods: the same on every reading (the key\'s own), and spread over all eight of the Bay\'s - no good rarer than a twentieth of the isles (mutants: the draw)', () => {
  const tally = Object.fromEntries(BAY.map((g) => [g, 0]));
  for (const port of PORTS) { const g = isleGood(port); assert.equal(isleGood({ key: port.key }), g); tally[g]++; }
  for (const g of BAY) assert.ok(tally[g] >= PORTS.length / 20, `${g}: ${tally[g]} of ${PORTS.length}`);
  assert.equal(isleGood({ key: `${v.px},${v.py}` }), 'spice', 'Veilhaven makes spices');
});

test('ISLE-TRADE a living past the Veil: from every isle a captain can buy its own good and sell it at a profit in another isle\'s exchange within eleven leagues (64 px - the farthest of Veilhaven\'s waters is 60 px from its buyer), every isle within 120 px of Veilhaven - no crossing back to the Bay', () => {
  const near = (a, b) => Math.hypot(a.px - b.px, a.py - b.py) <= 64;
  const within = PORTS.filter((p) => Math.hypot(p.px - v.px, p.py - v.py) <= 120);
  for (const a of within) {
    const own = isleGood(a);
    const buyAt = exchangeOf(a, 7).find((r) => r.id === own).sell;
    const best = Math.max(...PORTS.filter((b) => b !== a && near(a, b)).map((b) => exchangeOf(b, 7).find((r) => r.id === own)?.buy ?? 0));
    assert.ok(best > buyAt * 1.5, `${a.name}: ${own} bought at ${buyAt}, sold within 64 px at ${best}`);
  }
});

function officeAt(port, { gold = 5000, others = true } = {}) {
  let purse = gold;
  const office = createHarbourOffice({
    ledger: createCaptainLedger(), now: () => 0, day: () => 7, level: () => 5, gold: () => purse,
    pay: (n) => { purse -= n; }, credit: (n) => { purse += n; }, say: () => {}, mid: () => {}, notorietyOf: () => 0,
    port: () => port, ports: () => [port], seaAt: () => true, waters: () => null, stow: (hold, item) => hold.push(item), etherGoods: () => others,
  });
  return { office, purse: () => purse };
}

test('ISLE-TRADE the harbour office at an isle: its own good of the Bay is bought into the hold at the quay, and listed on the classic skin (no other sea\'s goods shown there) - the other goods of the Bay still "not sold here" (mutants: the row exotic)', () => {
  const port = PORTS.find((p) => p.name === 'Veilhaven');
  const own = isleGood(port);
  const h = officeAt(port);
  const hold = [];
  const ex = h.office.exchange({ uid: 1, cargo: hold });
  const r = ex.buy(own, 5);
  assert.equal(r.ok, true, r.text);
  assert.equal(goodIn(hold, own), 5);
  assert.ok(h.purse() < 5000);
  const wine = ex.buy('wine', 1);
  assert.deepEqual([wine.ok, wine.text], [false, 'Wine is not sold here.']);
  const classic = officeAt(port, { others: false }).office.exchange({ uid: 1, cargo: [] });
  assert.ok(classic.rows.some((x) => x.id === own && x.sells > 0), 'the classic skin lists the isle\'s own good');
  assert.ok(!classic.rows.some((x) => x.id === 'wine'), 'and no good of the Bay it only wants');
});

test('ISLE-TRADE the chart\'s card names a port isle\'s good off the key the world host gives its port; the lesser isles\' cards none (mutants: the card\'s good)', () => {
  assert.match(WORLD, /const etherPortOf = \(i\) => \(\{ key: `\$\{i\.px\},\$\{i\.py\}`, name: i\.name, px: i\.px, py: i\.py, region: ETHER_REGION, crown: null, ether: true \}\);/, 'the port\'s key the card draws by');
  const word = { px: v.px - 18, py: v.py + 3, yaw: 0, charted: [v.key, ...islesNear(v.px, v.py, 30).map((i) => i.key)], legends: [], stats: {} };
  const at = { cx: v.px - 17.5, cy: v.py + 3.5, zoom: 2 };
  const m = CHART.chartModel(word, at, 1064, 550, { pick: v.key });
  assert.match(m.pick.words, /^A port - makes spices - /);
  const wild = islesNear(v.px, v.py, 30).find((i) => i.kind === 'wild' && word.charted.includes(i.key));
  const mw = wild ? CHART.chartModel(word, at, 1064, 550, { pick: wild.key }) : null;
  if (mw?.pick) assert.doesNotMatch(mw.pick.words, /makes/, 'a wild isle\'s card names no exchange');
});
