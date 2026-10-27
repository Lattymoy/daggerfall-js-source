// TESA-LANDS (bible/03-World/Tamriel-Lands.md) - A ZONE'S OWN FLATS AND ITS WOODS AFAR: the recipes laid by the terrain's
// kernel (world/terrain/terrainNature.js layoutLands, ECOTONE1's border between two zones), and the far views reading the
// same law (world/terrain/floraCover.js landsFloraSpec, bandTreesPixel; render/farFlora.js the zone's art and ground;
// render/farTrees.js a band tree's own archive). The continent past the Bay is the authored one (its ground no file's), so
// the landforms' synthetic world stands for the map: no ARENA2 is read here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { WoodsFile } from '../../src/formats/woodsFile.js';
import { syntheticWoodsBytes } from '../landformWorld.mjs';
import { groundWoods } from '../../src/world/tamriel/tamrielGround.js';
import { generatePixelTerrain } from '../../src/world/terrain/terrainGen.js';
import { FOREST, TREE_RECORDS, isTreeRecord, compileRecipe } from '../../src/world/terrain/terrainNature.js';
import { landsFloraSpec, expectedTrees, treesPerTile, bandTreesPixel, bandTreeArt, bandTreeCode, floraSpec, LANDS_WOOD_BINS } from '../../src/world/terrain/floraCover.js';
import { LANDS, forestQuantile } from '../../src/world/tamriel/tamrielLands.js';
import { tamrielBiomeAt } from '../../src/world/tamriel/tamrielBiomes.js';
import { tamrielFrameInBay } from '../../src/world/tamriel/tamrielFrame.js';
import { getWorldClimateSettings } from '../../src/formats/mapsFile.js';
import { LAND_PROP_FLOATS, landMeasures, FLAT_CLEAR, LAND_KIND_LAW } from '../../src/world/lands/landProps.js';
import { LAND_KINDS } from '../../src/world/lands/landPropMesh.js';
import { createFloraArt, landTreeArt, landGroundArt } from '../../src/render/farFlora.js';
import { ECOTONE_REACH } from '../../src/world/ecotone.js';
import { bandInstanceSteps } from '../../src/render/farTrees.js';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const wf = new WoodsFile();
assert.equal(wf.load(syntheticWoodsBytes()), true);
const woods = groundWoods(wf);

/** The first pixel of the frame (every 3rd) whose 3x3 is zone `key` whole - or, with `east`, whose east neighbour is it. */
function pixelOf(key, east = null) {
  const f = tamrielFrameInBay();
  for (let y = Math.ceil(f.y0) + 2; y < f.y0 + f.h - 2; y += 3) {
    for (let x = Math.ceil(f.x0) + 2; x < f.x0 + f.w - 2; x += 3) {
      if (tamrielBiomeAt(x, y)?.key !== key) continue;
      if (east) { if (tamrielBiomeAt(x + 1, y)?.key === east) return [x, y]; continue; }
      let whole = true;
      for (let j = -1; j <= 1 && whole; j++) for (let i = -1; i <= 1; i++) if (tamrielBiomeAt(x + i, y + j)?.key !== key) { whole = false; break; }
      if (whole) return [x, y];
    }
  }
  return null;
}
const kernel = (px, py, lands, blend = false) => {
  const c = getWorldClimateSettings(tamrielBiomeAt(px, py).climate);
  return generatePixelTerrain({ woods, px, py, tilemap: new Uint8Array(128 * 128), climateType: c.climateType, forests: { archive: c.natureArchive, hidden: false },
    lands: lands ? { blend, archive: c.natureArchive, hidden: false } : null, landform: false });
};
const picksOf = (recipe) => new Set([...recipe.trees, ...recipe.cover].map(([a, r]) => `${a}:${r}`));

