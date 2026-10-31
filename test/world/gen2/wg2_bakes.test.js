// WG2 PHASE 2 EXIT (bible/03-World/World-2-Arc.md): THE SHIPPED PROTOTYPE BAKES (public/worldgen2/) are made again from
// the repository alone and match to the byte; the Hammerfell ground holds what the specification asks of it - a range,
// a river valley, a desert basin, dunes, an oasis, plants that differ by place - and Black Marsh's wetland drains low
// and slow. Every plant the law places meets every need it declares. Pins mutation-checked (tools/mutants/wg2.json).
import test from 'node:test';
import assert from 'node:assert/strict';
import { bakeBytes, readBake, BAKE_DIR } from '../../../tools/wg2Bake.mjs';
import { decodeBake, bakePrint } from '../../../src/world/gen2/bakeCodec.js';
import { regionSampler } from '../../../src/world/gen2/regionSampler.js';
import { plantsIn, plantProblems } from '../../../src/world/gen2/vegetation.js';
import { TEST_REGIONS, testRegion } from '../../../src/world/gen2/testRegions.js';
import { WATER_KIND } from '../../../src/world/gen2/hydrology.js';
import { BIOME_TABLE } from '../../../src/world/gen2/tables.js';
import { slopeOf } from '../../../src/world/gen2/gridOps.js';

const file = (id) => `${BAKE_DIR}/${id}.wg2.gz`;
const share = (f, keys) => { const ids = new Set(keys.map((k) => BIOME_TABLE.findIndex((b) => b.key === k))); let n = 0; for (const v of f.data) if (ids.has(v)) n++; return n / f.data.length; };
const H = decodeBake(readBake(file('hammerfell-test'))), M = decodeBake(readBake(file('blackmarsh-test')));
const hs = regionSampler(H), ms = regionSampler(M);

for (const spec of TEST_REGIONS) {
  test(`WG2 REPRODUCIBLE (${spec.id}): the shipped bake is the bake the repository makes - re-run tools/wg2Bake.mjs and commit both when a law moves (mutants: any law of the bake)`, () => {
    assert.equal(bakePrint(readBake(file(spec.id))), bakeBytes(spec).print);
  });
}

test('WG2 HAMMERFELL: a connected range over 2,000 m, a river valley of the second order, a closed desert basin, a dune sea and dry ground over most of it (mutants: the range\'s ridges, the orographic rain, the arid basins kept, the dunes)', () => {
  const e = H.fields.elev, [, top] = e.range();
  assert.ok(top > 2000, `highest ${top}`);
  // the high ground's largest connected piece spans tens of kilometres
  const hi = (k) => e.data[k] > 1700, seen = new Uint8Array(e.data.length);
  let span = 0;
  for (let k = 0; k < e.data.length; k++) {
    if (seen[k] || !hi(k)) continue;
    const q = [k]; seen[k] = 1;
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (let c = 0; c < q.length; c++) {
      const i = q[c] % e.w, j = (q[c] / e.w) | 0;
      x0 = Math.min(x0, i); x1 = Math.max(x1, i); y0 = Math.min(y0, j); y1 = Math.max(y1, j);
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const a = i + di, b = j + dj, n = b * e.w + a; if (a >= 0 && b >= 0 && a < e.w && b < e.h && !seen[n] && hi(n)) { seen[n] = 1; q.push(n); } }
    }
    span = Math.max(span, Math.max(x1 - x0, y1 - y0) / H.header.res * 0.8192);
  }
  assert.ok(span > 40, `the range spans ${span} km`);
  const valley = H.header.rivers.filter((r) => r.order >= 2 && r.raw.length / H.header.res * 0.8192 > 15);
  assert.ok(valley.length >= 1, 'a second-order river runs 15 km or more');
  assert.ok(share(H.fields.biome, ['riparian']) > 0, 'its corridor greens');
  assert.ok(H.header.lakes.some((l) => l.kind === 'terminal' || l.kind === 'playa'), 'a closed basin keeps its water to the air');
  assert.ok(share(H.fields.biome, ['dunes']) > 0.1, 'a dune sea');
  assert.ok(share(H.fields.biome, ['dunes', 'rockDesert', 'steppe']) > 0.7, 'a dry land');
});

