// BAY-LEFT-GROUND (2026-10-26, bible/03-World/Landforms.md "BAY-LEFT-GROUND"; the audit "no system left behind in the
// Bay", D1 - LANDFORM4, Mac's "a town walled in by its own levelling") - THE LANDFORMS' SITES PAST THE BAY. LANDFORM4's
// table is MAPS.BSA's 1000 x 500, so no place past the Bay pulled its land to its level and every town there stood in
// its own levelling wall. The places past the Bay every client stands alike are a second table by the world's key
// (world/landforms.js landformSitesBeyond over world/pastBayRows.js pastBaySites), on both kernels and made again as the
// places move (scenes/landformSitesHost.js). Pinned on the composed continent of the synthetic world (no game data) and,
// with ARENA2, on the freeware's trace.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import { WoodsFile } from '../../../src/formats/woodsFile.js';
import { LOCATION_TYPES } from '../../../src/formats/mapsFile.js';
import { generateSamples, HEIGHTMAP_DIMENSION, MAX_TERRAIN_HEIGHT, STREAMING_TERRAIN_SCALE } from '../../../src/world/terrain/terrainSampler.js';
import { createLandforms, landformSites, landformSitesBeyond } from '../../../src/world/landforms.js';
import { generatePixelTerrain, restrideGrid } from '../../../src/world/terrain/terrainGen.js';
import { TerrainGenClient } from '../../../src/world/terrain/terrainGenClient.js';
import { groundWoods, dropGroundCache } from '../../../src/world/tamriel/tamrielGround.js';
import { setTamrielTrace } from '../../../src/world/tamriel/tamrielLand.js';
import { setTamrielFit, tamrielFit } from '../../../src/world/tamriel/tamrielFrame.js';
import { worldPixelKey } from '../../../src/world/worldWide/worldGrid.js';
import { pastBaySites } from '../../../src/world/pastBayRows.js';
import { CAPITALS, capitalPin } from '../../../src/world/tamrielCapitals.js';
import { createLandformSites, sitesMoved, pixelsMovedBy, SITE_REACH_PIXELS } from '../../../src/scenes/landformSitesHost.js';
import { syntheticWoodsBytes } from '../../landformWorld.mjs';
import { hostText } from '../../hostText.mjs';

const H = HEIGHTMAP_DIMENSION, M = MAX_TERRAIN_HEIGHT * STREAMING_TERRAIN_SCALE;
const src = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const loc = (w, h, type = LOCATION_TYPES.TownCity) => ({ exterior: { exteriorData: { width: w, height: h, blockNames: ['X'] } }, mapTableData: { locationType: type } });
afterEach(() => { setTamrielTrace(null); setTamrielFit(null); dropGroundCache(); });

/** The synthetic world composed with the continent round it (the authored shape, untraced) - the ground the host stands. */
const world = () => { const w = new WoodsFile(); assert.equal(w.load(syntheticWoodsBytes()), true); return groundWoods(w); };

/** A town's rise from its pixel's edge to its level (lane D's p5 measure): the worst edge sample off the middle half's mean. */
function rise(woods, lf, px, py) {
  const s = generateSamples(woods, px, py, H, lf);
  let c = 0, n = 0;
  for (let y = 32; y < 96; y++) for (let x = 32; x < 96; x++) { c += s[y * H + x]; n++; }
  c /= n;
  let worst = 0;
  for (let i = 0; i < H; i++) for (const [x, y] of [[i, 0], [i, H - 1], [0, i], [H - 1, i]]) worst = Math.max(worst, Math.abs(s[y * H + x] - c));
  return worst * M;
}

