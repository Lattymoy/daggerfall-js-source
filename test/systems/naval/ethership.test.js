// ETHER-SHIPS, ETHER-LEGENDS (2026-10-11, the owner: "deadly legendary ships") - THE ELTHERIC OCEAN'S SHIPS
// (bible/03-World/Eltheric-Ocean.md): its corsairs and its isles' traders - the Bay's classes under the sea's names and the
// Isles' colours, drawn by the band, no crown's navy and no crown's law - and its six legends, each her own class, haunt,
// terror and purse; the director's traffic past the Veil and the host's seams. tools/mutants/ethership.json.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  ISLES_FLAG, ETHER_PIRATE_NAMES, ETHER_MERCHANT_NAMES, etherShipNames, etherFlagOf, ETHER_FACTION_WEIGHTS, ETHER_PORT_WEIGHTS, etherFactionWeights,
  LEGENDS, LEGEND_RISE_DAYS, LEGEND_CHANCE, LEGEND_SALT, LEGEND_MEND_PER_S, LEGEND_MEND_QUIET_S, LEGEND_VEIL_K, HAUNT_PX, HAUNT_SPREAD, ABYSS_HAUNT_LEAGUES,
  legendById, legendOfClass, legendClass, hauntOf, legendSails, legendAt, legendAbroad, rumourOf,
} from '../../../src/systems/naval/etherShips.js';
import { SHIP_CLASSES, LEGEND_LEVEL, classById, classFor, shipNames, HULL } from '../../../src/systems/naval/navalShips.js';
import { createNavalDirector, encounterClasses } from '../../../src/systems/naval/navalDirector.js';
import { rangeOfHull } from '../../../src/systems/naval/navalAI.js';
import { BANDS, VEIL_X, LEAGUE_PX, veilhaven, etherDepthAt, etherBandOf, inEther } from '../../../src/world/ethericSea.js';
import { coloursWords } from '../../../src/systems/naval/shipKnowledge.js';
import { etherWatersWords, navalHudText } from '../../../src/ui/naval/navalHud.js';
import { mulberry32 } from '../../../src/combat/blood/bloodArt.js';
import { sea } from '../../navalSea.mjs';

const read = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const reaches = { band: 'reaches', bandName: 'the Reaches', depth: 20, legend: null };

test('ETHER-LEGENDS the six: two to a band past the Shallows, each her own class of navalShips.js flagged `legend` - never drawn (LEGEND_LEVEL past any captain\'s, no weight): not by level, not as an encounter, not as a board\'s bounty or a raider; a pirate\'s faction, never a flagship; no hull\'s fighting range moved (mutants: the level, the weight, the flag, each class)', () => {
  assert.equal(LEGENDS.length, 6);
  assert.deepEqual(LEGENDS.map((l) => [l.id, l.band]), [['wake', 'reaches'], ['queen', 'reaches'], ['hunger', 'deep'], ['lantern', 'deep'], ['regent', 'abyss'], ['starless', 'abyss']]);
  assert.deepEqual(LEGENDS.map((l) => l.trait), ['swift', 'mends', 'boarders', 'night', 'gunnery', 'veiled']);
  assert.ok(LEGENDS.every((l, i) => i === 0 || l.purse >= LEGENDS[i - 1].purse), 'the deeper, the richer');
  assert.equal(LEGEND_LEVEL, 999);
  for (const l of LEGENDS) {
    const c = classById(l.classId);
    assert.ok(c, l.id);
    assert.equal(legendClass(l), c); assert.equal(legendOfClass(c.id), l); assert.equal(legendById(l.id), l);
    assert.deepEqual([c.faction, c.legend, c.flagship, c.weight, c.minLevel, c.cargo], ['pirate', true, false, 0, LEGEND_LEVEL, 4]);
  }
  assert.equal(SHIP_CLASSES.filter((c) => c.legend).length, 6);
  assert.ok(SHIP_CLASSES.filter((c) => !c.legend).every((c) => c.legend === false), 'every other class says it is none');
  for (let lv = 1; lv <= 200; lv += 7) for (let i = 0; i < 40; i++) {
    const r = (i + 0.5) / 40;
    for (const f of ['pirate', 'merchant', 'navy']) assert.ok(!classFor(f, lv, r)?.legend, `classFor(${f}, ${lv}, ${r})`);
  }
  for (let i = 0; i < 50; i++) {
    const pair = encounterClasses(i % 2 ? 'plunder' : 'patrol', 150, mulberry32(i));
    assert.ok(!pair?.hunter?.legend && !pair?.quarry?.legend, 'no legend in a pair');
  }
  for (const hull of [HULL.SmallShip, HULL.LargeGalley, HULL.Carrack]) {
    const drawn = Math.min(...SHIP_CLASSES.filter((c) => c.hull === hull && !c.legend).map((c) => c.range));
    assert.equal(rangeOfHull(hull), drawn, `hull ${hull}: a legend\'s range moves no hull\'s`);
  }
  const wake = classById('legendWake');
  assert.ok(wake.speed > Math.max(...SHIP_CLASSES.filter((c) => !c.legend).map((c) => c.speed)), 'Sorrow\'s Wake: the swiftest hull afloat');
  assert.ok(classById('legendStarless').hullHp > classById('legendRegent').hullHp && classById('legendRegent').hullHp > classById('pirateFlagship').hullHp);
  assert.ok(classById('legendHunger').boarders >= 45 && classById('legendHunger').crew >= 120, 'the Hunger\'s hands');
  assert.ok(classById('legendRegent').skill >= 0.95, 'gunners who do not miss');
});