test('TESA-LANDS A ZONE\'S OWN FLATS: past the Bay the kernel lays its recipe - every flat one of its picks, carrying its archive; its Trees by its woods\' share (the Pinewoods\' many, the Ashlands\' few); the same flats every run; off, the climate\'s (mutants: the recipe unread; a flat\'s archive lost; the woods\' edge FOREST1\'s)', () => {
  const ash = pixelOf('morrowindAshlands'), pine = pixelOf('skyrimPinewood');
  assert.ok(ash && pine);
  const on = kernel(...ash, true), off = kernel(...ash, false), again = kernel(...ash, true);
  const picks = picksOf(LANDS.morrowindAshlands.flora);
  assert.ok(on.nature.length > 200, `${on.nature.length} flats`);
  for (const f of on.nature) assert.ok(picks.has(`${f.archive}:${f.record}`), `a pick of the recipe (${f.archive}:${f.record})`);
  assert.ok(off.nature.every((f) => f.archive == null), 'off: the climate\'s own, no archive of their own');
  assert.deepEqual(on.nature.map((f) => [f.x, f.z, f.record, f.archive]), again.nature.map((f) => [f.x, f.z, f.record, f.archive]), 'the world tile\'s own dice');
  assert.equal(off.landProps.length, 0, 'off: no landmark');
  // the woods' share: the Pinewoods' Trees many times the Ashlands' a pixel
  const trees = (k, key) => k.nature.filter((f) => LANDS[key].flora.trees.some(([a, r]) => a === f.archive && r === f.record)).length;
  const pineOn = kernel(...pine, true);
  assert.ok(trees(pineOn, 'skyrimPinewood') > 8 * Math.max(1, trees(on, 'morrowindAshlands')), `${trees(pineOn, 'skyrimPinewood')} pines against ${trees(on, 'morrowindAshlands')}`);
});

test('TESA-LANDS THE BORDER BETWEEN TWO ZONES: with the Blended climates row a pixel\'s tiles by its east neighbour\'s edge stand the neighbour\'s recipe (ECOTONE1\'s owner), without it the pixel\'s own whole; the landmarks the same (mutants: the border unblended; the keys the climates\')', () => {
  const pairs = [['morrowindAshlands', 'morrowindGrazelands'], ['skyrimTundra', 'skyrimPinewood'], ['skyrimPinewood', 'skyrimTundra'], ['morrowindGrazelands', 'morrowindAshlands'], ['blackMarshFens', 'blackMarshHist'], ['blackMarshHist', 'blackMarshFens']];
  const found = pairs.map(([a, b]) => [a, b, pixelOf(a, b)]).find(([, , at]) => at);
  assert.ok(found, 'two zones meet on the continent');
  const [own, east, at] = found;
  const blended = kernel(...at, true, true), whole = kernel(...at, true, false);
  const mine = picksOf(LANDS[own].flora), theirs = picksOf(LANDS[east].flora);
  const theirsOnly = (k) => k.nature.filter((f) => theirs.has(`${f.archive}:${f.record}`) && !mine.has(`${f.archive}:${f.record}`));
  assert.equal(theirsOnly(whole).length, 0, 'unblended: the pixel\'s own whole');
  const across = theirsOnly(blended);
  assert.ok(across.length > 0, `${own} -> ${east}: the neighbour's flats at the border`);
  // each within the ecotone's reach of an edge whose neighbour is that zone (x east, z north from the south-west corner)
  const S = 819.2, R = ECOTONE_REACH + S / 128;
  const byEdge = (f) => [[f.x > S - R, 1, 0], [f.x < R, -1, 0], [f.z > S - R, 0, -1], [f.z < R, 0, 1]].some(([near, dx, dy]) => near && tamrielBiomeAt(at[0] + dx, at[1] + dy)?.key === east);
  assert.ok(across.every(byEdge), 'each by an edge the neighbour holds');
});