test('BAY-LEFT-GROUND D1 the table past the Bay: each place off the Bay\'s 1000 x 500 its footprint rect\'s four bytes (SITE_BIAS over its tiles, as landformSites\' own) packed by its world key; a row on the Bay\'s table is the table\'s, one off the world\'s grid none (mutants: the Bay\'s rows kept; the bias; a byte\'s place)', () => {
  const rows = [
    { px: 1891, py: -202, loc: loc(8, 8) },   // a city past the Bay: tiles -3..130
    { px: -40, py: 120, loc: loc(2, 2, LOCATION_TYPES.TownVillage) },   // a village west of the Bay: tiles 46..81
    { px: 500, py: 250, loc: loc(4, 4) },   // the Bay's own: the table's
    { px: 20000, py: 0, loc: loc(4, 4) },   // off the grid
  ];
  const t = landformSitesBeyond(rows);
  const pack = (a, b, c, d) => (a | (b << 8) | (c << 16) | (d << 24)) >>> 0;
  assert.deepEqual([...t], [[worldPixelKey(1891, -202), pack(13, 146, 13, 146)], [worldPixelKey(-40, 120), pack(62, 97, 62, 97)]]);
  // the Bay's table as LANDFORM4 makes it, the same rows: the Bay's row there and only there
  const bay = landformSites(rows);
  assert.deepEqual([...bay.subarray(4 * (250 * 1000 + 500), 4 * (250 * 1000 + 500) + 4)], [16 + 32 - 3, 16 + 95 + 3, 16 + 32 - 3, 16 + 95 + 3]);
  assert.equal(bay.reduce((n, v) => n + (v ? 1 : 0), 0), 4, 'nothing past the Bay in the Bay\'s table');
});

test('BAY-LEFT-GROUND D1 the kernel pulls the land past the Bay to a town\'s level: its pixel all but level, its neighbours\' land eased toward it over the seam - each seam one number from both pixels; the Bay\'s ground with the table past the Bay the same to the bit (mutants: the table past the Bay unread; its key; a site\'s level on the Bay\'s law past the seam)', () => {
  const woods = world();
  // a city on the continent past the Bay's east edge (Morrowind, the authored shape), its land rolling
  const [px, py] = [capitalPin({ name: 'Mournhold', province: 'Morrowind' }).px + 6, capitalPin({ name: 'Mournhold', province: 'Morrowind' }).py];
  const beyond = landformSitesBeyond([{ px, py, loc: loc(8, 8) }]);
  const climates = null;
  const without = createLandforms({ woods, climates }), withSite = createLandforms({ woods, beyond, climates });
  const walled = rise(woods, without, px, py), stands = rise(woods, withSite, px, py);
  assert.ok(walled > 2 * stands + 1, `the town's rise to its edge: ${walled.toFixed(1)} m walled, ${stands.toFixed(1)} m standing in its land`);
  // its neighbour's land moved toward it; the shared edge one number from both pixels
  const own = generateSamples(woods, px, py, H, withSite), east = generateSamples(woods, px + 1, py, H, withSite), eastBare = generateSamples(woods, px + 1, py, H, without);
  assert.notDeepEqual([...east], [...eastBare], 'the neighbour pulled');
  const seam = [], seamE = [];   // the samples x-major (s[x * H + y]): its east column, the neighbour's west
  for (let y = 0; y < H; y++) { seam.push(own[(H - 1) * H + y]); seamE.push(east[y]); }
  assert.deepEqual(seamE, seam, 'the east seam: one number from both pixels');
  // a pixel three off is no site's: the same to the bit
  assert.deepEqual([...generateSamples(woods, px + 3, py, H, withSite)], [...generateSamples(woods, px + 3, py, H, without)], 'beyond its reach, untouched');
  // the Bay: the same with the table past the Bay as without it, sample for sample
  const bayRows = [{ px: 405, py: 250, loc: loc(6, 6) }];
  const sites = landformSites(bayRows);
  const a = createLandforms({ woods, sites, climates }), b = createLandforms({ woods, sites, beyond, climates });
  for (const [x, y] of [[405, 250], [406, 250], [405, 252], [998, 40]]) assert.deepEqual([...generateSamples(woods, x, y, H, b)], [...generateSamples(woods, x, y, H, a)], `(${x}, ${y})`);
});