test('ETHER-SHIPS the names and colours: a corsair\'s and a trader\'s the Eltheric Ocean\'s own lists, on their own stream - her captain the Bay\'s own law\'s, unmoved; a legend\'s her own; a trader flies the Isles\' colours, a corsair and a legend the black flag; the glass reads "the Isles\' merchant colors" (mutants: the lists, the stream, the captain, the flag, the possessive)', () => {
  const pirate = classById('pirateBrig'), trader = classById('merchantGalleon');
  for (let seed = 1; seed < 40; seed++) {
    const p = etherShipNames(pirate, seed), t = etherShipNames(trader, seed);
    assert.ok(ETHER_PIRATE_NAMES.includes(p.name)); assert.ok(ETHER_MERCHANT_NAMES.includes(t.name));
    assert.equal(p.captain, shipNames(pirate, seed, { regionIndex: 17 }).captain, 'her captain the Bay\'s law\'s');
    assert.equal(p.crown, null);
  }
  const names = new Set(Array.from({ length: 60 }, (_, i) => etherShipNames(pirate, i * 977).name));
  assert.ok(names.size > 10, 'the stream spreads them');
  assert.deepEqual(etherShipNames(classById('legendQueen'), 5), { name: 'The Drowned Queen', captain: 'Maraveth, Thrice Drowned', crown: null });
  assert.equal(ISLES_FLAG, 'the Isles');
  assert.equal(etherFlagOf(trader), 'the Isles'); assert.equal(etherFlagOf(pirate), null); assert.equal(etherFlagOf(classById('legendWake')), null);
  assert.equal(coloursWords('merchant', ISLES_FLAG), 'the Isles\' merchant colors');
  assert.equal(coloursWords('merchant', 'Wayrest'), 'Wayrest\'s merchant colors', 'the crowns\' as ever');
  assert.equal(coloursWords('navy', 'Sentinel'), 'Sentinel\'s royal ensign');
});