test('TESA-LANDS THE FLATS KEEP OFF THE LANDMARKS\' FEET: no flat stands within a bodied landmark\'s foot and FLAT_CLEAR, nor in a vineyard\'s tile (mutants: the flats unfiltered; the clearance dropped)', () => {
  for (const key of ['morrowindAshlands', 'summersetVineCoast', 'blackMarshHist']) {
    const at = pixelOf(key);
    if (!at) continue;
    const k = kernel(...at, true), p = k.landProps, tileM = 819.2 / 128;
    assert.ok(p.length > 0, `${key}: its landmarks`);
    for (let i = 0; i < p.length; i += LAND_PROP_FLOATS) {
      const kind = LAND_KINDS[p[i + 5]];
      if (kind === 'vines') {
        const tx = Math.floor(p[i] / tileM), tz = Math.floor(p[i + 2] / tileM);
        assert.ok(!k.nature.some((f) => Math.floor(f.x / tileM) === tx && Math.floor(f.z / tileM) === tz), `${key}: a vineyard's tile clear`);
        continue;
      }
      if (!LAND_KIND_LAW[kind].body) continue;
      const r = (landMeasures(kind, p[i + 6]).foot + FLAT_CLEAR) * p[i + 4];
      assert.ok(!k.nature.some((f) => Math.hypot(f.x - p[i], f.z - p[i + 2]) < r - 1e-4), `${key}: a ${kind}'s foot clear`);
    }
  }
});

test('TESA-LANDS A ZONE\'S WOODS AFAR: its share expected at FOREST1\'s wood is monotone, its mean over the field\'s own distribution the zone\'s woods; a tile\'s Trees its recipe\'s chance at its rate and ground; the expectation afar the zone\'s woods, not the climates\' 45% (mutants: the bins reversed; the expectation FOREST1\'s; the rate dropped)', () => {
  for (const key of ['morrowindAshlands', 'skyrimPinewood', 'blackMarshHist', 'elsweyrPlains']) {
    const recipe = LANDS[key].flora, s = landsFloraSpec(recipe);
    assert.equal(landsFloraSpec(recipe), s, 'made once a recipe');
    assert.ok(s.forests && s.lands && s.treeShare === 1);
    let last = -1;
    for (let w = 0; w <= 1.0001; w += 1 / (LANDS_WOOD_BINS * 2)) { const v = s.lands.woodOf(Math.min(1, w)); assert.ok(v >= last - 1e-9, `${key}: monotone at ${w}`); last = v; }
    // its mean over the field: FOREST1's wood at each quantile, the zone's expected there
    let sum = 0;
    const N = 2000, sm = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
    for (let k = 0; k < N; k++) sum += s.lands.woodOf(sm(FOREST.edge[0], FOREST.edge[1], forestQuantile((k + 0.5) / N)));
    assert.ok(Math.abs(sum / N - recipe.woods) < 0.04, `${key}: its woods on the whole (${(sum / N).toFixed(3)} against ${recipe.woods})`);
    const c = compileRecipe(recipe), g = c.ground;
    const want = (FOREST.plainTree + (FOREST.forestTree - FOREST.plainTree) * s.lands.woodOf(0.7)) * (g[1] * 0.2 + g[2] * 0.7 + g[3] * 0.1) * c.treeRate;
    assert.ok(Math.abs(treesPerTile(0.7, 0.2, 0.7, 0.1, s) - want) < 1e-12, `${key}: a tile's Trees`);
    assert.ok(Math.abs(expectedTrees(s, 128) - (FOREST.plainTree + (FOREST.forestTree - FOREST.plainTree) * recipe.woods) * g[2] * c.treeRate) < 1e-12, `${key}: afar`);
  }
  assert.ok(expectedTrees(landsFloraSpec(LANDS.skyrimPinewood.flora), 128) > 1.5 * expectedTrees(floraSpec(510, false, true), 128), 'the Pinewoods denser than the climates\' woods');
  assert.ok(expectedTrees(landsFloraSpec(LANDS.morrowindAshlands.flora), 128) < 0.1 * expectedTrees(floraSpec(510, false, true), 128), 'the Ashlands a tenth of them');
});

