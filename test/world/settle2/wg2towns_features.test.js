// WG2-TOWNS FEATURES ("Buildings and settlements"): a World 2.0 town's features stood as
// models of the shells' lane - every baked feature but a field one model (a wall its run's pieces), at its place facing its
// way at its level; its wall solid and open at its gates; its docks', bridges' and platforms' decks at their level over
// the water or the marsh, its stairs climbable; its fields its crop ground; its terraces' edges shut to its walkers but at
// their stairs; and no town standing without the Landforms row. Mutation-checked (tools/mutants/wg2towns.json).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readBake, BAKE_DIR } from '../../../tools/wg2Bake.mjs';
import { decodeBake } from '../../../src/world/gen2/bakeCodec.js';
import { gen2Install } from '../../../src/world/gen2/gen2Ground.js';
import * as W from '../../../src/formats/worldData/worldDataReplacement.js';
import { layoutRmbBlock } from '../../../src/world/rmbLayout.js';
import { isSolidModel } from '../../../src/world/customModels.js';
import { createWorldPlaces } from '../../../src/world/worldWide/worldPlaces.js';
import { STEP_OFFSET } from '../../../src/player/motor.js';
import * as T from '../../../src/world/settle2/settle2Towns.js';
import * as Bk from '../../../src/world/settle2/settle2Blocks.js';
import { isShellId, shellShapeOf } from '../../../src/world/settle2/settle2Shell.js';
import { featureShapeOf, featureModel, isSettle2ModelId, settle2Features, FEATURE_M, wallId, gateId, retainingId, stairsId, propId, deckId } from '../../../src/world/settle2/settle2Features.js';
import { createSettle2Places, SETTLE2_SOURCE } from '../../../src/scenes/settle2Host.js';

const bakes = ['hammerfell-test', 'blackmarsh-test'].map((id) => readBake(`${BAKE_DIR}/${id}.wg2.gz`)), fit = decodeBake(bakes[0]).header.fit;
gen2Install(bakes, fit); W.installWorldDataReplacement(); Bk.installSettle2();
const TOWNS = T.settle2Towns(), P = 819.2, B = 102.4;
const served = (name) => W.getDFBlockReplacementData(W.getNewDFBlockIndex(name), name);
/** Every feature model a town's blocks stand: its kind, its anchor (pixel-local metres and over the plane) and its axes. */
function standing(at) {
  const out = [];
  for (let i = 0; i < 64; i++) {
    const bx = i % 8, by = Math.floor(i / 8), block = served(T.settle2BlockName(at.town.ordinal, bx, by));
    for (const m of layoutRmbBlock(block).models) {
      if (m.recordIndex != null || !isSettle2ModelId(m.modelIdNum)) continue;
      const M = m.matrix;
      out.push({ id: m.modelIdNum, shape: featureShapeOf(m.modelIdNum), x: bx * B + M[12], y: M[13], z: by * B + M[14], fwd: [-M[8], -M[10]], side: [M[0], M[2]], block });
    }
  }
  return out;
}
const local = (at, p) => [(p[0] - at.px) * P, (at.py + 1 - p[1]) * P];
const near = (a, b, m) => Math.hypot(a[0] - b[0], a[1] - b[1]) < m;

test('WG2-TOWNS FEATURES: every baked feature but a field stands as one model of the lane (a wall as its run\'s pieces) at its place, facing its way, at its level; each id its shape read back, never a shell\'s (mutants: a kind\'s anchor, a feature\'s turn, its level)', () => {
  let n = 0;
  for (const at of TOWNS) {
    const got = standing(at), base = T.settle2Base(at.town), count = (k) => got.filter((g) => g.shape.kind === k).length;
    for (const kind of ['well', 'stall', 'stairs', 'retaining', 'gate', 'dock', 'bridge', 'platform']) assert.equal(count(kind), at.town.features.filter((f) => f.kind === kind).length, `${at.town.id}: its ${kind}s`);
    if (at.town.features.some((f) => f.kind === 'wall')) assert.ok(count('wall') >= 40, `${at.town.id}: its wall's pieces`);
    else assert.equal(count('wall'), 0);
    for (const g of got) {
      assert.ok(!isShellId(g.id) && g.id < 2 ** 31, 'a feature, not a shell');
      const s = g.shape, re = { wall: () => wallId(s.len, s.tall), gate: () => gateId(s.tall, s.clear), retaining: () => retainingId(s.w, s.d, s.drop), stairs: () => stairsId(s.rise), well: () => propId(0, s.roofRec), stall: () => propId(1, s.roofRec), dock: () => deckId(0, s.len, s.wide, s.rise, s.piles), bridge: () => deckId(1, s.len, s.wide, s.rise, s.piles), platform: () => deckId(2, s.len, s.wide, s.rise, s.piles) };
      assert.equal(re[s.kind](), g.id, `${s.kind} read back`);
    }
    // the single-place kinds at their feature's place, facing its way; a terrace's and a stilt house's at its building's level
    for (const f of at.town.features.filter((x) => ['gate', 'retaining', 'stairs', 'platform', 'dock', 'stall'].includes(x.kind))) {
      const c = local(at, f.at), g = got.find((x) => x.shape.kind === f.kind && near([x.x, x.z], c, 0.05));
      assert.ok(g, `${at.town.id} ${f.kind} at ${c}`);
      const dir = f.dir ?? at.town.buildings.find((b) => b.at.x === f.at[0] && b.at.y === f.at[1]).at.dir;
      assert.ok(g.fwd[0] * dir[0] - g.fwd[1] * dir[1] > 0.9999, `${at.town.id} ${f.kind} faces its way`);
      const b = at.town.buildings.find((x) => (x.at.x === f.at[0] && x.at.y === f.at[1]) || (x.doors[0]?.x === f.at[0] && x.doors[0]?.y === f.at[1]));
      if (['retaining', 'stairs', 'platform'].includes(f.kind)) assert.ok(Math.abs(base + g.y - T.sceneOf(b.ground.level)) < 0.013, `${at.town.id} ${f.kind} at its building's level`);
      n++;
    }
  }
  assert.ok(n > 90);
});