test('BAY-LEFT-GROUND D1 every kernel takes the table past the Bay: the job\'s and a promotion\'s grid on the same thread and on the worker, the worker\'s middle ring with it; the client keeps it for its own kernel and posts a copy (mutants: the worker\'s message unread; the client\'s kernel without it)', async () => {
  const woods = world();
  const [px, py] = [capitalPin({ name: 'Mournhold', province: 'Morrowind' }).px + 6, capitalPin({ name: 'Mournhold', province: 'Morrowind' }).py];
  const beyond = landformSitesBeyond([{ px, py, loc: loc(8, 8) }]);
  const job = { px: px + 1, py, stride: 1, tilemap: new Uint8Array(128 * 128), climateType: 231, landform: true };
  const here = generatePixelTerrain({ woods, beyond, ...job, tilemap: job.tilemap.slice() });
  const bare = generatePixelTerrain({ woods, ...job, tilemap: job.tilemap.slice() });
  assert.notDeepEqual([...here.samples], [...bare.samples], 'the site next door moved it');
  const posted = [];
  const prevPost = globalThis.postMessage, prevOn = globalThis.onmessage;
  globalThis.postMessage = (msg) => posted.push(msg);
  try {
    await import('../../../src/world/terrain/terrainGenWorker.js?bayleftground');
    globalThis.onmessage({ data: { t: 'init', woodsBytes: syntheticWoodsBytes(), tamriel: true } });
    globalThis.onmessage({ data: { t: 'landform-beyond', beyond } });
    globalThis.onmessage({ data: { t: 'job', ...job, tilemap: job.tilemap.slice() } });
    assert.deepEqual([...posted.findLast((m) => m.t === 'done').samples], [...here.samples], 'the worker\'s job: pulled to the site next door');
    globalThis.onmessage({ data: { t: 'grid', id: 9, px: px + 1, py, stride: 4, samples: here.samples, landform: true } });
    assert.deepEqual([...posted.findLast((m) => m.t === 'grid').normals], [...restrideGrid({ woods, px: px + 1, py, stride: 4, samples: here.samples, landform: true, beyond }).normals], 'a promotion\'s ghost rows too');
    globalThis.onmessage({ data: { t: 'landform-beyond', beyond: null } });
    globalThis.onmessage({ data: { t: 'job', ...job, tilemap: job.tilemap.slice() } });
    assert.deepEqual([...posted.findLast((m) => m.t === 'done').samples], [...bare.samples], 'cleared, none');
  } finally { globalThis.postMessage = prevPost; globalThis.onmessage = prevOn; }
  const worker = src('src/world/terrain/terrainGenWorker.js');
  assert.match(worker, /const landforms = m\.landform \? createLandforms\(\{ woods, roads, sites, beyond, climates \}\) : null;\n\s+const pixel = \(px, py\) => keptMid\(/, 'the middle ring');
  assert.match(worker, /m\.t === 'landform-beyond' \|\| m\.t === 'tamriel'\) \{ keptMid\.clear\(\); keptFar\.clear\(\); \}/, 'the horizon\'s books let go when it moves');
  // the client: its own kernel reads it; a worker gets a copy
  const c = new TerrainGenClient({ woods });   // no worker: the same-thread kernel
  c.setLandformBeyond(beyond);
  const mine = await c.generate({ ...job, tilemap: job.tilemap.slice() });
  assert.deepEqual([...mine.samples], [...here.samples], 'the same-thread kernel');
  const sent = [];
  c._worker = { postMessage: (m) => sent.push(m) };
  c.setLandformBeyond(beyond);
  assert.deepEqual(sent, [{ t: 'landform-beyond', beyond }]);
  assert.equal((src('src/world/terrain/terrainGenClient.js').match(/sites: this\._sites, beyond: this\._beyond, climates: this\._climates, /g) ?? []).length, 6, 'every same-thread kernel the client runs');
});