test('TESA-LANDS THE BAND PAST THE GRID: with the row a band pixel stands its zone\'s Trees, each answering its own archive with its record (archive x 256 + record), the pixel\'s own climate without it; the band\'s instances read each tree\'s own art (mutants: the code unread; the archive the pixel\'s)', () => {
  const ash = pixelOf('morrowindAshlands'), c = getWorldClimateSettings(tamrielBiomeAt(...ash).climate);
  const off = bandTreesPixel({ woods, px: ash[0], py: ash[1], archive: c.natureArchive, climateType: c.climateType, forests: true });
  const on = bandTreesPixel({ woods, px: ash[0], py: ash[1], archive: c.natureArchive, climateType: c.climateType, forests: true, lands: true });
  assert.ok(off.length / 4 > 5 * (on.length / 4), `the Ashlands' few (${on.length / 4}) against the climate's (${off.length / 4})`);
  const trees = new Set(LANDS.morrowindAshlands.flora.trees.map(([a, r]) => `${a}:${r}`));
  for (let i = 3; i < on.length; i += 4) {
    const [a, r] = bandTreeArt(c.natureArchive, on[i]);
    assert.ok(trees.has(`${a}:${r}`) && isTreeRecord(a, r), `a Tree of its recipe (${a}:${r})`);
  }
  for (let i = 3; i < off.length; i += 4) assert.ok(off[i] < 256 && TREE_RECORDS[c.natureArchive].includes(off[i]), 'off: the climate\'s own records');
  assert.equal(bandTreeCode(510, { archive: 503, record: 11 }), 503 * 256 + 11);
  assert.equal(bandTreeCode(510, { archive: 510, record: 11 }), 11);
  assert.equal(bandTreeCode(510, { record: 11 }), 11);
  assert.deepEqual(bandTreeArt(510, 503 * 256 + 11), [503, 11]); assert.deepEqual(bandTreeArt(510, 11), [510, 11]);
  // the instances: a tree's own archive's layer
  const asked = [];
  const it = bandInstanceSteps([{ px: 0, py: 0, archive: 510, trees: Float32Array.from([1, 2, 3, 503 * 256 + 12, 4, 5, 6, 24]) }], 0, 0, (a, r) => { asked.push([a, r]); return 0; });
  while (!it.next().done);
  assert.deepEqual(asked, [[503, 12], [510, 24]]);
});