test('ETHER-SHIPS the traffic\'s weights: corsairs and traders alone - no navy past the Veil - the band\'s `pirate` on the corsairs; a port\'s waters the traders\' (mutants: the band\'s weight, the port\'s, the navy\'s absence)', () => {
  assert.deepEqual({ ...ETHER_FACTION_WEIGHTS }, { pirate: 30, merchant: 45 });
  for (const b of BANDS) assert.deepEqual(etherFactionWeights(b), { pirate: 30 * b.pirate, merchant: 45 });
  const port = etherFactionWeights(BANDS[2], { nearPort: true });
  assert.deepEqual(port, { pirate: 30 * BANDS[2].pirate * ETHER_PORT_WEIGHTS.pirateK, merchant: 45 + ETHER_PORT_WEIGHTS.merchant });
  assert.equal('navy' in etherFactionWeights(BANDS[0]), false);
});

test('ETHER-LEGENDS the haunts: each legend\'s off her own hash - in her band\'s depths, HAUNT_PX inside its bounds, within its HAUNT_SPREAD of Veilhaven\'s row; legendAt the nearest within HAUNT_PX; she sails until ended and LEGEND_RISE_DAYS after; the Lantern-Eater abroad by night alone (mutants: the depths, the spread, the reach, the rise, the night)', () => {
  assert.equal(HAUNT_PX, 36); assert.deepEqual({ ...HAUNT_SPREAD }, { reaches: 60, deep: 160, abyss: 320 }); assert.equal(ABYSS_HAUNT_LEAGUES, 120);
  const row = veilhaven().py;
  for (const l of LEGENDS) {
    const h = hauntOf(l);
    assert.equal(hauntOf(l), h, 'kept');
    assert.ok(inEther(h.px, h.py));
    const band = BANDS.find((b) => b.id === l.band), next = BANDS[BANDS.indexOf(band) + 1];
    const d = etherDepthAt(h.px), margin = HAUNT_PX / LEAGUE_PX;
    assert.ok(d >= band.from + margin - 0.2 && d <= (next ? next.from : band.from + ABYSS_HAUNT_LEAGUES) - margin + 0.2, `${l.name} haunts ${band.id} (${d.toFixed(1)})`);
    assert.equal(etherBandOf(d).id, l.band);
    assert.ok(Math.abs(h.py - row) <= HAUNT_SPREAD[l.band], `${l.name} near Veilhaven's row`);
    // PIN MOVED (AUDIT CAPTAIN'S SEA H7): `x === (l.id === x ? l.id : x)` held for any answer - a haunt's centre is hers
    assert.equal(legendAt(h.px, h.py)?.id, l.id, 'her haunt\'s centre hers');
    assert.ok(legendAt(h.px + HAUNT_PX, h.py), 'the haunt\'s edge');
  }
  // AUDIT CAPTAIN'S SEA H7: where two haunts reach a pixel, the nearer's (the Wake's and the Queen's overlap)
  const wk = hauntOf(legendById('wake')), qn = hauntOf(legendById('queen'));
  const cheb = (a, x, y) => Math.max(Math.abs(a.px - x), Math.abs(a.py - y));
  let both = 0;
  for (let y = Math.min(wk.py, qn.py); y <= Math.max(wk.py, qn.py); y++) {
    const x = Math.round((wk.px + qn.px) / 2), dw = cheb(wk, x, y), dq = cheb(qn, x, y);
    if (dw > HAUNT_PX || dq > HAUNT_PX || dw === dq) continue;
    both++;
    assert.equal(legendAt(x, y)?.id, dq < dw ? 'queen' : 'wake', `(${x}, ${y}): the nearer haunt's`);
  }
  assert.ok(both >= 2, `pixels both haunts reach (${both})`);
  const q = hauntOf(legendById('queen'));
  assert.equal(legendAt(q.px, q.py)?.id, 'queen');
  assert.equal(legendAt(VEIL_X + 5, row), null, 'none in the Veil');
  assert.equal(legendAt(500, 250), null, 'none in the Bay');
  assert.equal(LEGEND_RISE_DAYS, 30);
  assert.equal(legendSails(null, 5), true); assert.equal(legendSails(10, 39), false); assert.equal(legendSails(10, 40), true);
  assert.equal(legendAbroad(legendById('lantern'), { night: false }), false); assert.equal(legendAbroad(legendById('lantern'), { night: true }), true);
  assert.equal(legendAbroad(legendById('queen'), { night: false }), true);
});