test('WG2 OASIS: Tava Wells is a pool in the desert - water at its heart, the oasis green about it, date palms on its rim and none on the dunes (mutants: the pool, the oasis reach, the palm\'s water)', () => {
  const sp = testRegion('hammerfell-test').springs[0];
  const w = hs.waterAt(sp.x, sp.y);
  assert.equal(w?.kind, 'spring');
  assert.ok(hs.heightAt(sp.x, sp.y) < w.surface);
  assert.ok(share(H.fields.biome, ['oasis']) > 0);
  const near = plantsIn(hs, { x: sp.x - 0.5, y: sp.y - 0.5, w: 1, h: 1 });
  assert.ok(near.some((p) => p.species === 'datePalm'), 'palms by the water');
  const dunes = BIOME_TABLE.findIndex((b) => b.key === 'dunes');
  let at = null;
  for (let k = 0; k < H.fields.biome.data.length && !at; k++) if (H.fields.biome.data[k] === dunes && H.fields.biome.get((k % H.fields.biome.w) + 2, ((k / H.fields.biome.w) | 0) + 2) === dunes) at = [H.header.rect.x + ((k % H.fields.biome.w) + 1.5) / 2, H.header.rect.y + (((k / H.fields.biome.w) | 0) + 1.5) / 2];
  const sand = plantsIn(hs, { x: at[0], y: at[1], w: 0.5, h: 0.5 });
  assert.ok(!sand.some((p) => p.species === 'datePalm'), 'no palm far from water');
  assert.notDeepEqual(new Set(near.map((p) => p.species)), new Set(sand.map((p) => p.species)), 'the oasis and the dunes grow different things');
});

test('WG2 PLANTS: every plant placed meets every need its species declares - warmth, water, soil, slope, height and sun - and the same box grows the same plants twice (mutants: a need unchecked, the spacing)', () => {
  for (const [s, boxes] of [[hs, [{ x: 1150, y: 420, w: 1, h: 1 }, { x: 1040, y: 445, w: 1, h: 1 }]], [ms, [{ x: 3260, y: 1300, w: 1, h: 1 }]]]) {
    for (const r of boxes) {
      const a = plantsIn(s, r), b = plantsIn(s, r);
      assert.deepEqual(a, b);
      for (const p of a) assert.deepEqual(plantProblems(s, p), [], `${p.species} at ${p.x},${p.y}`);
    }
  }
});

test('WG2 BLACK MARSH: a wetland - most of its ground waterlogged, scores of pools and lakes, the land all but flat, swamp over a third of it (mutants: the wet hollows, the wetland test, the swamp)', () => {
  let wet = 0;
  for (const v of M.fields.water.data) if (v & WATER_KIND.wetland) wet++;
  assert.ok(wet / M.fields.water.data.length > 0.25, `wetland ${wet}`);
  assert.ok(M.header.lakes.filter((l) => l.kind !== 'playa').length >= 20);
  const slope = slopeOf(M.fields.elev, 819.2 / M.header.res).data.slice().sort((a, b) => a - b);
  assert.ok(slope[slope.length >> 1] < 0.02, `median slope ${slope[slope.length >> 1]}`);
  assert.ok(share(M.fields.biome, ['swamp', 'marsh']) > 0.3);
});

test('WG2 NO CELL EDGES: the ground is read between cells - a dune field ends without a step - and a lake\'s water reaches wherever its ground is under the level beside it, its shore never a cell\'s edge (mutants: the dunes by the nearest cell, the lake by the nearest cell)', () => {
  const DUNE = BIOME_TABLE.findIndex((b) => b.key === 'dunes'), e = H.fields.elev, bio = H.fields.biome, eps = 1e-7;
  let edges = 0, worst = 0;
  for (let j = 0; j < e.h; j += 3) for (let i = 1; i < e.w; i++) {
    if ((bio.get(i - 1, j) === DUNE) === (bio.get(i, j) === DUNE)) continue;
    const x = e.x0 + i / e.res, y = e.y0 + (j + 0.5) / e.res;
    worst = Math.max(worst, Math.abs(hs.heightAt(x + eps, y) - hs.heightAt(x - eps, y))); edges++;
  }
  assert.ok(edges > 50 && worst < 0.25, `${edges} dune edges, the worst step ${worst} m`);
  for (const [bake, s] of [[H, hs], [M, ms]]) {
    const L = bake.fields.lake;
    let under = 0;
    for (let j = 1; j < L.h - 1; j++) for (let i = 1; i < L.w - 1; i++) {
      const id = L.get(i, j);
      if (!id || bake.header.lakes[id - 1].kind === 'playa') continue;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (L.get(i + di, j + dj)) continue;
        // just across the edge, on the dry cell's side
        const x = L.x0 + (i + 0.5 + di * (0.5 + 1e-4)) / L.res, y = L.y0 + (j + 0.5 + dj * (0.5 + 1e-4)) / L.res;
        if (s.heightAt(x, y) >= bake.header.lakes[id - 1].level || s.channel(x, y)) continue;
        under++;
        assert.equal(s.waterAt(x, y)?.kind, 'lake', `${bake.header.id}: ground under lake ${id}'s level at ${x}, ${y} is dry`);
      }
    }
    assert.ok(under > 0, `${bake.header.id}: no shore crosses a cell's edge`);
  }
});