test('BAY-LEFT-GROUND D1 the places past the Bay as sites (GROUND-AGREE: what every client with the land stands alike): the model\'s every stood place with a template, and a capital levelled as a town is (one pixel, inland: Mournhold, Falinesti, Helstrom); a capital over several pixels or at the sea keeps its own law; a place pinned on a standing capital is the capital\'s (mutants: the shore capitals taken; the pinned place twice)', () => {
  const tpl = loc(4, 4, LOCATION_TYPES.TownHamlet);
  const pixels = { stood: [{ bx: 1500, by: -100, pinned: false }, { bx: 1600, by: -50, pinned: true }, { bx: 1700, by: 10, pinned: false, none: true }], byPixel: new Map() };
  const rows = pastBaySites({ pixels, templateOf: (p) => (p.none ? null : tpl), capitals: true });
  const caps = CAPITALS.filter((c) => ['Mournhold', 'Falinesti', 'Helstrom'].includes(c.name)).map((c) => capitalPin({ name: c.name, province: c.province }));
  assert.deepEqual(rows.map((r) => [r.px, r.py]), [...caps.map((p) => [p.px, p.py]), [1500, -100]]);
  for (const r of rows.slice(0, 3)) assert.deepEqual([r.loc.mapTableData.locationType, r.loc.exterior.exteriorData.width, r.loc.exterior.exteriorData.height], [LOCATION_TYPES.TownCity, 8, 8]);
  assert.equal(rows[3].loc, tpl, 'the template the place clones (the game\'s own row)');
  // the capitals off: a pinned place stands as a town
  assert.deepEqual(pastBaySites({ pixels, templateOf: (p) => (p.none ? null : tpl), capitals: false }).map((r) => [r.px, r.py]), [[1500, -100], [1600, -50]]);
  // pure: the same table from the same places, every time
  assert.deepEqual([...landformSitesBeyond(rows)], [...landformSitesBeyond(pastBaySites({ pixels, templateOf: (p) => (p.none ? null : tpl), capitals: true }))]);
});

/** A stream's books for the host module: the standing pixels, the ones in flight, the rebuild behind the view. */
function streamOf(keys, flying = []) {
  const built = new Map(keys.map(([x, y]) => [`${x},${y}`, { px: x, py: y }]));
  const inFlight = new Map(flying.map(([x, y]) => [`${x},${y}`, {}]));
  const rebuilt = [], owed = new Set();
  const swap = { owes: (k) => owed.has(k), rebuild: (list) => { for (const p of list) { rebuilt.push(`${p.px},${p.py}`); owed.add(`${p.px},${p.py}`); } } };
  return { built, inFlight, swap, rebuilt, owed };
}

test('BAY-LEFT-GROUND D1 the host keeps the table with the places: made as the world mounts and handed to the kernels before the first job; asked on the frame, made again only when what stands the places moves, and every standing pixel within two of a moved site built again behind its view - one in flight once it publishes, one already owed a build left to it (mutants: the reach; the stamp; the in-flight book)', () => {
  const posts = [];
  const terrainGen = { setLandformBeyond: (b) => posts.push(b) };
  const caps = ['Mournhold', 'Falinesti', 'Helstrom'].map((n) => capitalPin({ name: n, province: CAPITALS.find((c) => c.name === n).province }));
  const [m] = caps;
  const s = streamOf([[m.px, m.py], [m.px + 2, m.py - 2], [m.px + 3, m.py], [500, 250]], [[m.px - 1, m.py + 1]]);
  const host = createLandformSites({ terrainGen, landform: true, arena: null, capitals: true, get built() { return s.built; }, get inFlight() { return s.inFlight; }, swap: s.swap });
  assert.equal(posts.length, 1, 'the first table, at the mount');
  assert.deepEqual([...posts[0].keys()].sort(), caps.map((p) => worldPixelKey(p.px, p.py)).sort());
  assert.equal(host.beyond(), posts[0]);
  assert.equal(host.generation(), 1);
  assert.equal(host.refresh(), false, 'nothing moved');
  assert.equal(posts.length, 1);
  // the fit moves: the capitals' pixels with it - the table again, and the pixels its moved sites reach
  setTamrielFit({ ...tamrielFit(), ox: tamrielFit().ox + 1 });
  const moved = sitesMoved(posts[0], landformSitesBeyond(pastBaySites({ pixels: null, templateOf: () => null, capitals: true })));
  assert.ok(moved.length > 0, 'the capitals moved with the fit');
  s.owed.add(`${m.px + 2},${m.py - 2}`);   // owed a build already (another sweep's): left to it
  assert.equal(host.refresh(), true);
  assert.equal(posts.length, 2);
  assert.equal(host.generation(), 2);
  const reach = pixelsMovedBy(moved);
  assert.deepEqual(s.rebuilt.sort(), [...s.built.values()].filter((p) => reach.has(worldPixelKey(p.px, p.py)) && `${p.px},${p.py}` !== `${m.px + 2},${m.py - 2}`).map((p) => `${p.px},${p.py}`).sort());
  assert.ok(!s.rebuilt.includes('500,250'), 'the Bay\'s pixel, far from any: standing');
  assert.ok(!s.rebuilt.includes(`${m.px + 3},${m.py}`) || reach.has(worldPixelKey(m.px + 3, m.py)), 'three off: untouched unless a moved site is within two');
  // the one in flight: built again once it publishes
  const flying = `${m.px - 1},${m.py + 1}`, n0 = s.rebuilt.length;
  if (reach.has(worldPixelKey(m.px - 1, m.py + 1))) {
    s.inFlight.delete(flying); s.built.set(flying, { px: m.px - 1, py: m.py + 1 });
    host.refresh();
    assert.equal(s.rebuilt.slice(n0).join(), flying, 'published under the old table: built again, once');
    host.refresh();
    assert.equal(s.rebuilt.length, n0 + 1, 'and only once');
  }
  assert.equal(SITE_REACH_PIXELS, 2, 'the 5x5 sitesAbout reads');
  // the row off: none, ever
  const off = createLandformSites({ terrainGen: { setLandformBeyond: () => { throw new Error('posted'); } }, landform: false, arena: null, capitals: true, built: new Map(), inFlight: new Map(), swap: s.swap });
  assert.equal(off.beyond(), null);
  assert.equal(off.refresh(), false);
});