test('ETHER-LEGENDS the rumours: where each was last seen from the port - leagues and the sixteen points, "By night" for the Lantern-Eater - or, ended, how long ago she went down and that the aether will raise her (mutants: the words, the way, the days)', () => {
  const h = hauntOf(legendById('wake'));
  const from = { px: h.px + Math.round(20 * LEAGUE_PX), py: h.py };
  assert.equal(rumourOf(legendById('wake'), from), 'Sorrow\'s Wake has been seen some 20 leagues west of here.');
  const north = { px: h.px, py: h.py + Math.round(8 * LEAGUE_PX) };
  assert.equal(rumourOf(legendById('wake'), north), 'Sorrow\'s Wake has been seen some 8 leagues north of here.');
  const l = hauntOf(legendById('lantern'));
  assert.match(rumourOf(legendById('lantern'), { px: l.px, py: l.py - Math.round(5 * LEAGUE_PX) }), /^The Lantern-Eater has been seen some 5 leagues south of here\. By night\.$/);
  assert.equal(rumourOf(legendById('queen'), from, { endedDay: 10, day: 12 }), 'The Drowned Queen went down 2 days ago; they say the aether will raise it again.');
  assert.match(rumourOf(legendById('queen'), from, { endedDay: 10, day: 10 }), /went down today/);
  assert.match(rumourOf(legendById('queen'), from, { endedDay: 10, day: 11 }), /went down yesterday/);
  assert.match(rumourOf(legendById('queen'), from, { endedDay: 10, day: 40 }), /has been seen/, 'risen');
});

test('ETHER-SHIPS the director past the Veil: corsairs and traders alone, every class the band\'s levels up, every spec the sea\'s; a pair only a corsair on a trader; no relief; a legend in her haunt on LEGEND_CHANCE of her own stream, never two of her (mutants: the factions, the level, the spec, the pair, the relief, the legend\'s chance and her one)', () => {
  const ctx = (o = {}) => ({ density: 4, player: [0, 0, 0], players: [[0, 0, 0]], level: 3, ships: [], isOpenWater: () => true, nearPort: false, notoriety: 0, seedBase: 1, seaY: 0, ether: { band: BANDS[1], legend: null }, ...o });
  const factions = new Map(), levels = [];
  let pairs = 0;
  for (let i = 0; i < 200; i++) {
    const d = createNavalDirector({ random: () => 0 });
    const out = d.step(100, ctx({ seedBase: i * 7919 + 3 }));
    const sp = out.spawn;
    if (!sp) continue;
    assert.equal(sp.ether, 'reaches', 'the sea\'s');
    factions.set(classById(sp.classId).faction, (factions.get(classById(sp.classId).faction) ?? 0) + 1);
    if (!sp.encounter) levels.push(classById(sp.classId).minLevel);
    if (sp.encounter) { pairs++; assert.equal(sp.encounter, 'plunder'); assert.equal(sp.company.ether, 'reaches'); }
  }
  assert.deepEqual([...factions.keys()].sort(), ['merchant', 'pirate'], 'no navy');
  assert.ok(pairs > 0, 'pairs at it');
  assert.ok(levels.some((l) => l > 3), 'classes past the captain\'s own level - the band\'s');
  assert.equal(LEGEND_CHANCE, 0.3); assert.equal(LEGEND_SALT, 0x1e6e);
  let legends = 0, rolls = 0;
  for (let i = 0; i < 200; i++) {
    const d = createNavalDirector({ random: () => 0 });
    const seedBase = i * 104729 + 11;
    const out = d.step(100, ctx({ seedBase, ether: { band: BANDS[1], legend: { id: 'queen', classId: 'legendQueen' } } }));
    rolls++;
    if (out.spawn?.legend) {
      legends++;
      assert.deepEqual([out.spawn.classId, out.spawn.legend, out.spawn.ether], ['legendQueen', 'queen', 'reaches']);
      const toward = Math.atan2(-out.spawn.pos[0], -out.spawn.pos[2]);
      assert.ok(Math.abs(Math.atan2(Math.sin(toward - out.spawn.yaw), Math.cos(toward - out.spawn.yaw))) < 1e-6, 'her bow on the captain');
    }
  }
  assert.ok(legends > rolls * 0.15 && legends < rolls * 0.45, `about LEGEND_CHANCE of the rolls (${legends}/${rolls})`);
  const want = { band: BANDS[1], legend: { id: 'queen', classId: 'legendQueen' } };
  const lucky = Array.from({ length: 200 }, (_, i) => i * 104729 + 11).find((seedBase) => createNavalDirector({ random: () => 0 }).step(100, ctx({ seedBase, ether: want })).spawn?.legend);
  const one = createNavalDirector({ random: () => 0 }).step(100, ctx({ seedBase: lucky, ships: [{ id: 'q', pos: [0, 0, 500], classId: 'legendQueen', afloat: true }], ether: want }));
  assert.ok(!one.spawn?.legend, 'never two of her - on a roll that launches her when she is not at sea');
  const relief = createNavalDirector({ random: () => 0 }).step(100, ctx({ distress: [0, 0, 0], reliefSure: true, density: 1 }));
  assert.ok(!relief.spawn?.relief, 'no navy to answer past the Veil');
});

