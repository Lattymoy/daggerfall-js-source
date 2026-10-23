// ETHER-CROSSING, ETHER-SEA's host, ETHER-CHART (2026-10-11, the owner: "Sail far enough and you are prompted to travel
// into the open sea") - THE CROSSING, AND WHAT A CAPTAIN KEEPS OF THE SEA (bible/03-World/Eltheric-Ocean.md): when the
// crossing is asked and how it is sailed; the ledger's Eltheric record; the Eltheric host's waters, charting, strands,
// legends, charts and papers; the chart of the Eltheric Ocean. tools/mutants/ethercross.json.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { crossingWayAt, createCrossingGate, crossingTarget, crossingRows, crossingWords, createCrossLand, CROSS_DAYS, CROSS_CHECK_S, CROSS_REFUSED } from '../../../src/systems/naval/etherCrossing.js';
import { createCaptainLedger, ETHER_CHARTED_MAX, ETHER_HARVEST_KEEP, newEther, newLog, logLines } from '../../../src/systems/naval/captainLedger.js';
import { createEtherHost, SIGHT_PX, HARVEST_REACH_PX, HARVEST_CASKS, STRAND_YIELD, HARVEST_DAYS, STRAND_SITE, CHART_BUY_PX, CHART_BUY_PRICE, PAPERS_CHANCE, PAPERS_PX } from '../../../src/scenes/etherHost.js';
import { veilhaven, landfall, HOME_WATERS, VEIL_X, isleOfCell, islesNear, LEAGUE_PX, ETHER_BOX, etherDepthAt, CROSS_LAND_PX } from '../../../src/world/ethericSea.js';
import { LEGENDS, hauntOf, legendById } from '../../../src/systems/naval/etherShips.js';
import { goodOfTemplate } from '../../../src/systems/naval/tradeGoods.js';
import { classById } from '../../../src/systems/naval/navalShips.js';
import { mulberry32 } from '../../../src/combat/blood/bloodArt.js';
import { CHART_ZOOMS, CHART_ZOOM_DEFAULT, toScreen, toChart, chartZoomAt, clampChartView, chartModel, wayWords, isleWords, LABEL_ZOOM } from '../../../src/ui/etherChartWindow.js';
import { officeText, etherOfficeText } from '../../../src/ui/naval/navalYardWindow.js';

const read = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const wilds = () => { const out = []; for (let cy = 230; cy < 270; cy++) for (let cx = 700; cx < 790; cx++) { const i = isleOfCell(cx, cy); if (i?.kind === 'wild') out.push(i); } return out; };
const hostOf = (o = {}) => {
  const L = createCaptainLedger();
  const said = [], mid = [];
  let purse = o.gold ?? 10000, day = o.day ?? 10;
  const host = createEtherHost({ ledger: L, day: () => day, gold: () => purse, pay: (n) => { purse -= n; }, credit: (n) => { purse += n; }, say: (t) => said.push(t), mid: (t) => mid.push(t) });
  return { host, L, said, mid, purse: () => purse, setDay: (d) => { day = d; } };
};

test('ETHER-CROSSING the ways: out in the crossing waters, home in the Veil, none else; asked once each time the ship comes into them - a refusal remembered until she leaves them (mutants: each way, the gate\'s memory, its forgetting)', () => {
  const h = veilhaven();
  assert.equal(crossingWayAt(VEIL_X + 2, h.py, 0), 'home');
  assert.equal(crossingWayAt(VEIL_X - 2, h.py, 0), null);
  assert.equal(crossingWayAt(150, 300, 25), 'out');
  assert.equal(crossingWayAt(150, 300, 5), null, 'too near land');
  assert.equal(crossingWayAt(600, 300, 50), null, 'the Bay itself');
  const g = createCrossingGate();
  assert.equal(g.offer('out'), true);
  g.asked('out');
  assert.equal(g.offer('out'), false, 'not asked again in the same waters');
  assert.equal(g.pending, 'out');
  assert.equal(g.offer(null), false, 'left them');
  assert.equal(g.pending, null, 'forgotten');
  assert.equal(g.offer('out'), true, 'back in them: asked again');
  g.asked('out');
  assert.equal(g.offer('home'), true, 'another way\'s waters');
  assert.equal(CROSS_CHECK_S, 0.5);
});

