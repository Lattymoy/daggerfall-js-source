// WW-C1 (2026-10-24, bible/03-World/World-Wide.md WW-C; the owner: "Each region becomes home to their own abundant
// harvesting resources with other resources sprinkled in. ... Cryodil will be home to all abundent resources") - THE
// PROVINCES' GROUND: each province past the Bay rich in its own kinds and ore (net/provinceNodes.js), Cyrodiil in every
// one, on ground the witnesses confirmed; the nodes' law's ground the world's whole grid (net/nodeLaw.js pixelOk), and a
// province never claimed on the Bay's own map (regionOnPixel). One slot law both ends read (nodeSlots).
import '../../chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { standService, T0 } from '../../accountDb.mjs';
import { harvestNode } from '../../../server-account/src/professions.js';
import {
  nodeSlots, veinSlots, treeSlots, veins, trees, herbPatches, boulders, vein, tree, regionSignature, veinTable, pixelOk,
  regionOnPixel, nodeKey, NODE_COUNTS, VEIN_TABLES, WOOD_TABLES, HERB_TABLES, RARE_WOODS, UNCONFIRMED_VEIN_TIER, JUNGLE_TREE_SLOTS,
  pixelKey, pixelReport, WITNESS,
} from '../../../src/net/nodeLaw.js';
import { PROVINCE_GROUND, PROVINCE_ORE_SLOTS, CYRODIIL_CLIMATE, RICH_KINDS, richness, provinceOres, richClimates } from '../../../src/net/provinceNodes.js';
import { CLIMATES, CYRODIIL_REGION, regionOfTheatre, PROVINCE_REGION_NAMES, BAY_REGION_COUNT } from '../../../src/formats/mapsTables.js';
import { PROVINCES } from '../../../src/world/tamriel/tamrielGeography.js';
import { THEATRE_KEYS } from '../../../src/world/worldWide/worldGrid.js';
import { minedMaterial } from '../../../src/net/professionLaw.js';
import { utcDay } from '../../../src/net/marksLaw.js';
import { BANTHA_AREA_ROWS } from '../../../src/world/jungle/banthaArea.js';

const NOW = T0;
const TODAY = utcDay(NOW);
const C = CLIMATES;
const PROVINCE_REGIONS = PROVINCE_REGION_NAMES.map((_, i) => regionOfTheatre(i + 1));
/** A pixel of Cyrodiil's (the Imperial Province's - theatre 9), well inside it. */
const CX = 2400, CY = 900;
const days = (n, from = 20500) => Array.from({ length: n }, (_, i) => from + i);
const tierOf = (k) => minedMaterial(k)?.tier ?? 0;