test('WG2-TOWNS WALLS AND GATES: a wall and a retaining ring are solid; a wall stands nowhere across a gate\'s way, and a gate\'s opening is clear under its lintel - a body walks through (mutants: the gate\'s cut, the lintel\'s height, the family solid)', () => {
  for (const at of TOWNS) {
    const got = standing(at), pieces = got.filter((g) => g.shape.kind === 'wall');
    for (const g of got.filter((x) => ['wall', 'retaining', 'gate'].includes(x.shape.kind))) assert.ok(isSolidModel(g.id), `${g.shape.kind} solid`);
    for (const f of at.town.features.filter((x) => x.kind === 'gate')) {
      const c = local(at, f.at), d = [f.dir[0], -f.dir[1]];
      for (let t = -6; t <= 6; t += 0.25) {
        const p = [c[0] + d[0] * t, c[1] + d[1] * t];
        for (const w of pieces) {
          const dx = p[0] - w.x, dz = p[1] - w.z, along = Math.abs(dx * w.side[0] + dz * w.side[1]), across = Math.abs(dx * w.fwd[0] + dz * w.fwd[1]);
          assert.ok(!(along <= w.shape.len / 2 && across <= FEATURE_M.wall / 2), `${at.town.id}: a wall piece across the gate at ${p}`);
        }
      }
      const g = got.find((x) => x.shape.kind === 'gate' && near([x.x, x.z], c, 0.05)), m = featureModel(g.id);
      assert.ok(g.shape.clear >= FEATURE_M.clear + FEATURE_M.foot - 0.5 && g.shape.clear < g.shape.tall, 'a lintel over a body\'s head');
      // a body's rays through the opening, along its way, from its feet to its head and across its width: nothing in them
      for (const y of [FEATURE_M.foot + 0.3, FEATURE_M.foot + 1, FEATURE_M.foot + 1.8, g.shape.clear - 0.2]) for (const x of [-1.5, 0, 1.5]) {
        assert.ok(!hits(m, [x, y, -10], [0, 0, 1], 20), `${at.town.id}: the gate's opening blocked at ${x}, ${y}`);
      }
      assert.ok(hits(m, [FEATURE_M.opening / 2 + 1, FEATURE_M.foot + 1, -10], [0, 0, 1], 20), 'and its towers solid');
    }
  }
});