test('BAY-LEFT-GROUND D1 the world host wires it: the table made beside the places\' templates and handed to both kernels, this thread\'s landforms and a promotion\'s grid reading it, asked on the frame after the places\' own sweeps, the gate\'s kernel kept by its generation (mutants: each seam)', () => {
  const w = hostText('src/scenes/world.js');
  assert.match(w, /const landformSites = createLandformSites\(\{ terrainGen, landform, arena: _arenaTemplates, capitals: !!_capitalBase, get built\(\) \{ return built; \}, get inFlight\(\) \{ return inFlight; \}, swap \}\);/);
  assert.match(w, /createLandforms\(\{ woods, roads: terrainGen\.roads\(\), sites: _landformSites, beyond: landformSites\.beyond\(\), climates: _landformClimates \}\)/, 'this thread\'s landforms');
  assert.match(w, /sites: _landformSites, beyond: landformSites\.beyond\(\), climates: _landformClimates, bed: /, 'a promotion\'s grid');
  assert.match(w, /if \(_capitalBase && !building\) sweepCapitalPixels\(\);[^\n]*\n\s+if \(!building\) landformSites\.refresh\(\);/, 'on the frame, after the places\' sweeps');
  assert.match(w, /const key = `\$\{px\},\$\{py\},\$\{landform && terrainGen\.roads\(\) \? 1 : 0\},\$\{landformSites\.generation\(\)\}`;/, 'the gate\'s kernel');
  assert.ok(w.indexOf('const landformSites = createLandformSites(') > w.indexOf('const _arenaTemplates = '), 'after the templates it reads');
});