test('WW-C1 the provinces\' ground: each province\'s climate is the map\'s, its richness its own kinds\', its own ore - Cyrodiil the richest of every kind, every province\'s ore once (mutants: a climate not the map\'s; Cyrodiil one province\'s)', () => {
  // the climates the table names are the provinces' own (world/tamriel/tamrielGeography.js PROVINCES), Cyrodiil's the Imperial Province's
  for (const r of PROVINCE_REGIONS) {
    const key = THEATRE_KEYS[r - BAY_REGION_COUNT + 1];
    const climate = PROVINCES.find((p) => p.key === key)?.climate;
    assert.equal(r === CYRODIIL_REGION ? CYRODIIL_CLIMATE : PROVINCE_GROUND[r].climate, climate, `${key}: the map's climate`);
  }
  assert.equal(Object.keys(PROVINCE_GROUND).length, 8, 'every province but Cyrodiil, whose ground is all of theirs');
  for (const g of Object.values(PROVINCE_GROUND)) {
    assert.ok(Object.keys(g.rich).length >= 1 && Object.keys(g.rich).every((k) => RICH_KINDS.includes(k) && g.rich[k] >= 2), 'rich in a kind of the four, at least twice');
    assert.ok(Object.keys(g.rich).every((k) => NODE_COUNTS[g.climate][k] > 0), 'and in a kind its climate stands at all');
    if (g.ore) assert.ok(minedMaterial(g.ore), `${g.ore} is a mined material`);
  }
  for (const kind of RICH_KINDS) {
    const top = Math.max(...Object.values(PROVINCE_GROUND).map((g) => g.rich[kind] ?? 1));
    assert.equal(richness(CYRODIIL_REGION, kind), top, `Cyrodiil's ${kind}: the richest province's`);
    for (let r = 0; r < BAY_REGION_COUNT; r++) assert.equal(richness(r, kind), 1, 'a Bay region is as it was');
  }
  assert.deepEqual([richness(regionOfTheatre(6), 'tree'), richness(regionOfTheatre(6), 'vein')], [4, 1], 'Valenwood: four times the trees, its veins sprinkled');
  assert.deepEqual(provinceOres(regionOfTheatre(3)), Array(PROVINCE_ORE_SLOTS).fill('ore:orichalcum'), 'Skyrim\'s own ore, twice');
  assert.deepEqual(provinceOres(regionOfTheatre(6)), [], 'Valenwood holds no ore of its own');
  assert.deepEqual(provinceOres(CYRODIIL_REGION), Object.values(PROVINCE_GROUND).map((g) => g.ore).filter(Boolean), 'Cyrodiil: every province\'s ore, once');
  assert.equal(provinceOres(CYRODIIL_REGION).length, 6);
  assert.deepEqual(provinceOres(17), [], 'a Bay region\'s is its crown\'s (regionSignature)');
  assert.deepEqual(richClimates(regionOfTheatre(3), 'vein', C.Mountain), [C.Mountain], 'a province draws its own climate\'s tables');
  assert.deepEqual(richClimates(CYRODIIL_REGION, 'tree', C.Woodlands), [C.Woodlands, C.Subtropical, C.Rainforest, C.Swamp], 'Cyrodiil every forest province\'s');
});

test('WW-C1 one slot law: a confirmed province pixel stands its richness times its climate\'s, its ores beside its veins; unconfirmed its climate\'s alone; the Bay and the jungle as they were (mutants: richness on unconfirmed ground; the ores unconfirmed; the jungle multiplied)', () => {
  const W = C.Woodlands;
  const at = (kind, region, confirmed, climate = W, x = CX, y = CY) => nodeSlots(kind, { x, y, climate, region, confirmed });
  // the Bay: Daggerfall's veins its four and its Moonstone's two, as AUDIT 29 A6 stood them
  assert.deepEqual(['tree', 'herb', 'vein', 'boulder'].map((k) => at(k, 17, true, W, 300, 200)), [12, 8, 6, 3]);
  // Cyrodiil, confirmed: every kind the richest, and six ores
  assert.deepEqual(['tree', 'herb', 'vein', 'boulder'].map((k) => at(k, CYRODIIL_REGION, true)), [12 * 4, 8 * 4, 4 * 3 + 6, 3 * 2]);
  // unconfirmed: the climate's alone - the province is the claim a lie is worth most on
  assert.deepEqual(['tree', 'herb', 'vein', 'boulder'].map((k) => at(k, CYRODIIL_REGION, false)), [12, 8, 4, 3]);
  assert.deepEqual(['tree', 'herb', 'vein', 'boulder'].map((k) => at(k, null, true)), [12, 8, 4, 3], 'no region named: the climate\'s');
  // Skyrim: its veins three times the Mountain's and its Orichalcum twice; its trees sprinkled
  assert.deepEqual(['tree', 'vein', 'boulder'].map((k) => at(k, regionOfTheatre(3), true, C.Mountain)), [4, 12 * 3 + 2, 5 * 2]);
  // a kind the climate stands none of stays none (Hammerfell's desert grows no tree)
  assert.equal(at('tree', regionOfTheatre(2), true, C.Desert), 0);
  // the three readers are the one law
  assert.equal(veinSlots({ climate: W, region: CYRODIIL_REGION, confirmed: true }), at('vein', CYRODIIL_REGION, true));
  assert.equal(treeSlots({ x: CX, y: CY, climate: W, region: CYRODIIL_REGION, confirmed: true }), at('tree', CYRODIIL_REGION, true));
  // the jungle's forty-eight, whatever the region says (JUNGLE-WOODS: its area's, never multiplied)
  const [jy, jx] = BANTHA_AREA_ROWS[0];
  assert.equal(treeSlots({ x: jx, y: jy, climate: C.Rainforest, region: regionOfTheatre(6), confirmed: true }), JUNGLE_TREE_SLOTS);
  // what the law stands is what it counts
  for (const kind of ['tree', 'herb', 'vein', 'boulder']) {
    const p = { x: CX, y: CY, day: TODAY, climate: W, region: CYRODIIL_REGION, confirmed: true };
    const stood = kind === 'tree' ? trees(p) : kind === 'herb' ? herbPatches(p) : kind === 'vein' ? veins(p) : boulders(p);
    if (kind !== 'tree') assert.equal(stood.length, at(kind, CYRODIIL_REGION, true), `${kind}: every slot stands`);
    assert.ok(stood.every((n) => n.slot < at(kind, CYRODIIL_REGION, true)));
  }
});