test('ETHER-CROSSING the voyage: three days; out to the open water off Veilhaven, home to the waters she set sail from, else the Bay\'s mouth; the question and the landfall in words (mutants: the days, the targets, the rows)', () => {
  assert.equal(CROSS_DAYS, 3);
  assert.deepEqual(crossingTarget('out', { px: 1, py: 2 }), landfall());
  assert.deepEqual(crossingTarget('home', { px: 150, py: 310 }), { px: 150, py: 310 });
  assert.deepEqual(crossingTarget('home', null), { ...HOME_WATERS });
  assert.deepEqual(crossingTarget('home', { px: NaN, py: 3 }), { ...HOME_WATERS });
  const out = crossingRows('out');
  assert.match(out.join(' '), /Set a course into the open sea\? \(3 days\. Your ship,/);
  assert.match(crossingRows('home').join(' '), /Set a course for home\? \(3 days\)/);
  assert.match(crossingRows('out', { days: 1 }).join(' '), /\(1 day\. Your ship/);
  assert.match(crossingWords('out'), /You have crossed into the Eltheric Ocean\. Veilhaven lies ahead\.$/);   // PIN MOVED (ELTHERIC): the Etheric Sea's
  assert.match(crossingWords('home'), /The Iliac Bay, and home\.$/);   // PIN MOVED (VOICE2, in PLAIN-SWEEP's words): no dash aside (Voice.md rule 5)
  assert.match(CROSS_REFUSED.passengers, /no one else is aboard/); assert.match(CROSS_REFUSED.hostile, /enemy/);
});

test('ETHER-CROSSING by source: asked at a helm in the exterior with no window up, an enemy near or another player aboard said instead; sailed - the helm let go first, the jump a travel of CROSS_DAYS whose arrival brings her round onto the landfall\'s middle, her helm taken after, the clock\'s days, the haven charted, the way home leaving the gate asked; the ship held while she crosses (mutants: each step and its order)', () => {
  const src = read('src/scenes/world.js');
  const step = src.slice(src.indexOf('function etherCrossStep(dt) {'), src.indexOf('async function etherCross(way) {'));
  assert.match(step, /if \(!etherSea \|\| _etherCrossing \|\| !csaRuntime\?\.isSailing\?\.\(\)\) return;/);
  // PIN MOVED (AUDIT CAPTAIN'S SEA X3): never while the world is being moved
  assert.match(step, /if \(gamePaused\(\) \|\| _loading \|\| townTalk\.overlayActive \|\| modes\?\.transitioning \|\| worldMoveBusy\(\) \|\| _partyArrivalPending \|\| _mode\(\) !== 'exterior'\) return;/);
  // PIN MOVED (AUDIT CAPTAIN'S SEA G2): the way out only where the crossing out is this game's - the Veil's home under any skin
  assert.match(step, /const way = crossWayHere\(\);/);
  assert.match(src, /return crossingWayAt\(p\.x, p\.y, etherOut && p\.x < CROSS_X && !inEther\(p\.x, p\.y\) \? crossLandPx\(p\.x, p\.y\) : 0\);/);
  // PIN MOVED (AUDIT CAPTAIN'S SEA X1): a refusal said once in those waters and the way not marked asked - asked as soon as the deck is clear
  assert.match(step, /if \(!crossGate\.offer\(way\)\) return;\n    const why = crossRefusal\(\);\n    if \(why\) \{ if \(_crossSaid !== way\) \{ _crossSaid = way; townTalk\.say\(CROSS_REFUSED\[why\], 4\); \} return; \}\n    crossGate\.asked\(way\);/);
  assert.match(src, /const crossRefusal = \(\) => \(navalHostileNear\(\) \? 'hostile' : csaPassengersOn\(csaRuntime\?\.state\?\.CurrentBoat\) > 0 \? 'passengers' : null\);/);
  const cross = src.slice(src.indexOf('async function etherCross(way) {'), src.indexOf('  let _navalWasOn = null;'));
  // PIN MOVED (AUDIT CAPTAIN'S SEA X9): the success's path read past the failure's (a voyage that could not be made brings her back)
  const order = ['captainLedger.setCrossedFrom', 'hudFade.smashHUDToBlack()', 'csaRuntime.StopSailing()', 'await _teleportToPixel(to.px, to.py', 'csaRuntime.RepositionBoat(boat, [x, tvSeaY(), z], dir', 'setSyntheticTimeIncrease(true); playerTicker.advance(minutes)', 'captainLedger.crossed()'];
  let at = -1;
  for (const k of order) { const i = cross.indexOf(k); assert.ok(i > at, `${k} in its turn`); at = i; }
  const tail = cross.slice(cross.indexOf('setSyntheticTimeIncrease(true); playerTicker.advance(minutes)'));
  assert.ok(tail.indexOf('csaRuntime.StartSailing(boat)') >= 0 && tail.indexOf('csaRuntime.StartSailing(boat)') < tail.indexOf('captainLedger.crossed()'), 'her helm taken, then the crossing counted');
  assert.match(cross, /const minutes = CROSS_DAYS \* 1440;/);
  assert.match(cross, /modEvent: 'travel',/);
  assert.match(cross, /const \[x, z\] = state\.localFromWorld\(\(to\.px \+ 0\.5\) \* RAID_NATIVE_PIXEL, \(499 - to\.py \+ 0\.5\) \* RAID_NATIVE_PIXEL\);/);
  assert.match(cross, /if \(way === 'out'\) captainLedger\.chartIsle\(veilhaven\(\)\.key\);/);
  assert.match(cross, /else crossGate\.asked\('out'\);/);
  assert.match(cross, /finally \{\n      _etherCrossing = false;\n      hudFade\.fadeHUDFromBlack\(\);/);
  assert.match(src, /let _etherCrossing = false;   \/\/ ETHER-CROSSING: a voyage under way/);
  assert.ok(src.indexOf('let _etherCrossing = false;') < src.indexOf('const paused = gamePaused() || _loading || _partyArrivalPending || _etherCrossing;'), 'declared before any frame reads it');
  assert.match(src, /if \(!gamePaused\(\) && !_loading\) etherCrossStep\(dt\);/);
  // PIN MOVED (HOST-SPLIT, SEA VENTURES 2026-10-22): the distance to land out of bootWorld (etherCrossing.js createCrossLand),
  // over the map's one water law - asked of it here by behaviour
  assert.match(src, /const crossLandPx = createCrossLand\(seaPixel\);/);
  const asked = [];
  const island = (x, y) => { asked.push(`${x},${y}`); return !(x === 13 && y === 10); };   // one pixel of land, three east
  const landPx = createCrossLand(island, 20);
  assert.equal(landPx(10, 10), 3, 'the nearest land, Chebyshev');
  const n = asked.length;
  assert.equal(landPx(10, 10), 3, 'asked again');
  assert.equal(asked.length, n, 'the last pixel\'s answer kept');
  assert.equal(createCrossLand(() => true, 4)(0, 0), Infinity, 'none within its reach: Infinity');
  assert.equal(createCrossLand((x, y) => !(x === 0 && y === 0), 4)(0, 0), 0, 'on land: none');
  assert.equal(createCrossLand(island, 2)(10, 10), Infinity, 'past its reach');
  assert.equal(CROSS_LAND_PX, 20);
  assert.match(readFileSync(new URL('../../../src/systems/naval/etherCrossing.js', import.meta.url), 'utf8'), /if \(Math\.max\(Math\.abs\(dx\), Math\.abs\(dy\)\) === r && !seaPixel\(px \+ dx, py \+ dy\)\) \{ d = r; break ring; \}/, 'each ring\'s own pixels, asked once');
});

test('ETHER-SEA the ledger\'s record: isles charted once each (the log\'s islands), a legend\'s day, a strand\'s day (the newest kept), the way out, the crossings, the legends heard - kept whole by the save and cleaned field by field (mutants: each field, the bounds)', () => {
  assert.deepEqual(newEther(), { charted: [], legends: {}, harvested: {}, from: null, crossings: 0, heard: [], season: null, fleets: [], wrack: [] });   // PIN MOVED (SEA-SEASON): and no season's figures; (AUDIT SEA VENTURES D2, D4, D6): no fleet's flagship ended, no wrack hauled
  assert.equal(ETHER_CHARTED_MAX, 4096); assert.equal(ETHER_HARVEST_KEEP, 128);
  const a = createCaptainLedger();
  assert.equal(a.chartIsle('800,249'), true); assert.equal(a.chartIsle('800,249'), false); assert.equal(a.chartIsle(5), false);
  assert.equal(a.log.islands, 1); assert.equal(a.isCharted('800,249'), true); assert.deepEqual(a.charted(), ['800,249']);
  a.endLegend('queen', 12); assert.equal(a.legendDay('queen'), 12); assert.equal(a.legendDay('wake'), null);
  for (let i = 0; i < ETHER_HARVEST_KEEP + 5; i++) a.gathered(`${i},1`, i);
  assert.equal(a.gatheredDay('0,1'), null, 'the oldest let go'); assert.equal(a.gatheredDay(`${ETHER_HARVEST_KEEP + 4},1`), ETHER_HARVEST_KEEP + 4);
  a.gathered('5,1', 500); assert.equal(a.gatheredDay('5,1'), 500, 'gathered again: the newest');
  for (let i = 0; i < 10; i++) a.gathered(`x${i},2`, 600 + i);
  assert.equal(a.gatheredDay('5,1'), 500, 'kept as the newest, past ten more');
  assert.equal(a.gatheredDay('6,1'), null, 'its old neighbours let go');
  a.setCrossedFrom({ px: 150.7, py: 300 }); assert.deepEqual(a.crossedFrom(), { px: 150, py: 300 });
  a.setCrossedFrom({ px: 'x' }); assert.equal(a.crossedFrom(), null);
  a.setCrossedFrom({ px: 150, py: 300 });
  a.crossed(); a.crossed(); assert.equal(a.crossings, 2);
  a.hearLegend('queen'); a.hearLegend('queen'); a.hearLegend(7); assert.deepEqual(a.heard(), ['queen']);
  const b = createCaptainLedger();
  b.restoreSaveData(JSON.parse(JSON.stringify(a.getSaveData())));
  assert.deepEqual(b.getSaveData(), a.getSaveData());
  assert.equal(b.isCharted('800,249'), true, 'the charted set stood again');
  const c = createCaptainLedger();
  c.restoreSaveData({ ether: { charted: ['1,2', '1,2', 'x', 5, '-3,4'], legends: { wake: 4, junk: 'q' }, harvested: { '1,1': 3, n: null }, from: { px: 'no' }, crossings: -4, heard: ['wake', 9, 'wake'] } });
  const e = c.getSaveData().ether;
  assert.deepEqual(e, { charted: ['1,2'], legends: { wake: 4 }, harvested: { '1,1': 3 }, from: null, crossings: 0, heard: ['wake'], season: null, fleets: [], wrack: [] });   // PIN MOVED (SEA-SEASON): no season's figures; (AUDIT SEA VENTURES D2, D4, D6): nor fleets nor wrack
  for (let i = 0; i < ETHER_CHARTED_MAX + 3; i++) c.chartIsle(`${i % 4000},${Math.floor(i / 4000)}`);
  assert.equal(c.charted().length, ETHER_CHARTED_MAX, 'no more than the charts hold');
  const lines = Object.fromEntries(logLines({ ...newLog(), islands: 3, deepest: 12, legends: ['The Drowned Queen'] }));
  assert.deepEqual([lines['Eltheric isles charted'], lines['Deepest Eltheric waters'], lines['Legends ended']], ['3', '12 leagues past the Veil', 'The Drowned Queen']);   // PIN MOVED (ELTHERIC): 'Etheric'
  assert.equal(Object.fromEntries(logLines({ ...newLog(), deepest: 1 }))['Deepest Eltheric waters'], '1 league past the Veil');
});

test('ETHER-SEA the host\'s waters and charting: the band, the depth and the legend\'s haunt at a pixel (none off the sea); every isle within SIGHT_PX charted the first time and said - a port and a ruin by kind - and the deepest kept (mutants: the reach, the words, the depth)', () => {
  const { host, L, said } = hostOf();
  const h = veilhaven();
  assert.deepEqual(host.waters(500, 250), null);
  const w = host.waters(h.px, h.py);
  // PIN MOVED (AUDIT CAPTAIN'S SEA D18/D19): the haunt's legend was reckoned every frame and read nowhere - the waters say
  // whether she is in the Veil itself instead (the plate's "The Veil")
  assert.deepEqual([w.band, w.bandName, w.veil], ['shallows', 'the Shallows', false]);
  assert.equal(host.waters(VEIL_X + 4, h.py).veil, true, 'in the Veil');
  const q = hauntOf(legendById('queen'));
  assert.equal(host.waters(q.px, q.py).band, 'reaches');
  assert.equal(SIGHT_PX, 3);
  const fresh = host.sight(h.px + 3, h.py);
  assert.ok(fresh.some((i) => i.key === h.key), 'Veilhaven in sight');
  assert.ok(said.some((t) => t === 'Land ho! Veilhaven - a port. It is on your charts.'));
  assert.deepEqual(host.sight(h.px + 3, h.py), [], 'charted once');
  assert.equal(host.sight(500, 250).length, 0);
  assert.equal(L.log.deepest, Math.floor(etherDepthAt(h.px + 3)));
  const far = islesNear(h.px - 200, h.py, 40)[0];
  host.sight(far.px + 4, far.py);
  assert.equal(L.isCharted(far.key), false, 'four pixels off: not yet');
});

test('ETHER-SEA the strands: a wild isle\'s within HARVEST_REACH_PX a site of HARVEST_CASKS casks - its good by the band\'s STRAND_YIELD a cask, the strand bare HARVEST_DAYS from the first (mutants: the reach, the yield, the bare days, the kind)', () => {
  assert.equal(HARVEST_REACH_PX, 1); assert.equal(HARVEST_CASKS, 3); assert.deepEqual([...STRAND_YIELD], [2, 3, 4, 6]); assert.equal(HARVEST_DAYS, 7); assert.equal(STRAND_SITE, 'strand:');
  const { host, L, setDay } = hostOf({ day: 20 });
  const wild = wilds()[0];
  const sites = host.sites(wild.px + 1, wild.py);
  assert.deepEqual(sites.find((x) => x.id === `strand:${wild.key}`), { id: `strand:${wild.key}`, kind: 'strand', px: wild.px, py: wild.py, seed: wild.seed, n: 3 });
  assert.equal(host.sites(wild.px + 2, wild.py).some((x) => x.id === `strand:${wild.key}`), false, 'two off: not in reach');
  const r = host.gather(`strand:${wild.key}`);
  const g = goodOfTemplate(r.items[0].templateIndex);
  assert.equal(g.id, wild.good);
  const band = ['shallows', 'reaches', 'deep', 'abyss'].indexOf(wild.band);
  assert.equal(r.items[0].stackCount, STRAND_YIELD[band]);
  assert.match(r.text, new RegExp(`^${STRAND_YIELD[band]} ${g.units} of ${g.name.toLowerCase()} from the strand of `));
  assert.equal(L.gatheredDay(wild.key), 20);
  assert.equal(host.sites(wild.px, wild.py).some((x) => x.id === `strand:${wild.key}`), false, 'bare');
  setDay(26); assert.equal(host.sites(wild.px, wild.py).some((x) => x.id === `strand:${wild.key}`), false, 'six days: bare still');
  setDay(27); assert.equal(host.sites(wild.px, wild.py).some((x) => x.id === `strand:${wild.key}`), true, 'a week: grown again');
  assert.deepEqual(host.gather('strand:nope'), { items: [], text: '' });
  assert.deepEqual(host.gather('cache:1'), { items: [], text: '' });
  assert.deepEqual(host.sites(500, 250), []);
});

test('ETHER-SEA the legends\' host: the haunt\'s legend while she sails and is abroad; her end her purse and her day; the rumours from a port; a chart of the waters bought and a corsair\'s papers read - each isle once (mutants: the rise, the night, the purse, the price, the chance)', () => {
  const { host, L, mid, purse, setDay } = hostOf({ day: 40, gold: 1000 });
  const q = hauntOf(legendById('queen')), lan = hauntOf(legendById('lantern'));
  assert.equal(host.legendHere(q.px, q.py)?.id, 'queen');
  assert.equal(host.legendHere(lan.px, lan.py, { night: false }), null, 'the Lantern-Eater sails by night');
  assert.equal(host.legendHere(lan.px, lan.py, { night: true })?.id, 'lantern');
  assert.equal(host.legendEnded('queen', 'sink'), 3000);
  assert.equal(purse(), 4000);
  assert.match(mid.at(-1), /^The Drowned Queen is sunk! The Eltheric Ocean will speak of this\. 3,000 gold/);   // PIN MOVED (ELTHERIC): the Etheric Sea's
  assert.equal(L.legendDay('queen'), 40);
  assert.equal(host.legendHere(q.px, q.py), null, 'ended');
  setDay(70); assert.equal(host.legendHere(q.px, q.py)?.id, 'queen', 'risen');
  assert.equal(host.legendEnded('nobody', 'sink'), 0);
  const h = veilhaven();
  const rum = host.rumours({ px: h.px, py: h.py });
  assert.equal(rum.length, LEGENDS.length);
  const port = { px: h.px, py: h.py, ether: true, name: 'Veilhaven' };
  assert.deepEqual(CHART_BUY_PRICE, { base: 150, band: 75 }); assert.equal(CHART_BUY_PX, 40);
  const o = host.chartOffer(port);
  assert.equal(o.price, 150);
  const deepPort = { px: Math.round(VEIL_X - 50 * LEAGUE_PX), py: h.py, ether: true, name: 'X' };
  assert.equal(host.chartOffer(deepPort).price, 150 + 75 * 2, 'a band deeper, the dearer: the Deep Aether\'s');
  assert.equal(o.fresh, islesNear(h.px, h.py, CHART_BUY_PX).length);
  assert.equal(o.can, true);
  const got = host.buyChart(port);
  assert.equal(got.ok, true); assert.match(got.text, new RegExp(`${o.fresh} isles marked`));
  assert.equal(purse(), 4000 - 150);
  assert.equal(host.buyChart(port).ok, false, 'nothing new to mark');
  const office = host.office(port);
  // PIN MOVED (AUDIT CAPTAIN'S SEA X11): heard where the harbourmaster's tab is shown - the model's read hears nothing
  assert.deepEqual(L.heard(), [], 'the model read: nothing heard yet');
  office.hear();
  assert.deepEqual(L.heard(), LEGENDS.map((l) => l.id), 'the quay\'s talk: every legend heard of');
  assert.equal(office.port, 'Veilhaven'); assert.match(office.waters, /^the Shallows, \d+ leagues past the Veil$/);
  assert.equal(host.office({ ...port, ether: false }), null);
  assert.equal(PAPERS_CHANCE, 0.25); assert.equal(PAPERS_PX, 30);
  const { host: h2, L: L2 } = hostOf();
  const brig = classById('pirateBrig');
  let carried = 0;
  for (let seed = 1; seed <= 200; seed++) {
    const r = mulberry32(((seed >>> 0) ^ 0x9a9e) >>> 0);
    const has = r() < PAPERS_CHANCE;
    const n = h2.papers(brig, seed, h.px - 300, h.py);
    if (has) { carried++; assert.ok(L2.charted().length > 0, 'her chart marked (the first one\'s isles; the next ones none new)'); } else assert.equal(n, 0, 'no chart among her papers');
  }
  assert.ok(carried > 25 && carried < 80, `a quarter of them (${carried})`);
  const lucky = Array.from({ length: 200 }, (_, i) => i + 1).find((seed) => mulberry32(((seed >>> 0) ^ 0x9a9e) >>> 0)() < PAPERS_CHANCE);
  const { host: h3 } = hostOf();
  assert.equal(h3.papers(classById('merchantGalleon'), lucky, h.px - 300, h.py), 0, 'a trader carries none, whatever her stream');
  assert.ok(h3.papers(brig, lucky, h.px - 300, h.py) > 0, 'a corsair on the same seed does');
  assert.equal(hostOf().host.papers(brig, lucky, 500, 250), 0, 'none in the Bay');
});

test('ETHER-CHART the view\'s sums: a chart point to the canvas and back, a zoom about a point keeping it under the pointer, the view kept over the sea (mutants: each sum, the bounds)', () => {
  assert.deepEqual([...CHART_ZOOMS], [1, 2, 4, 8, 16]); assert.equal(CHART_ZOOM_DEFAULT, 2); assert.equal(LABEL_ZOOM, 8);
  const v = { cx: 5000, cy: -5000, zoom: 2 };
  assert.deepEqual(toScreen(v, 5000, -5000, 800, 600), [400, 300]);
  assert.deepEqual(toScreen(v, 5010, -4990, 800, 600), [440, 340]);
  const [px, py] = toChart(v, 123, 456, 800, 600);
  const [sx, sy] = toScreen(v, px, py, 800, 600);
  assert.ok(Math.abs(sx - 123) < 1e-9 && Math.abs(sy - 456) < 1e-9);
  const z = chartZoomAt(v, 1, 100, 100, 800, 600);
  assert.equal(z.zoom, 3);
  const before = toChart(v, 100, 100, 800, 600), after = toChart(z, 100, 100, 800, 600);
  assert.ok(Math.abs(before[0] - after[0]) < 1e-9 && Math.abs(before[1] - after[1]) < 1e-9, 'the point under the pointer kept');
  assert.equal(chartZoomAt({ ...v, zoom: 4 }, 1, 0, 0, 800, 600).zoom, 4, 'no deeper than the deepest');
  assert.equal(chartZoomAt({ ...v, zoom: 0 }, -1, 0, 0, 800, 600).zoom, 0);
  assert.deepEqual(clampChartView({ cx: -99999, cy: 99999, zoom: 1 }), { cx: ETHER_BOX.x0, cy: ETHER_BOX.y1, zoom: 1 });
});

test('ETHER-CHART the model: the charted isles in view (a port named at any zoom, the rest from LABEL_ZOOM), the bands\' bounds, the Veil, the ship, the haunts heard of (sunk, dimmed) - and the header\'s counts; an isle in words, its way from the ship (mutants: the filter, the labels, the bands, the haunt, the words)', () => {
  const h = veilhaven();
  const near = islesNear(h.px - 40, h.py, 30).filter((i) => i.kind !== 'port').slice(0, 3);
  const far = islesNear(h.px - 600, h.py, 40)[0];
  const word = { px: h.px + 4, py: h.py, yaw: 1, charted: [h.key, ...near.map((i) => i.key), '0,0', far.key], legends: [{ id: 'queen', name: 'The Drowned Queen', sails: false }], stats: { charted: 4, deepest: 12, crossings: 1, legends: 0 } };
  const m = chartModel(word, { cx: h.px, cy: h.py, zoom: 2 }, 1000, 700);
  assert.equal(m.isles.length, 1 + near.length, 'the charted in view; a key of no isle none, an isle far off the canvas none');
  assert.equal(m.isles.find((i) => i.key === h.key).label, true, 'a port named');
  assert.ok(m.isles.filter((i) => i.key !== h.key).every((i) => !i.label), 'the rest not at x4');
  const close = chartModel(word, { cx: h.px, cy: h.py, zoom: 3 }, 1000, 700);
  assert.ok(close.isles.filter((i) => i.key !== h.key).every((i) => i.label), 'at x8 every one');
  assert.ok(m.veil != null && m.veil > 500, 'the Veil to the east');
  assert.deepEqual([m.ship.x, m.ship.y, m.ship.yaw], [...toScreen({ cx: h.px, cy: h.py, zoom: 2 }, h.px + 4.5, h.py + 0.5, 1000, 700), 1]);
  assert.match(m.sub, /^4 isles charted - deepest 12 leagues past the Veil - 1 crossing$/);
  // PIN MOVED (AUDIT CAPTAIN'S SEA X12): the Shallows named by the Veil (no line of its own), each name on its deeper side
  const wide = chartModel(word, { cx: VEIL_X - 60 * LEAGUE_PX, cy: h.py, zoom: 0 }, 1000, 700);
  assert.deepEqual(wide.bands.map((b) => [b.name, b.line]), [['the Shallows', false], ['the Reaches', true], ['the Deep Aether', true], ['the Abyss', true]], 'the bounds in view');
  const shallow = chartModel(word, { cx: h.px, cy: h.py, zoom: 4 }, 400, 300);
  assert.deepEqual(shallow.bands, [], 'none in view about Veilhaven at x16');
  const q = hauntOf(legendById('queen'));
  const at = chartModel(word, { cx: q.px, cy: q.py, zoom: 1 }, 1000, 700);
  assert.deepEqual(at.haunts.map((t) => [t.name, t.sails, t.r]), [['The Drowned Queen', false, 36 * CHART_ZOOMS[1]]]);
  assert.equal(chartModel(word, { cx: h.px - 600, cy: h.py, zoom: 2 }, 1000, 700).veil, null, 'the Veil far off the canvas');
  assert.equal(wayWords({ px: 0, py: 0 }, { px: -Math.round(12 * LEAGUE_PX), py: 0 }), '12 leagues west');
  assert.equal(wayWords({ px: 0, py: 0 }, { px: 0, py: Math.round(LEAGUE_PX) }), '1 league south');
  assert.equal(wayWords({ px: 0, py: 0 }, { px: 1, py: 0 }), 'here');
  assert.match(isleWords(h, { px: h.px + Math.round(3 * LEAGUE_PX), py: h.py }), /^Veilhaven - a port - 3 leagues west$/);
});

test('ETHER-CHART the doors: the travel map\'s door opens the chart past the Veil; the freeport\'s harbourmaster\'s tab its rumours and its chart (mutants: the door, the tab\'s words)', () => {
  const src = read('src/scenes/world.js');
  assert.match(src, /\{ const p = playerTravelPixel\(\); if \(etherSea && inEther\(p\.x, p\.y\)\) return openEtherChart\(\); \}/);
  assert.match(src, /const word = \(\) => \{ const p = playerTravelPixel\(\); return \{ \.\.\.etherHost\.chart\(p\.x, p\.y, heading\(\)\), \.\.\.seaVentures\.chartWord\(\) \}; \};/);   // PIN MOVED (SEA-VAULTS): the open sea's fights and the day's vaults the sea's ventures' (scenes/seaVenturesHost.js chartWord)   // PIN MOVED (ETHER-WILD): the word says the open sea's fights, for the chart's peace   // PIN MOVED (AUDIT CAPTAIN'S SEA X16): the ship's heading at her helm
  assert.match(src, /const heading = \(\) => \{ const boat = csaRuntime\?\.isSailing\?\.\(\) \? csaRuntime\.state\.CurrentBoat : null; if \(!boat\) return cam\.yaw; const f = boatForward\(boat, cam\.yaw\); return Math\.atan2\(f\[0\], f\[2\]\); \};/);   // PIN MOVED (HOST-SPLIT at the merge of main into SEA VENTURES): boatForward out of bootWorld, the camera's yaw its argument
  const door = read('src/ui/naval/navalPlunderDoor.js');
  assert.match(door, /load: \(\) => import\('\.\.\/etherChartWindow\.js'\),/);
  const o = { ether: true, port: 'Veilhaven', waters: 'the Shallows, 7 leagues past the Veil', rumours: ['A tale.', 'Another.'], charted: 1, chart: { price: 150, fresh: 12, can: true, why: '' } };
  const t = officeText(o);
  assert.deepEqual(t, etherOfficeText(o));
  // PIN MOVED (ELTHERIC): the Etheric Sea's
  assert.equal(t.lede, 'Veilhaven - a freeport of the Eltheric Ocean, in the Shallows, 7 leagues past the Veil. No crown\'s writ runs past the Veil, and no crown\'s favors. Your charts hold 1 isle.');
  assert.deepEqual(t.board.map((b) => [b.title, b.words, b.press]), [['Talk on the quay', 'A tale.', ''], ['Talk on the quay', 'Another.', '']]);
  assert.deepEqual(t.letters, [{ id: 'chart', title: 'A chart of these waters', words: '12 isles your charts do not hold, marked on them.', press: 'Buy - 150 gold', can: true }]);
  assert.deepEqual(t.heads.board, ['The quay\'s talk', 'the legends of these waters']);
  const none = etherOfficeText({ ...o, chart: { price: 150, fresh: 0, can: false, why: 'Every isle in these waters is already on your charts.' } });
  assert.equal(none.letters[0].words, 'Every isle in these waters is already on your charts.');
});
