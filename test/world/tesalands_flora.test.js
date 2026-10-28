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
import { FOREST, TREE_RECORDS, isTreeRecord, compileRecipe, recipeWood, forestCover } from '../../src/world/terrain/terrainNature.js';
import { landsFloraSpec, landsTreePicks, expectedTrees, treesPerTile, bandTreesPixel, bandTreeArt, bandTreeCode, floraSpec, LANDS_WOOD_BINS, midRingCoverPixel, packCover, unpackCover, LANDS_COVER, landsTreesAt, canopyCover, FLORA_WOOD, FLORA_GRASS } from '../../src/world/terrain/floraCover.js';
import { midRingVertices } from '../../src/render/midRing.js';
import { midRingSide } from '../../src/world/terrain/midRingGrid.js';
import { ringHeight } from '../../src/render/farRing.js';
import { LANDS, forestQuantile, FOREST_QUANTILES } from '../../src/world/tamriel/tamrielLands.js';
import { tamrielBiomeAt } from '../../src/world/tamriel/tamrielBiomes.js';
import { tamrielFrameInBay } from '../../src/world/tamriel/tamrielFrame.js';
import { getWorldClimateSettings } from '../../src/formats/mapsFile.js';
import { LAND_PROP_FLOATS, landMeasures, FLAT_CLEAR, LAND_KIND_LAW, LAND_LOOK_NAMES, standLandProps, flatsOffProps, landFeetOff } from '../../src/world/lands/landProps.js';
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
  // the landmarks the same: a tile the neighbour owns stands its landmarks (or none of the pixel's own) - the flats' border
  const looksOf = (key) => new Set(LANDS[key].props.flatMap((p) => p.looks)), mineL = looksOf(own), theirsL = looksOf(east);
  const marks = (k) => { const out = []; for (let i = 0; i < k.landProps.length; i += LAND_PROP_FLOATS) out.push({ x: k.landProps[i], z: k.landProps[i + 2], look: LAND_LOOK_NAMES[k.landProps[i + 7]] }); return out; };
  const ownBy = (k) => marks(k).filter((l) => byEdge(l) && mineL.has(l.look) && !theirsL.has(l.look)).length;
  const theirs2 = (k) => marks(k).filter((l) => theirsL.has(l.look) && !mineL.has(l.look));
  assert.equal(theirs2(whole).length, 0, 'unblended: the pixel\'s own landmarks whole');
  assert.ok(theirs2(blended).length > 0 || ownBy(blended) < ownBy(whole), `${own} -> ${east}: the border's landmarks its owner's (${theirs2(blended).length} theirs; ${ownBy(blended)} own by the edge against ${ownBy(whole)})`);
  assert.ok(theirs2(blended).every(byEdge), 'each by an edge the neighbour holds');
});