test('WW-C1 Cyrodiil home to all: its confirmed ground draws over every rich province\'s tables - their metals, woods and herbs - and stands every province\'s ore; unconfirmed, the Woodlands\' own to their tiers (mutants: the tables unmerged; merged unconfirmed)', () => {
  const W = C.Woodlands;
  const metals = new Set(), woods = new Set(), herbs = new Set(), sigs = new Set();
  for (const day of days(40)) {
    for (const v of veins({ x: CX, y: CY, day, climate: W, region: CYRODIIL_REGION, confirmed: true })) (v.signature ? sigs : metals).add(v.material);
    for (const t of trees({ x: CX, y: CY, day, climate: W, region: CYRODIIL_REGION, confirmed: true })) woods.add(t.material);
    for (const h of herbPatches({ x: CX, y: CY, day, climate: W, region: CYRODIIL_REGION, confirmed: true })) herbs.add(h.herb);
    // unconfirmed: the Woodlands' own table, held to the unwitnessed tier; no ore of a province's; no wood past tier 2
    for (const v of veins({ x: CX, y: CY, day, climate: W, region: CYRODIIL_REGION, confirmed: false })) {
      assert.ok(VEIN_TABLES[W].includes(v.material) && !v.signature && v.tier <= UNCONFIRMED_VEIN_TIER, v.material);
    }
    for (const t of trees({ x: CX, y: CY, day, climate: W, region: CYRODIIL_REGION, confirmed: false })) assert.ok(t.tier <= 2 && !t.rare, t.material);
  }
  const veinRich = [W, ...Object.values(PROVINCE_GROUND).filter((g) => (g.rich.vein ?? 1) > 1).map((g) => g.climate)];
  assert.ok(metals.has('ore:mithril') && metals.has('metal:platinum') && metals.has('ore:ebony'), `the Mountain's and the desert's metals: ${[...metals]}`);
  assert.ok([...metals].every((k) => veinRich.some((c) => VEIN_TABLES[c].includes(k))), 'never a metal no vein-rich province holds');
  assert.deepEqual([...sigs].sort(), [...new Set(provinceOres(CYRODIIL_REGION))].sort(), 'every province\'s ore stands');
  assert.ok(woods.has('log:teak') && woods.has('log:mahogany'), `Valenwood's woods: ${[...woods]}`);
  const treeRich = [W, ...Object.values(PROVINCE_GROUND).filter((g) => (g.rich.tree ?? 1) > 1).map((g) => g.climate)];
  assert.ok([...woods].every((k) => k === 'log:pine' || treeRich.some((c) => WOOD_TABLES[c].includes(k) || RARE_WOODS[c] === k)), `woods: ${[...woods]}`);
  const herbRich = [W, ...Object.values(PROVINCE_GROUND).filter((g) => (g.rich.herb ?? 1) > 1).map((g) => g.climate)];
  assert.ok([...herbs].some((h) => !HERB_TABLES[W].flat().includes(h)), 'an herb the Woodlands never grow');
  assert.ok([...herbs].every((h) => herbRich.some((c) => HERB_TABLES[c].flat().includes(h))), 'never an herb no herb-rich province grows');
  // the ore card's table is the law's (ui/oreMapTip.js)
  assert.ok(veinTable({ climate: W, region: CYRODIIL_REGION, confirmed: true }).includes('metal:platinum'));
  assert.equal(veinTable({ climate: W, region: CYRODIIL_REGION, confirmed: false }), VEIN_TABLES[W]);
  // a slot past the day's count stands nothing - nor a vein of a province's ore off confirmed ground
  const n = veinSlots({ climate: W, region: CYRODIIL_REGION, confirmed: true });
  assert.equal(vein({ x: CX, y: CY, day: TODAY, slot: n, climate: W, region: CYRODIIL_REGION, confirmed: true }), null);
  assert.equal(vein({ x: CX, y: CY, day: TODAY, slot: 4, climate: W, region: CYRODIIL_REGION, confirmed: false }), null);
  assert.equal(tree({ x: CX, y: CY, day: TODAY, slot: 12, climate: W, region: CYRODIIL_REGION, confirmed: false }), null);
  assert.equal(regionSignature(CYRODIIL_REGION).slots, 6);
});