const ARENA2 = process.env.ARENA2_PATH;
const HAVE = !!ARENA2 && ['TMAP00I0.IMG', 'TAMRIEL2.IMG', 'ART_PAL.COL', 'WOODS.WLD', 'MAPS.BSA', 'CLIMATE.PAK', 'POLITIC.PAK'].every((f) => existsSync(join(ARENA2, f)));
test('BAY-LEFT-GROUND D1 with ARENA2: on the freeware\'s trace every town past the Bay is a site, and its rise to its pixel\'s edge comes down to the Bay\'s - the audit\'s sample (lane D p5: its cities and towns, every third) from a median 39.1 m and p90 104.0 m to the Bay\'s order; the Bay\'s towns the same, sample for sample; the table the same from the same trace (mutants: the sites past the Bay unmade; the continent\'s level)', { skip: HAVE ? false : 'ARENA2_PATH not set' }, async () => {
  const { DFPalette } = await import('../../../src/formats/dfPalette.js');
  const { preloadTamrielTrace } = await import('../../../src/ui/tamrielTrace.js');
  const { MapsFile, longitudeLatitudeToMapPixel } = await import('../../../src/formats/mapsFile.js');
  const { groundMaps } = await import('../../../src/world/tamriel/tamrielGround.js');
  const { landformClimates } = await import('../../../src/world/landforms.js');
  const { arenaTemplates, arenaTemplateOf } = await import('../../../src/world/arenaLocations.js');
  const { arenaPixels } = await import('../../../src/world/arenaPlaces.js');
  const { pastBayPlaceRows } = await import('../../../src/world/pastBayRows.js');
  const bytes = (n) => new Uint8Array(readFileSync(join(ARENA2, n)));
  const pal = new DFPalette(); pal.load(bytes('ART_PAL.COL'), 'ART_PAL.COL');
  setTamrielTrace(await preloadTamrielTrace({ fetchBytes: async (n) => bytes(n), palette: pal, indexedDBRef: null }));
  setTamrielFit({ ox: 38 * 15.5, oy: 57 * 15.5, ppu: 15.5 });
  const maps = new MapsFile(); maps.load(bytes('MAPS.BSA'), bytes('CLIMATE.PAK'), bytes('POLITIC.PAK'));
  groundMaps(maps);
  const w0 = new WoodsFile(); w0.load(bytes('WOODS.WLD'));
  const woods = groundWoods(w0);
  const rows = [];
  for (let r = 0; r < maps.regionCount; r++) { if (!maps.getRegion(r)) continue; for (let l = 0; l < maps.baseLocationCount(r); l++) { const lo = maps.getLocation(r, l); if (lo?.exterior?.exteriorData) rows.push(lo); } }
  const sites = landformSites(rows.map((lo) => { const p = longitudeLatitudeToMapPixel(lo.mapTableData.longitude, lo.mapTableData.latitude); return { px: p.x, py: p.y, loc: lo }; }));
  const climates = landformClimates((x, y) => maps.getClimateIndex(x, y));
  const tpl = arenaTemplates(rows), px = arenaPixels();
  const beyond = landformSitesBeyond(pastBaySites({ pixels: px, templateOf: (p) => arenaTemplateOf(tpl, p), capitals: true }));
  assert.deepEqual([...beyond], [...landformSitesBeyond(pastBaySites({ pixels: arenaPixels(), templateOf: (p) => arenaTemplateOf(arenaTemplates(rows), p), capitals: true }))], 'the same table from the same trace');
  const before = createLandforms({ woods, sites, climates }), after = createLandforms({ woods, sites, beyond, climates });
  const sample = pastBayPlaceRows({ pixels: px, templateOf: (p) => arenaTemplateOf(tpl, p), capitals: false }).filter((r) => r.type === LOCATION_TYPES.TownCity || r.type === LOCATION_TYPES.TownHamlet).filter((_, i) => i % 3 === 0).slice(0, 80)
    .filter((r) => beyond.has(worldPixelKey(r.px, r.py)));   // the capitals' own pixels keep their law
  assert.ok(sample.length >= 40, `the audit's sample (${sample.length})`);
  const q = (a, f) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(f * s.length))]; };
  const was = sample.map((r) => rise(woods, before, r.px, r.py)), now = sample.map((r) => rise(woods, after, r.px, r.py));
  assert.ok(q(was, 0.5) > 35 && q(was, 0.9) > 80, `before: median ${q(was, 0.5).toFixed(1)} m, p90 ${q(was, 0.9).toFixed(1)} m`);
  assert.ok(q(now, 0.5) < 18 && q(now, 0.9) < 50, `after: median ${q(now, 0.5).toFixed(1)} m, p90 ${q(now, 0.9).toFixed(1)} m (the Bay's 7.6 m and 37.7 m)`);
  // the Bay's towns, sample for sample
  const bay = rows.filter((l) => l.mapTableData.locationType === LOCATION_TYPES.TownCity || l.mapTableData.locationType === LOCATION_TYPES.TownHamlet).filter((_, i) => i % 7 === 0).slice(0, 40)
    .map((lo) => longitudeLatitudeToMapPixel(lo.mapTableData.longitude, lo.mapTableData.latitude));
  for (const p of bay) assert.deepEqual([...generateSamples(woods, p.x, p.y, H, after)], [...generateSamples(woods, p.x, p.y, H, before)], `the Bay's (${p.x}, ${p.y})`);
});