/** Whether a ray (origin, unit way, length) meets a triangle of a model (Moller-Trumbore). */
function hits(m, o, d, len) {
  const P = m.positions, V = (k) => [P[k * 3], P[k * 3 + 1], P[k * 3 + 2]], sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  for (let i = 0; i < m.indices.length; i += 3) {
    const a = V(m.indices[i]), e1 = sub(V(m.indices[i + 1]), a), e2 = sub(V(m.indices[i + 2]), a), h = cross(d, e2), det = dot(e1, h);
    if (Math.abs(det) < 1e-9) continue;
    const s = sub(o, a), u = dot(s, h) / det, q = cross(s, e1), v = dot(d, q) / det, t = dot(e2, q) / det;
    if (u >= 0 && v >= 0 && u + v <= 1 && t > 0 && t < len) return true;
  }
  return false;
}
/** A model's walkable tops (faces whose normal is up), as their heights, highest first. */
const tops = (m) => { const ys = new Set(); for (let i = 0; i < m.normals.length; i += 3) if (m.normals[i + 1] > 0.99) ys.add(Math.round(m.positions[i + 1] * 1000) / 1000); return [...ys].sort((a, b) => b - a); };
test('WG2-TOWNS DECKS AND STAIRS: a dock\'s and a bridge\'s deck stand at their level over the water, their piles to its bed; a stilt house\'s platform is its floor\'s deck, its legs to the marsh and a stair down; every stair climbs its rise a body\'s step at a time (mutants: the deck\'s level, the piles, the platform\'s stair, a tread)', () => {
  for (const at of TOWNS) {
    const { placed } = settle2Features(at.town, (x, y) => at.region.heightAt(x, y), (x, y) => at.region.waterAt(x, y));
    for (const f of placed.filter((x) => x.kind === 'dock' || x.kind === 'bridge')) {
      const s = featureShapeOf(f.id), far = [f.at[0] + (f.dir[0] * s.len) / P, f.at[1] + (f.dir[1] * s.len) / P], mid = [(f.at[0] + far[0]) / 2, (f.at[1] + far[1]) / 2];
      const w = at.region.waterAt(...mid), m = featureModel(f.id), lo = Math.min(...m.positions.filter((_, i) => i % 3 === 1));
      assert.ok(!w || f.z + s.rise / 2 >= w.surface + 0.5, `${at.town.id} ${f.kind}: its deck over the water`);
      assert.ok(f.z + lo <= at.region.heightAt(...mid), `${at.town.id} ${f.kind}: its piles to the bed`);
      assert.ok(Math.abs(s.rise) / s.len < 0.5, 'walkable');
    }
    for (const b of at.town.buildings.filter((x) => x.ground.kind === 'stilts')) {
      const f = placed.find((x) => x.kind === 'platform' && x.at[0] === b.at.x && x.at[1] === b.at.y), plat = at.town.features.find((x) => x.kind === 'platform' && x.at[0] === b.at.x);
      assert.ok(f && f.z === b.ground.level, `${b.id}: its platform at its floor`);
      const m = featureModel(f.id), ys = tops(m), lo = Math.min(...m.positions.filter((_, i) => i % 3 === 1));
      assert.equal(ys[0], 0, 'the deck\'s top its floor');
      assert.ok(lo <= -plat.stilts, `${b.id}: legs to the ground`);
      for (let i = 1; i < ys.length; i++) assert.ok(ys[i - 1] - ys[i] <= STEP_OFFSET, `${b.id}: its stair a step at a time`);
      assert.ok(ys[ys.length - 1] <= -plat.stilts + STEP_OFFSET, 'down to the ground');
    }
    for (const f of placed.filter((x) => x.kind === 'stairs')) {
      const s = featureShapeOf(f.id), ys = tops(featureModel(f.id)), all = [0, ...ys, -s.rise].sort((a, b) => b - a);
      for (let i = 1; i < all.length; i++) assert.ok(all[i - 1] - all[i] <= STEP_OFFSET, `${at.town.id}: a stair of ${s.rise} m climbs a step at a time`);
      assert.ok(ys.length >= Math.ceil(Math.abs(s.rise) / FEATURE_M.rise) - 1, 'its treads');
    }
  }
});