test('WW-C1 the ground is the world\'s grid, and a province is never claimed on the Bay\'s map (mutants: the Bay\'s map alone; a province on the Bay)', () => {
  assert.deepEqual([[CX, CY], [-800, 1500], [8191, -8191], [8192, 0], [0, -8192]].map(([x, y]) => pixelOk(x, y)), [true, true, true, false, false]);
  assert.deepEqual([[CYRODIIL_REGION, 300, 200], [regionOfTheatre(1), 999, 499], [CYRODIIL_REGION, CX, CY], [CYRODIIL_REGION, 1000, 200], [17, 300, 200], [17, CX, CY], [0, -5, 250]]
    .map(([r, x, y]) => regionOnPixel(r, x, y)), [false, false, true, true, true, true, true]);
});

test('WW-C1 the service: a Cyrodiil vein past the Woodlands\' four is refused on unwitnessed ground and taken on confirmed; a province claimed on the Bay\'s map is refused (mutants: the bound the climate\'s; richness unconfirmed; no Bay check)', async () => {
  const s = await standService({ PROFESSIONS_OPEN: 'on' });
  const raw = s.env.DB._raw;
  const realNow = Date.now;
  Date.now = () => NOW * 1000;
  try {
    const w = await s.registered('Mac');
    raw.prepare('UPDATE players SET registered_at = ? WHERE id = ?').run(NOW - WITNESS.ageS, w.id);
    const row = () => raw.prepare('SELECT * FROM players WHERE id = ?').get(w.id);
    raw.prepare('INSERT OR REPLACE INTO prof_tracks (player, char_id, profession, xp, updated_at) VALUES (?, ?, ?, ?, ?)').run(w.id, w.character, 'mining', 100_000, NOW);
    const W = C.Woodlands;
    const ask = (x, y, slot, region, rid) => harvestNode({ db: s.env.DB, nowS: NOW, rand: (b) => globalThis.crypto.getRandomValues(b) }, row(), s.env, {
      character: w.character, node: nodeKey({ kind: 'vein', x, y, day: TODAY, slot }), kind: 'ore', climate: W, region, act: { strikes: 3, glints: 0 }, at: NOW - 2, rid,
    });
    assert.equal((await ask(CX, CY, 4, CYRODIIL_REGION, 'wwc1-0001')).error, 'bad-node', 'unwitnessed: the Woodlands\' four veins alone');
    assert.equal((await ask(300, 200, 0, CYRODIIL_REGION, 'wwc1-0002')).error, 'prof-pixel', 'Cyrodiil claimed on the Bay\'s map');
    // three accounts a week old witness the pixel Cyrodiil's
    for (const name of ['Ada', 'Bram', 'Cass']) {
      const a = await s.registered(name);
      raw.prepare('INSERT INTO world_witness (kind, key, account, report, region, at) VALUES (?, ?, ?, ?, ?, ?)').run('pixel', pixelKey(CX + 1, CY), a.id, pixelReport(W, CYRODIIL_REGION), CYRODIIL_REGION, NOW - 3600);
    }
    const slot = veinSlots({ climate: W, region: CYRODIIL_REGION, confirmed: true }) - 1;   // the last: a province's ore
    const r = await ask(CX + 1, CY, slot, CYRODIIL_REGION, 'wwc1-0003');
    assert.equal(r.error, undefined, JSON.stringify(r));
    assert.equal(r.ok, true);
    assert.equal(vein({ x: CX + 1, y: CY, day: TODAY, slot, climate: W, region: CYRODIIL_REGION, confirmed: true }).material, provinceOres(CYRODIIL_REGION).at(-1));
    assert.equal((await ask(CX + 1, CY, slot + 1, CYRODIIL_REGION, 'wwc1-0004')).error, 'bad-node', 'and none past it');
  } finally { Date.now = realNow; }
});