test('ETHER-SHIPS at sea: a ship launched in the Eltheric Ocean\'s waters wears its names and colours, a corsair the band\'s boldness; a legend her own name, bold, announced; her end no crime and no crown\'s - the log\'s by her trade, a legend\'s purse and her day, a corsair\'s papers read; the plate says the band and the leagues (mutants: each seam)', async () => {
  const s = await sea({ hull: 2, where: { ether: reaches, region: 19 } });
  const deeds = [], events = [], ended = [], papers = [];
  const crimes = [];
  s.deps.law = { crime: (r, c) => crimes.push([r, c]), legal() {}, faction() {} };
  s.deps.captain = { deed: (act, cls, o) => { deeds.push([act, cls.id, o]); return []; }, event: (ev) => events.push(ev), sites: () => [] };
  s.deps.ether = { legendEnded: (id, act) => ended.push([id, act]), papers: (cls, seed) => papers.push([cls.id, seed]), legendHere: () => null, gather: () => ({ items: [], text: '' }) };
  const tid = s.host.spawnShip('merchantGalleon', { range: 400, temper: 'peaceful' });
  const trader = s.host._sea.get(tid);
  assert.ok(ETHER_MERCHANT_NAMES.includes(trader.ship.names.name), 'the sea\'s name');
  assert.equal(trader.ship.flag, ISLES_FLAG);
  assert.equal(trader.ether, 'reaches');
  s.host._charge('sink', tid);
  assert.deepEqual(crimes, [], 'no crime past the Veil');
  assert.deepEqual(deeds[0], ['sink', 'merchantGalleon', { trade: 'ether', legend: null }]);
  assert.deepEqual(events.find((e) => e.type === 'end'), { type: 'end', act: 'sink', faction: 'merchant', crown: null, bounty: null });
  assert.equal(s.host.notorietyOf?.('Wayrest') ?? 0, 0, 'no notoriety');
  const cid = s.host.spawnShip('pirateBrig', { range: 500 });
  s.host._charge('board', cid);
  assert.deepEqual(papers.map((p) => p[0]), ['pirateBrig'], 'a corsair\'s papers read');
  const lid = s.host.spawnShip('legendQueen', { range: 600 });
  const queen = s.host._sea.get(lid);
  assert.deepEqual([queen.ship.names.name, queen.legend, queen.ship.temper, queen.ship.flag], ['The Drowned Queen', 'queen', 'bold', null]);
  assert.ok(s.log.mid.some((t) => t.startsWith('The sea goes still. A sail on the horizon: The Drowned Queen.')), 'she is announced');
  s.host._charge('sink', lid);
  assert.deepEqual(ended, [['queen', 'sink']]);
  assert.deepEqual(deeds.at(-1), ['sink', 'legendQueen', { trade: 'legend', legend: 'The Drowned Queen' }]);
  assert.equal(etherWatersWords({ bandName: 'the Reaches', depth: 20.4 }), 'The Reaches, 20 leagues past the Veil');
  assert.equal(etherWatersWords({ bandName: 'the Shallows', depth: 0.6 }), 'The Shallows, 1 league past the Veil');
  const t = navalHudText({ ...s.host.hudModel?.() ?? {}, ship: { name: 'Galleon', hull: 1, sail: 1, crew: 1, spirits: null, order: null }, notoriety: { crown: 'Wayrest', level: 3 }, ether: { bandName: 'the Reaches', depth: 20 }, batteries: [] });
  assert.match(t.plate.waters, /^The Reaches, 20 leagues past the Veil/);
  assert.equal(t.plate.anchors, 0, 'no crown\'s anchors past the Veil');
});