test('WG2-TOWNS FIELDS AND WALKERS: Tava Wells\' fields in its pixel read as Daggerfall\'s crop ground; a terrace\'s edge is shut to the walkers but at its stair, and so are the well and the stalls (mutants: the crop record, the ring\'s gap, a closed band)', () => {
  const tava = T.settle2TownAt(1046, 452);
  let crops = 0, inPixel = 0;
  for (const f of tava.town.features.filter((x) => x.kind === 'field')) {
    const [x, z] = local(tava, f.at);
    if (x < 0 || z < 0 || x >= P || z >= P) continue;
    inPixel++;
    const bx = Math.floor(x / B), by = Math.floor(z / B), tile = served(T.settle2BlockName(tava.town.ordinal, bx, by)).rmbBlock.fldHeader.groundData.groundTiles[Math.floor((x - bx * B) / 6.4)][15 - Math.floor((z - by * B) / 6.4)];
    if (tile.textureRecord === 54) crops++;
  }
  assert.ok(inPixel > 10 && crops === inPixel, `crop ground under ${crops} of ${inPixel} fields`);
  const auto = (at, p) => { const bx = Math.floor(p[0] / B), by = Math.floor(p[1] / B), a = served(T.settle2BlockName(at.town.ordinal, bx, by)).rmbBlock.fldHeader.autoMapData; return a[(63 - Math.floor((p[1] - by * B) / 1.6)) * 64 + Math.floor((p[0] - bx * B) / 1.6)]; };
  const hold = T.settle2TownAt(1095, 420);
  for (const f of hold.town.features.filter((x) => x.kind === 'retaining')) {
    const b = hold.town.buildings.find((x) => x.at.x === f.at[0]), c = local(hold, f.at), n = [f.dir[0], -f.dir[1]], t = [-n[1], n[0]];
    const hw = b.footprint[0] / 2 + 0.5, hd = b.footprint[1] / 2 + 0.5;
    // every cell its side's and its back's lines cross is shut - its band, or a building beside it: no diagonal gap
    for (let k = -1; k <= 1; k += 0.05) {
      const at = (u, v) => [c[0] + t[0] * u + n[0] * v, c[1] + t[1] * u + n[1] * v];
      assert.notEqual(auto(hold, at(hw, k * (hd - 1.2))), 0, `${b.id}: its side shut where its line runs`);
      assert.notEqual(auto(hold, at(k * hw, -hd)), 0, `${b.id}: its back shut where its line runs`);
    }
    assert.equal(auto(hold, [c[0] + n[0] * (hd + 0.8), c[1] + n[1] * (hd + 0.8)]), 0, `${b.id}: open at its stair, a cell's half-diagonal past its walls`);
  }
  const well = hold.town.features.find((x) => x.kind === 'well');
  assert.equal(auto(hold, local(hold, well.at)), 0xfe, 'the well shut');
});

test('WG2-TOWNS LANDFORMS GATE: with the Landforms row off no town stands and none is listed - the world\'s own places take the pixel; the host reads the row as the world host does (mutants: the gate, its read)', () => {
  const places = createWorldPlaces(), index = new Map();
  const off = createSettle2Places({ locationIndex: index, worldPlaces: places, maps: { getRegionIndexAt: () => 63, getClimateIndex: () => 224 }, base: { mapTableData: {}, exterior: { exteriorData: {} } }, host: { _locIndexGen: 0 }, landform: false });
  for (const at of TOWNS) {
    assert.equal(off.locationAt(at.px, at.py), null, `${at.town.id} stands nowhere`);
    assert.equal(off.peekAt(at.px, at.py), null);
    assert.equal(places.at(at.px, at.py), null, 'and is no place');
  }
  assert.ok(!places.sources().includes(SETTLE2_SOURCE));
  assert.equal(index.size, 0);
  const rd = (f) => readFileSync(new URL(`../../../${f}`, import.meta.url), 'utf8');
  assert.match(rd('src/scenes/settle2Host.js'), /export function createSettle2Places\(\{ locationIndex, worldPlaces, maps, base, host, landform = landformsOn\(\) \}\) \{\n\s+if \(!landform\) \{ _live = null; return \{ locationAt: \(\) => null, peekAt: \(\) => null \}; \}/);
  assert.match(rd('src/scenes/world.js'), /const landform = landformsOn\(\);/, 'the world host\'s own read of the row');
  assert.doesNotMatch(rd('src/scenes/tamrielPlacesHost.js'), /createSettle2Places\([^)]*landform/, 'the places host hands it none of its own');
});

test('WG2-TOWNS FOOTINGS: a building\'s walls reach down to the lowest ground the stream draws under it - the region\'s at every node of the kernel\'s grid about its footprint - so no wall stands over a gap, a terrace\'s narrow pad and all (mutants: the footing\'s law)', () => {
  let deep = 0;
  for (const at of TOWNS) Bk.settle2TownRecords(at).forEach((r, i) => {
    const b = at.town.buildings[i];
    if (b.ground.kind === 'stilts') return;
    const n = b.at.dir, t = [-n[1], n[0]], [w, d] = b.footprint;
    let low = Infinity;
    for (const [s, k] of [[-1, -1], [1, -1], [1, 1], [-1, 1], [0, 0]]) {
      const x = b.at.x + (t[0] * s * w / 2 + n[0] * k * d / 2) / P, y = b.at.y + (t[1] * s * w / 2 + n[1] * k * d / 2) / P;
      for (const [di, dj] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
        const ni = Math.floor((x - at.px) * 128) + di, nj = Math.floor((at.py + 1 - y) * 128) + dj;
        low = Math.min(low, at.region.heightAt(at.px + ni / 128, at.py + 1 - nj / 128));
      }
    }
    assert.ok(b.at.z - shellShapeOf(r.shell).foot <= low, `${b.id}: its walls to ${b.at.z - shellShapeOf(r.shell).foot}, the drawn ground to ${low}`);
    if (b.at.z - low > 0.8) deep++;
  });
  assert.ok(deep > 10, 'footings that go deeper than the half metre');
});