test('WW-C1 both ends: the client stands the pixel\'s region into every kind, the service bounds every slot by nodeSlots (mutants: a host without the region; the service\'s old ternary)', () => {
  const src = (f) => readFileSync(new URL(`../../../${f}`, import.meta.url), 'utf8');
  assert.match(src('src/scenes/treeHost.js'), /standTrees\(\{ px, py, day, climate: info\.climate, region: info\.region, confirmed,/);
  assert.match(src('src/scenes/herbHost.js'), /px,\n\s*py,\n\s*day,\n\s*climate: info\.climate,\n\s*region: info\.region,\n\s*confirmed,\n\s*seasonalEye:/);
  assert.match(src('src/scenes/mineHost.js'), /boulders\(\{ x: px, y: py, day, climate, region, confirmed \}\)/);
  const svc = src('server-account/src/professions.js');
  // PIN MOVED (AUDIT TESA II J5, bible/06-Systems/Professions-Arc.md JUNGLE-WOODS PAST THE BAY): and the witnesses' jungle word
  assert.match(svc, /n\.slot >= nodeSlots\(n\.kind, \{ x: n\.x, y: n\.y, climate, region, confirmed, jungle: fact\?\.jungle === true \}\)\) return \{ error: 'bad-node' \}/);
  assert.match(svc, /!regionOnPixel\(region, n\.x, n\.y\)\) return \{ error: 'prof-pixel' \}/);
  // PIN MOVED (AUDIT TESA II J5): a tree's call with the witnesses' jungle word
  for (const call of [/tree\(\{ x: n\.x, y: n\.y, day, slot: n\.slot, climate, region, confirmed, jungle: fact\?\.jungle === true \}\)/, /herbPatch\(\{ x: n\.x, y: n\.y, day, slot: n\.slot, climate, region, confirmed,/, /boulder\(\{ x: n\.x, y: n\.y, day, slot: n\.slot, climate, region, confirmed \}\)/]) {
    assert.match(svc, call);
  }
  // every province ore is a tier the veins weigh (drawFromTable's weights reach 6)
  assert.ok(provinceOres(CYRODIIL_REGION).every((k) => tierOf(k) >= 4 && tierOf(k) <= 6));
});