test('ETHER-LEGENDS her terrors at sea: the Drowned Queen\'s timbers knit while no ball strikes her (her fires out first), the Starless made out at LEGEND_VEIL_K of every reach (mutants: the mend\'s rate, its quiet, the veil\'s share)', async () => {
  assert.equal(LEGEND_MEND_PER_S, 0.004); assert.equal(LEGEND_MEND_QUIET_S, 8); assert.equal(LEGEND_VEIL_K, 0.35);
  const s = await sea({ hull: 2, where: { ether: { ...reaches, band: 'abyss', bandName: 'the Abyss', depth: 200 } } });
  const qid = s.host.spawnShip('legendQueen', { range: 900, temper: 'peaceful' });
  const q = s.host._sea.get(qid).ship;
  q.damage.apply({ hull: Math.round(q.damage.maxHull * 0.5) }, 0);
  const hurt = q.damage.hull;
  assert.ok(hurt < q.damage.maxHull, 'hurt');
  s.run(5);
  assert.equal(q.damage.hull, hurt, 'nothing knits in the first quiet seconds');
  s.run(10);
  assert.ok(q.damage.hull > hurt, 'her timbers knit');
  const host = read('src/scenes/naval/navalHost.js');
  assert.match(host, /if \(legendOfClass\(s\.cls\.id\)\?\.trait !== 'mends' \|\| s\.damage\.state !== SHIP_STATES\.afloat \|\| s\.damage\.fire > 0\) return;/);
  assert.match(host, /if \(clock - s\.damage\.lastHitAt < LEGEND_MEND_QUIET_S \|\| s\.damage\.hull >= s\.damage\.maxHull\) return;/);
  assert.match(host, /s\.damage\.repair\(\{ hull: s\.damage\.maxHull \* LEGEND_MEND_PER_S \* d, sail: 0, crew: 0 \}\);/);
  assert.match(host, /const reach = reachOf\(e, glassReach\(\{ night, lit: showsLight\(e\), sight, lookout \}\)\);/, 'the knowledge step');
  assert.match(host, /const reach = reachOf\(e, glassReach\(\{ night: !!where\(\)\.night, lit: showsLight\(e\), sight, lookout \}\)\);/, 'the glass\'s card');
  assert.match(host, /\? \{ far: reach\.far \* LEGEND_VEIL_K, near: reach\.near \* LEGEND_VEIL_K, eye: reach\.eye \* LEGEND_VEIL_K, lookout: reach\.lookout \* LEGEND_VEIL_K \} : reach\);/);
  assert.match(host, /legendOfClass\(e\.ship\.cls\.id\)\?\.trait === 'veiled'/);
});