test('TESA-LANDS THE FLATS KEEP OFF THE LANDMARKS\' FEET - THE ONES STOOD: no flat stands within a kept bodied landmark\'s foot and FLAT_CLEAR, nor in a kept vineyard\'s tile; a landmark the gate\'s clearing or a rock drops leaves its ground\'s own flats (AUDIT: the worker had cleared them under every landmark); the feet\'s grid answers as every foot asked (mutants: the flats unfiltered; the clearance dropped; the kernel clearing again; the grid\'s neighbours unasked)', () => {
  for (const key of ['morrowindAshlands', 'summersetVineCoast', 'blackMarshHist']) {
    const at = pixelOf(key);
    if (!at) continue;
    const k0 = kernel(...at, true), tileM = 819.2 / 128;
    assert.ok(k0.landProps.length > 0, `${key}: its landmarks`);
    // the build's: those west of the middle dropped (as the gate's clearing or a rock drops one), the rest kept
    const stood = standLandProps(...at, k0.landProps, (x) => x >= 409.6), p = stood?.set.props ?? new Float32Array(0);
    const k = { nature: flatsOffProps(k0.nature.slice(), p, tileM) };
    const under = (q, i) => (landMeasures(LAND_KINDS[q[i + 5]], q[i + 6]).foot + FLAT_CLEAR) * q[i + 4];
    // a flat at every landmark's foot: a kept one's goes, a dropped one's stays (where no kept foot reaches it)
    const q = k0.landProps, feet = [];
    for (let i = 0; i < q.length; i += LAND_PROP_FLOATS) feet.push({ x: q[i], z: q[i + 2], i });
    const left = new Set(flatsOffProps(feet.slice(), p, tileM).map((f) => f.i)), offKept = landFeetOff(p, tileM);
    let dropped = 0;
    for (const f of feet) {
      const bodied = LAND_KIND_LAW[LAND_KINDS[q[f.i + 5]]].body || LAND_KINDS[q[f.i + 5]] === 'vines';
      if (f.x >= 409.6 && bodied) assert.ok(!left.has(f.i), `${key}: a kept landmark's foot clear`);
      if (f.x < 409.6 && !offKept(f.x, f.z)) { assert.ok(left.has(f.i), `${key}: a dropped landmark's ground its own`); dropped++; }
    }
    assert.ok(dropped > 0, `${key}: landmarks dropped`);
    // the kernel clears none: under its landmarks' feet its flats stand until the build knows which it keeps
    if (key === 'blackMarshHist') assert.ok(k0.nature.some((f) => { for (let i = 0; i < q.length; i += LAND_PROP_FLOATS) if (LAND_KIND_LAW[LAND_KINDS[q[i + 5]]].body && Math.hypot(f.x - q[i], f.z - q[i + 2]) < under(q, i)) return true; return false; }), 'the kernel\'s flats under the feet, the build\'s to keep off');
    // the grid against every foot asked, at points over the pixel
    const off = landFeetOff(k0.landProps, tileM);
    for (let n = 0; n < 4000; n++) {
      const x = (n * 7919) % 8192 / 10, z = (n * 104729) % 8192 / 10;
      let want = false;
      for (let i = 0; i < k0.landProps.length && !want; i += LAND_PROP_FLOATS) {
        const q = k0.landProps, kind = LAND_KINDS[q[i + 5]];
        if (kind === 'vines') want = Math.floor(x / tileM) === Math.floor(q[i] / tileM) && Math.floor(z / tileM) === Math.floor(q[i + 2] / tileM);
        else if (LAND_KIND_LAW[kind].body) want = Math.hypot(x - q[i], z - q[i + 2]) < under(q, i);
      }
      assert.equal(off(x, z), want, `${key}: (${x}, ${z})`);
    }
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

test('TESA-LANDS A ZONE\'S WOODS AFAR: its share expected at FOREST1\'s wood is monotone, its mean over the field\'s own distribution the zone\'s woods; a tile\'s Trees its recipe\'s chance at its rate and ground, by the share of its picks that are Trees (a stump, a mossy rock no canopy); the expectation afar the zone\'s woods, not the climates\' 45% (mutants: the bins reversed; the expectation FOREST1\'s; the rate dropped; the non-Trees counted)', () => {
  for (const key of ['morrowindAshlands', 'skyrimPinewood', 'blackMarshHist', 'elsweyrPlains']) {
    const recipe = LANDS[key].flora, s = landsFloraSpec(recipe);
    assert.equal(landsFloraSpec(recipe), s, 'made once a recipe');
    const all = recipe.trees.reduce((a, p) => a + p[2], 0), trees = recipe.trees.filter(([a, r]) => isTreeRecord(a, r)).reduce((a, p) => a + p[2], 0);
    assert.ok(s.forests && s.lands && Math.abs(s.treeShare - trees / all) < 1e-12, `${key}: its Trees' share of its picks`);
    let last = -1;
    for (let w = 0; w <= 1.0001; w += 1 / (LANDS_WOOD_BINS * 2)) { const v = s.lands.woodOf(Math.min(1, w)); assert.ok(v >= last - 1e-9, `${key}: monotone at ${w}`); last = v; }
    // its mean over the field: FOREST1's wood at each quantile, the zone's expected there
    let sum = 0;
    const N = 2000, sm = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
    for (let k = 0; k < N; k++) sum += s.lands.woodOf(sm(FOREST.edge[0], FOREST.edge[1], forestQuantile((k + 0.5) / N)));
    assert.ok(Math.abs(sum / N - recipe.woods) < 0.04, `${key}: its woods on the whole (${(sum / N).toFixed(3)} against ${recipe.woods})`);
    const c = compileRecipe(recipe), g = c.ground;
    const want = (FOREST.plainTree + (FOREST.forestTree - FOREST.plainTree) * s.lands.woodOf(0.7)) * (g[1] * 0.2 + g[2] * 0.7 + g[3] * 0.1) * c.treeRate * s.treeShare;
    assert.ok(Math.abs(treesPerTile(0.7, 0.2, 0.7, 0.1, s) - want) < 1e-12, `${key}: a tile's Trees`);
    assert.ok(Math.abs(expectedTrees(s, 128) - (FOREST.plainTree + (FOREST.forestTree - FOREST.plainTree) * recipe.woods) * g[2] * c.treeRate * s.treeShare) < 1e-12, `${key}: afar`);
  }
  assert.ok(landsFloraSpec(LANDS.morrowindAshlands.flora).treeShare < 1, 'the Ashlands\' stumps no canopy');
  // a recipe of no Tree (a stump and a mossy rock) grows no canopy afar, whatever its woods
  const none = landsFloraSpec({ woods: 0.5, trees: [[510, 20, 3], [510, 10, 1]], cover: [] });
  assert.equal(none.treeShare, 0);
  assert.equal(expectedTrees(none, 128), 0);
  assert.ok(expectedTrees(landsFloraSpec(LANDS.skyrimPinewood.flora), 128) > 1.5 * expectedTrees(floraSpec(510, false, true), 128), 'the Pinewoods denser than the climates\' woods');
  assert.ok(expectedTrees(landsFloraSpec(LANDS.morrowindAshlands.flora), 128) < 0.1 * expectedTrees(floraSpec(510, false, true), 128), 'the Ashlands a tenth of them');
});

test('TESA-LANDS THE FIELD\'S OWN QUANTILES (the second audit, lane D): FOREST_QUANTILES every 1%, the forest field\'s own - at 120,000 world tiles of the continent\'s frame the share under each tabled value is its own, its tails too; and every zone stands the woods it asks, to half a point (the 5% table read its tail straight, 0.638 to 0.824: the Ashlands\' and the Alik\'r\'s 2% stood 0.05%, the High Peaks\' 3% 0.4%, and the far views stood half again the trees the ground did) (mutants: the tail the old straight line\'s)', () => {
  assert.equal(FOREST_QUANTILES.length, 101);
  const f = tamrielFrameInBay(), N = 120000, vals = new Float64Array(N);
  let seed = 0x7a11e5;
  const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < N; i++) vals[i] = forestCover(Math.floor((f.x0 + rnd() * f.w) * 128), -Math.floor((f.y0 + rnd() * f.h) * 128));
  for (const p of [0.01, 0.02, 0.03, 0.05, 0.1, 0.3, 0.5, 0.7, 0.9, 0.95, 0.97, 0.98, 0.99]) {
    const at = forestQuantile(p);
    let under = 0;
    for (let i = 0; i < N; i++) if (vals[i] < at) under++;
    assert.ok(Math.abs(under / N - p) < 4 * Math.sqrt((p * (1 - p)) / N) + 0.001, `${p}: ${(under / N).toFixed(4)} of the land under ${at.toFixed(4)}`);
  }
  for (const [key, land] of Object.entries(LANDS)) {
    if (!land.flora) continue;
    const c = compileRecipe(land.flora);
    let m = 0;
    for (let i = 0; i < N; i++) m += recipeWood(c, vals[i]);
    assert.ok(Math.abs(m / N - land.flora.woods) < 0.005, `${key}: asks ${land.flora.woods}, stands ${(m / N).toFixed(4)}`);
  }
});

test('TESA-LANDS A TREE AMONG THE COVER (the second audit, lane D): a zone\'s cover stands its Trees at the cover\'s chance, and the far views count them and colour their canopy by them - the Velothi Foothills\' 506:14, a third of its near Trees, had stood none afar (mutants: the cover\'s Trees uncounted; the canopy\'s colour the trees\' alone)', async () => {
  const recipe = LANDS.morrowindVelothiFoot.flora, s = landsFloraSpec(recipe), c = compileRecipe(recipe), g = c.ground;
  const all = recipe.cover.reduce((a, p) => a + p[2], 0), trees = recipe.cover.filter(([a, r]) => isTreeRecord(a, r)).reduce((a, p) => a + p[2], 0);
  assert.ok(trees > 0 && Math.abs(s.coverShare - trees / all) < 1e-12, 'a Tree among its cover, its share');
  for (const wz of [0, 0.3, 1]) {
    const want = ((FOREST.plainTree + (FOREST.forestTree - FOREST.plainTree) * wz) * c.treeRate * s.treeShare + (FOREST.plainCover + (FOREST.undergrowth - FOREST.plainCover) * wz) * c.coverRate * s.coverShare) * g[2];
    assert.ok(Math.abs(landsTreesAt(s, wz, 0, 1, 0) - want) < 1e-12, `its trees' Trees and its cover's at ${wz}`);
  }
  assert.ok(landsTreePicks(recipe).some(([a, r, w]) => a === 506 && r === 14 && w > 0), 'its canopy\'s picks hold it');
  // a zone whose Trees stand among its cover alone still stands a canopy afar
  const only = landsFloraSpec({ woods: 0.3, trees: [[510, 20, 1]], cover: [[504, 12, 1], [510, 20, 1]] });
  assert.equal(only.treeShare, 0); assert.equal(only.coverShare, 0.5);
  assert.ok(expectedTrees(only, 128) > 0 && landsTreesAt(only, 0.3, 0, 1, 0) > 0);
  // the canopy's colour by each Tree's share of the Trees its ground stands: a tree of the woods' chance and one of the cover's
  const fake = { rgba: async (a) => ({ width: 2, height: 2, data: Uint8Array.from({ length: 16 }, (_, i) => (i % 4 === 3 ? 255 : a === 503 ? 200 : 50)) }), size: async () => ({ w: 4, h: 10 }) };
  const mix = { woods: 0.4, trees: [[503, 11, 1]], cover: [[504, 12, 1]] };
  const tw = FOREST.plainTree + (FOREST.forestTree - FOREST.plainTree) * 0.4, cw = FOREST.plainCover + (FOREST.undergrowth - FOREST.plainCover) * 0.4;
  assert.ok(Math.abs((await landTreeArt(mix, fake)).rgb[0] - (200 * tw + 50 * cw) / (tw + cw)) < 1e-9, 'by their chances');
  // every other zone: no Tree among its cover, its far views as they stood
  for (const [key, land] of Object.entries(LANDS)) if (land.flora && key !== 'morrowindVelothiFoot') assert.equal(landsFloraSpec(land.flora).coverShare, 0, key);
});

test('TESA-LANDS A ZONE\'S WOODS IN THE MIDDLE RING (AUDIT): the forest field\'s own value packed a byte a sample (a pixel of the Bay none) and read back within half a level; a zone\'s vertex its recipe\'s edge on it - the Pinewoods\' glades and woods where FOREST1\'s plain read one mean; the worker answers it with the row, the client keeps it, the ring asks it (mutants: the field unread; the job without it; the Bay packed)', () => {
  const pine = pixelOf('skyrimPinewood');
  assert.ok(pine);
  const c = midRingCoverPixel(...pine, 8), half = (LANDS_COVER[1] - LANDS_COVER[0]) / 510 + 1e-9;
  for (let j = 0; j <= 8; j++) {
    for (let i = 0; i <= 8; i++) {
      const want = forestCover(pine[0] * 128 + Math.min(127, i * 16), -pine[1] * 128 + Math.min(127, j * 16));
      assert.ok(Math.abs(unpackCover(c[j * 9 + i]) - Math.min(LANDS_COVER[1], Math.max(LANDS_COVER[0], want))) <= half, `sample ${i},${j}`);
    }
  }
  assert.ok(midRingCoverPixel(100, 100, 8).every((b) => b === 0), 'a pixel of the Bay: none');
  // the Pinewoods' edge (its 80%) on the field: its lowest fifth a glade, above it woods - both under FOREST1's edge (a plain)
  const spec = landsFloraSpec(LANDS.skyrimPinewood.flora), lo = forestQuantile(0.05), hi = forestQuantile(0.4);
  assert.ok(FOREST.edge[0] > hi, 'both on FOREST1\'s plain');
  assert.equal(spec.lands.woodAt(packCover(lo)), 0);
  assert.equal(spec.lands.woodAt(packCover(hi)), 1);
  const edge = compileRecipe(LANDS.skyrimPinewood.flora).edge, mid = (edge[0] + edge[1]) / 2;
  assert.ok(Math.abs(spec.lands.woodAt(packCover(mid)) - 0.5) < 0.2, `its edge where the near ground's is (${spec.lands.woodAt(packCover(mid))})`);
  // a ring of the zone: FOREST1's wood a plain everywhere; the field under its edge to the west, over it to the east
  const radius = 1, sub = 2, side = midRingSide(radius, sub), ART = { rgb: [40, 60, 40], h: 10, w: 6 };
  const flora = new Uint32Array(side * side).fill(((0 << FLORA_WOOD) | (255 << FLORA_GRASS)) >>> 0);
  const cover = Uint8Array.from({ length: side * side }, (_, v) => packCover(v % side < side / 2 ? lo : hi));
  const floraAt = () => ({ spec, art: ART, ground: null, byte: 128 });
  const o = { heights: new Float32Array(side * side).fill(100), baseX: 50, baseY: 60, radius, sub, tintAt: () => [7, 7, 7], seaY: ringHeight(0), flora, floraAt };
  const withField = midRingVertices({ ...o, cover }), without = midRingVertices(o);
  const west = 2 * side + 0, east = 2 * side + side - 1;
  assert.equal(withField.flora[east * 4], Math.round(canopyCover(landsTreesAt(spec, 1, 0, 1, 0), ART.w) * 255), 'the woods over its edge');
  assert.equal(withField.flora[west * 4], Math.round(canopyCover(landsTreesAt(spec, 0, 0, 1, 0), ART.w) * 255), 'a glade under it');
  assert.ok(withField.flora[west * 4] < withField.flora[east * 4]);
  assert.equal(without.flora[west * 4], without.flora[east * 4], 'without the field: the expectation\'s one mean');
  // the doors: the worker answers it with the row, the client keeps it, the ring asks it and builds with it
  assert.match(read('src/world/terrain/terrainGenWorker.js'), /const cover = m\.flora && m\.lands \? buildMidRingHeights\(/);
  assert.match(read('src/world/terrain/terrainGenClient.js'), /if \(m\.cover\) \(cover \?\?= new Uint8Array\(side \* side\)\)\.set\(m\.cover, pj0 \* job\.sub \* side\);/);
  const fr = read('src/render/farRing.js');
  assert.match(fr, /flora: !!floraOf, lands: !!floraOf && !!\(\/\*\* @type \{any\} \*\/ \(this\._flora\)\.lands\) \};/);
  assert.match(fr, /cover: answer\.cover \?\? null, floraAt \}\);/);
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
  // its ground a record a task (the page draws between them): landed within a few
  for (let i = 0; i < 8 && !book.floraOf(climate, ...ash).ground; i++) await new Promise((go) => setTimeout(go, 0));
  const f = book.floraOf(climate, ...ash);
  // its Trees' art: the recipe's Trees, by weight - its snags and its thorn (503, light); its stumps (510:20) no Tree
  const w = LANDS.morrowindAshlands.flora.trees.filter(([a, r]) => isTreeRecord(a, r)), wsum = w.reduce((a, p) => a + p[2], 0), w503 = w.filter((p) => p[0] === 503).reduce((a, p) => a + p[2], 0);
  assert.ok(Math.abs(f.art.rgb[0] - (200 * w503 + 50 * (wsum - w503)) / wsum) < 1e-9, 'the colour by the Trees\' weights');
  assert.ok(Math.abs(f.art.h - (20 * w503 + 10 * (wsum - w503)) / wsum) < 1e-9, 'the size by them too');
  // the weights, and a heavy non-Tree left out: three snags of the desert's (light), a broadleaf (dark), five stumps (none)
  const mixed = await landTreeArt({ trees: [[503, 11, 3], [504, 12, 1], [510, 20, 5]] }, fake);
  assert.ok(Math.abs(mixed.rgb[0] - (200 * 3 + 50) / 4) < 1e-9 && Math.abs(mixed.h - (20 * 3 + 10) / 4) < 1e-9, 'Trees alone, by their weights');
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
  // the ground a record a task: a zone's three solid records never dressed in one (the far field asks many zones at once)
  let landed = false;
  landGroundArt(LANDS.morrowindAshlands.ground, 102, fake).then(() => { landed = true; });
  await new Promise((go) => setTimeout(go, 0));
  assert.equal(landed, false, 'a record a task, not all in one');
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
  assert.match(ft, /own\.add\(bandTreeArt\(archives\[k\], t\[i\]\)\.join\(','\)\);/);
  assert.match(ft, /if \(k\) for \(const a of k\.arts\) this\._wanted\.add\(a\);\n\s+\}\n\s+for \(const a of this\._wanted\) this\._art\(a\);/);
  assert.match(read('src/world/terrain/terrainGenClient.js'), /landform: job\.landform, lands: !!job\.lands, pixels:/);
  assert.match(read('src/world/terrain/terrainGenWorker.js'), /\$\{m\.landform \? 1 : 0\},\$\{m\.lands \? 1 : 0\}`, \(\) => bandTreesPixel\(\{ woods, px, py, archive, climateType, forests: !!m\.forests, landforms, lands: !!m\.lands \}\)\)/);
});