test('TESA-LANDS THE FAR VIEWS\' BOOK: with the row a vertex past the Bay in a zone reads its own woods, its Trees\' art (its recipe\'s, by their weights) and its ground (the drawn tiles in its dress, at the pack\'s exposure), each read once a zone; a Bay pixel, a zone the table dresses not, and the book without the row its climate\'s (mutants: the zone unread; the weights dropped; the dress undone)', async () => {
  const ash = pixelOf('morrowindAshlands'), climate = tamrielBiomeAt(...ash).climate;
  const green = (n) => ({ width: 8, height: 8, data: Uint8Array.from({ length: 256 }, (_, i) => [40, 120, 40, 255][i % 4] + (i % 4 < 3 ? n : 0)) });
  const asks = [];
  const fake = {
    rgba: async (a, r) => { asks.push(`${a}:${r}`); return a < 500 ? green(r * 10) : { width: 4, height: 4, data: Uint8Array.from({ length: 64 }, (_, i) => (i % 4 === 3 ? 255 : a === 503 ? 200 : 50)) }; },
    classic: async (a, r) => green(r * 10),
    size: async (a) => ({ w: 4, h: a === 503 ? 20 : 10 }),
  };
  const book = createFloraArt({ read: () => fake, lands: true });
  assert.equal(book.lands, true);
  const first = book.floraOf(climate, ...ash);
  assert.equal(first.spec, landsFloraSpec(LANDS.morrowindAshlands.flora), 'its own woods at once');
  assert.equal(first.art, null, 'its art asked, not yet read');
  await new Promise((go) => setTimeout(go, 0));
  const f = book.floraOf(climate, ...ash);
  // its Trees' art: the recipe's, by weight - 510:24 x3, 510:20 x2 (dark), 503:11, 503:12 (light)
  const w = LANDS.morrowindAshlands.flora.trees, wsum = w.reduce((a, p) => a + p[2], 0), w503 = w.filter((p) => p[0] === 503).reduce((a, p) => a + p[2], 0);
  assert.ok(Math.abs(f.art.rgb[0] - (200 * w503 + 50 * (wsum - w503)) / wsum) < 1e-9, 'the colour by the picks\' weights');
  assert.ok(Math.abs(f.art.h - (20 * w503 + 10 * (wsum - w503)) / wsum) < 1e-9, 'the size by them too');
  // its ground: the drawn tiles dressed - the Ashlands' grey, not the green it was read off
  for (const k of ['dirt', 'grass', 'stone']) assert.ok(Math.abs(f.ground[k][0] - f.ground[k][1]) < 25, `${k}: the ash's grey (${f.ground[k].map(Math.round)})`);
  const again = asks.length;
  book.floraOf(climate, ...ash);
  assert.equal(asks.length, again, 'read once a zone');
  // a Bay pixel, and the book without the row: the climate's
  const bay = book.floraOf(climate, 100, 100);
  assert.equal(bay.spec.lands, undefined, 'the Bay its climate\'s');
  const plain = createFloraArt({ read: () => fake }).floraOf(climate, ...ash);
  assert.equal(plain.spec.lands, undefined, 'without the row its climate\'s');
  assert.ok(await landTreeArt({ trees: [] }, fake) === null);
  assert.equal(await landGroundArt(LANDS.morrowindAshlands.ground, 102, { rgba: async () => null }), null);
});

test('TESA-LANDS THE FAR VIEWS\' DOORS: the far ring asks the book at each vertex\'s map pixel - its own grid, the middle ring\'s and the far field\'s - and makes it with the row; the band asks the worker with the row, keyed by it (mutants: the pixel unpassed; the row unread; the band\'s key without the row)', () => {
  const fr = read('src/render/farRing.js');
  assert.match(fr, /const f = floraOf\(climate, px, py\);/);
  assert.match(fr, /\(climate, x, y\) => book\.floraOf\(climate, x, y\)/);
  assert.match(fr, /floraAt: floraOf \? \(x, y, byte, v\) => floraOf\(climAt\(x, y, v\), x, y\) : null,/);
  assert.match(fr, /const floraAt = floraOf \? \(x, y\) => \(\{ \.\.\.floraOf\(climateOf\(x, y\), x, y\), byte: byteAt\(x, y\) \}\) : null;/);
  assert.match(fr, /createFloraArt\(\{ lands: tamrielLandsOn\(\) \}\)/);
  assert.match(fr, /lands: !!\(\/\*\* @type \{any\} \*\/ \(this\._flora\)\.lands\), work: this\._work \}\);/);
  const ft = read('src/render/farTrees.js');
  assert.match(ft, /this\.source\?\.floraBand\?\.\(\{ pixels, forests: !!forests, landform: !!landform, lands: !!lands \}\)/);
  assert.match(ft, /for \(const a of k\.archives\) this\._art\(a\);/);
  assert.match(read('src/world/terrain/terrainGenClient.js'), /landform: job\.landform, lands: !!job\.lands, pixels:/);
  assert.match(read('src/world/terrain/terrainGenWorker.js'), /\$\{m\.landform \? 1 : 0\},\$\{m\.lands \? 1 : 0\}`, \(\) => bandTreesPixel\(\{ woods, px, py, archive, climateType, forests: !!m\.forests, landforms, lands: !!m\.lands \}\)\)/);
});