test('ETHER-SHIPS the strands at sea: a wild isle\'s site floats its casks out within reach (the world\'s sites, kind `strand`), and a cask hauled is the world\'s gather - its good into the hold of the boat that sailed through it, said (mutants: the kind, the haul\'s branch, the gift)', async () => {
  const s = await sea({ hull: 2, where: { ether: reaches } });
  const gathered = [];
  const sites = [{ id: 'strand:300,200', kind: 'strand', px: 100, py: 101, seed: 99, n: 3 }];
  s.deps.captain = { event() {}, sites: () => sites };
  s.deps.sitePoint = () => [0, 0, 120];
  s.deps.ether = { gather: (id) => { gathered.push(id); return { items: [{ name: 'starglass' }], text: '3 shards of starglass from the strand of X.' }; } };
  s.run(1.2);
  const casks = s.host._shots.floaters().filter((f) => f.lot === 'site:strand:300,200');
  assert.equal(casks.length, 3, 'its casks afloat');
  assert.ok(s.log.say.includes('Your boat goes ashore and comes back with its haul. The casks float alongside.'));
  s.host._shots.floater(casks[0].id).pos = [0, 0, 0];
  s.run(0.3);
  assert.deepEqual(gathered, ['strand:300,200']);
  assert.ok(s.log.given.some(([n]) => n === 1), 'into her hold');
  assert.ok(s.log.say.includes('You haul a cask aboard: 3 shards of starglass from the strand of X.'));
});

test('ETHER-SHIPS by source: the director told the sea (its band and its legend), the crown\'s waters none past the Veil, a ship of the sea launched under its own names and colours; the world\'s door to the legends, the papers and the strands (mutants: each seam)', () => {
  const host = read('src/scenes/naval/navalHost.js');
  assert.match(host, /ether: etherCtx\(w\),/);
  assert.match(host, /const l = deps\.ether\?\.legendHere\?\.\(w\.px, w\.py, \{ night: !!w\.night \}\) \?\? null;/);
  assert.match(host, /return \{ band, legend: l \? \{ id: l\.id, classId: l\.classId \} : null \};/, 'her class to the director');
  assert.match(host, /else if \(ether && cls\.faction === 'pirate'\) ship\.temper = temperOf\(cls, spec\.seed, \{ bold: etherBold\(ether\) \}\);/, 'the band\'s boldness');
  assert.match(host, /if \(legend\) ship\.temper = TEMPERS\.bold;/, 'a legend fears nothing');
  assert.match(host, /const distress = relieving \|\| w\.ether \? null : distressAt\(crown\.name\);/);
  assert.match(host, /const watersCrown = \(\) => \{ const w = where\(\); return w\.ether \? null : crownOf/);
  assert.match(host, /if \(entry\.ether\) \{ chargeEther\(act, entry\); return; \}/);
  assert.match(host, /const names = ether \? etherShipNames\(cls, spec\.seed\) : shipNames\(cls, spec\.seed, \{ regionIndex: region, crown \}\);/);
  assert.match(host, /const etherTier = \(entry\) => \(entry\.ether \? BANDS\.find\(\(b\) => b\.id === entry\.ether\)\?\.tier \?\? 0 : 0\);/, 'her hold the band\'s tiers richer');
  assert.match(host, /deps\.hold\?\.\(key, tier \+ \(entry\.deep \? DEEP_TIER : 0\) \+ etherTier\(entry\)\)/);
  assert.match(host, /deep: !!entry\.deep \|\| !!entry\.ether \}\);/, 'her casks the deep\'s');
  const world = read('src/scenes/world.js');
  assert.match(world, /legendHere: \(px, py, o\) => etherHost\.legendHere\(px, py, o\),/);
  assert.match(world, /sites: \(\) => \{ const p = playerTravelPixel\(\); return etherSea && inEther\(p\.x, p\.y\) \? \[\.\.\.harbourOffice\.sites\(\), \.\.\.etherHost\.sites\(p\.x, p\.y\)\] : harbourOffice\.sites\(\); \},/);
  assert.match(world, /waters: ether \? 'ether' : watersOf\(\{ nearPort, portPx: navalPortPx\(\) \}\), ether,/);
});
