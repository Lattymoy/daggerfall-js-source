// CROPS (FIELD BUGS 2026-10-04d, the Discord's "missing walls" thread: "The missing walls have farms in them which should
// obviously be outside the walls", a crop field seen through the gap). The RMB Resource Pack's crop prefabs (53211-53214)
// carry no mesh: each is RMBCropBillboardBatch, which sows Daggerfall's own crop billboards round the spot the block
// places it. Beautiful Cities lays them over the farmland its composites run up to the walls (234 placements; Beautiful
// Villages 18). Read again off the component's own source (drcarademono/rmb-resource-pack,
// Scripts/RMBCropBillboardBatch.cs) and its four prefabs, the port's field had drifted from it:
//   - GenerateBillboardPositions loops `for (float x = -rangeX / 2; x <= rangeX / 2; ...)` over an INT rangeX - an 85 m
//     field from -42 to 42, a 35 m one from -17 to 15 - in the world's axes round the batch (the batch's turn unread);
//     the port's ran from -42.5 to 41.5, half a metre off on both axes, and turned the field with its misc record;
//   - AddBillboardsToBatch sows no plant within overlapCheckRadius (1 on all four prefabs) of anything but the terrain
//     (IsOverlapping: Physics.OverlapSphere) - the port's grew through the walls, towers and stand-ins a block stands;
//   - every plant's foot is the batch's own y, the misc model's (RMBLayout.AddProps: propsOffsetY under its record) -
//     the port's stood a tenth of a metre over it;
//   - a plant is GetRandomRecord's pick among the climate's (the port took two in turn), and the second desert's is
//     its own, record 20 (`case MapsFile.Climates.Desert2`), which the port could not tell from the first desert's.
// Pinned on the producers the hosts run (blockFromJson, layoutRmbBlock, collectBlockFlats) over the vendored pack's own
// records; the solids the hosts hand over are the meshes they draw and collide.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import zlib from 'node:zlib';

import { ROW_CODECS } from '../../src/formats/worldData/worldDataPack.js';
import { blockFromJson } from '../../src/formats/worldData/worldDataReplacement.js';
import { CLIMATES } from '../../src/formats/mapsTables.js';
import { layoutRmbBlock, PROPS_OFFSET_Y } from '../../src/world/rmbLayout.js';
import { collectBlockFlats } from '../../src/world/rmbFlats.js';
import { sowField, cropRecordsFor, blockSolids, CROP_OVERLAP_RADIUS, CROP_ARCHIVE } from '../../src/world/flatFields.js';
import { TOWN_CROP_FIELDS, installTownStandIns, _resetTownStandIns } from '../../src/world/townStandIns.js';
import { customModelFor, _resetCustomModels } from '../../src/world/customModels.js';
import { _resetFlatFields } from '../../src/world/flatFields.js';
import { MeshBuilder } from '../../src/world/detStandIns.js';
import { GLOBAL_SCALE } from '../../src/world/meshReader.js';
import { trs } from '../../src/world/mat4.js';
import { hostText } from '../hostText.mjs';   // HOST-SPLIT 2: the world host whole

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const TEMPERATE = 504, DESERT = 503;   // the nature archives (ClimateTextureSet)

const crops = (flats) => flats.filter((f) => f.archive === CROP_ARCHIVE || (f.archive === 511 && f.record === 22));

/** Independent of the code under test: a point's distance to a triangle - the plane's where the foot falls inside it,
 *  else the nearest of its three edges. */
function distToTriangle(p, a, b, c) {
  const sub = (u, v) => [u[0] - v[0], u[1] - v[1], u[2] - v[2]], dot = (u, v) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
  const cross = (u, v) => [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  const n = cross(sub(b, a), sub(c, a)), nn = dot(n, n);
  const seg = (s0, s1) => { const d = sub(s1, s0), t = Math.max(0, Math.min(1, dot(sub(p, s0), d) / (dot(d, d) || 1))); return Math.hypot(...sub(p, [s0[0] + d[0] * t, s0[1] + d[1] * t, s0[2] + d[2] * t])); };
  if (nn > 0) {
    const h = dot(sub(p, a), n) / nn, f = [p[0] - n[0] * h, p[1] - n[1] * h, p[2] - n[2] * h];
    const inside = [[a, b], [b, c], [c, a]].every(([s, e]) => dot(cross(sub(e, s), sub(f, s)), n) >= 0);
    if (inside) return Math.abs(h) * Math.sqrt(nn);
  }
  return Math.min(seg(a, b), seg(b, c), seg(c, a));
}
function nearestFace(models, meshOf, p) {
  let best = Infinity;
  for (const placed of models) {
    const mesh = meshOf(placed);
    if (!mesh) continue;
    const m = placed.matrix, q = mesh.positions;
    const at = (i) => [0, 1, 2].map((k) => m[k] * q[i * 3] + m[4 + k] * q[i * 3 + 1] + m[8 + k] * q[i * 3 + 2] + m[12 + k]);
    for (let t = 0; t < mesh.indices.length; t += 3) best = Math.min(best, distToTriangle(p, at(mesh.indices[t]), at(mesh.indices[t + 1]), at(mesh.indices[t + 2])));
  }
  return best;
}

let towns = true;
_resetCustomModels(); _resetTownStandIns(); _resetFlatFields();
installTownStandIns(() => towns);

// ---- the grid ---------------------------------------------------------------------------------------------------------
test('CROPS the grid: GenerateBillboardPositions over an int range - an 85 m field from -42 to 42 in fours (22 a row), a 35 m one from -17 to 15 (9), each plant within its half-metre nudge of its point; the old -42.5..41.5 is half a metre off (mutants: the two halves)', () => {
  const grid = (h, step) => { const out = []; for (let u = -h; u <= h; u += step) out.push(u); return out; };
  for (const [id, cols, rows] of [[53211, grid(42, 4), grid(42, 4)], [53212, grid(17, 4), grid(42, 4)], [53213, grid(42, 4), grid(17, 4)], [53214, grid(17, 4), grid(17, 4)]]) {
    const spec = TOWN_CROP_FIELDS[id], cx = 51.2, cz = 25.6;
    const field = sowField(spec, TEMPERATE, cx, -0.1, cz);
    assert.equal(field.length, cols.length * rows.length, `${id}: ${cols.length} x ${rows.length}`);
    const used = { u: new Set(), v: new Set() };
    for (const f of field) {
      const u = cols.reduce((best, c) => (Math.abs(f.x - cx - c) < Math.abs(f.x - cx - best) ? c : best));
      const v = rows.reduce((best, r) => (Math.abs(f.z - cz - r) < Math.abs(f.z - cz - best) ? r : best));
      assert.ok(Math.abs(f.x - cx - u) <= spec.noise + 1e-9 && Math.abs(f.z - cz - v) <= spec.noise + 1e-9, `${id}: (${(f.x - cx).toFixed(2)}, ${(f.z - cz).toFixed(2)}) nudged off its point by more than ${spec.noise}`);
      used.u.add(u); used.v.add(v);
    }
    assert.deepEqual([[...used.u].sort((a, b) => a - b), [...used.v].sort((a, b) => a - b)], [cols, rows], `${id}: every point of the grid sown`);
  }
  assert.deepEqual([cols(17), cols(42)].map((c) => [c[0], c[c.length - 1]]), [[-17, 15], [-42, 42]]);
  function cols(h) { return grid(h, 4); }
});

// ---- the batch: its foot, its axes --------------------------------------------------------------------------------------

// ---- the clearance --------------------------------------------------------------------------------------------------------
test('CROPS the clearance (IsOverlapping): every point of the grid is asked at the batch\'s foot with overlapCheckRadius - 1 m - and a point refused is not sown, every other is, in order (mutants: the refusal, the radius)', () => {
  assert.equal(CROP_OVERLAP_RADIUS, 1);
  const spec = TOWN_CROP_FIELDS[53214], asked = [];
  const solid = (x, y, z, r) => { asked.push({ x, y, z, r }); return asked.length % 3 === 0; };
  const field = sowField(spec, TEMPERATE, 10, -0.1, 20, { solid });
  assert.equal(asked.length, 81, 'every point asked');
  assert.ok(asked.every((a) => a.r === 1 && a.y === -0.1), 'with the prefab\'s radius, at the foot');
  const free = asked.filter((_, i) => (i + 1) % 3 !== 0);
  assert.deepEqual(field.map((f) => [f.x, f.z]), free.map((a) => [a.x, a.z]), 'the refused gone, the rest sown where asked');
  assert.deepEqual(sowField(spec, TEMPERATE, 10, -0.1, 20).length, 81, 'nothing asked, nothing refused');
});

test('CROPS the block\'s solids: a metre from any face of a placed model, by its matrix - a corner, an edge, a face; a point deep inside a closed model is a metre from no face (a mesh collider is its surface); a model the host stands nothing for is no solid; laid once, on the first ask (mutants: the reach, the cull, the corner)', () => {
  const m = new MeshBuilder();
  m.box([17, 2], [0, 2, 0], [4, 4, 4]);   // a 4 m cube on the ground, centred on its origin
  const cube = m.build();
  const placed = [{ modelIdNum: 1, matrix: trs(10, 0, 20, 0, 0, 0) }, { modelIdNum: 2, matrix: trs(-50, 0, -50, 0, 0, 0) }];
  let laid = 0;
  const solid = blockSolids(placed, (p) => { laid++; return p.modelIdNum === 1 ? cube : null; });
  assert.equal(laid, 0, 'nothing laid before the first ask');
  const r = CROP_OVERLAP_RADIUS;
  // a face (the cube spans x 8..12, y 0..4, z 18..22)
  assert.equal(solid(12.99, 2, 20, r), true); assert.equal(solid(13.01, 2, 20, r), false);
  assert.equal(solid(7.01, 2, 20, r), true); assert.equal(solid(6.99, 2, 20, r), false);
  assert.equal(solid(10, 2, 17.01, r), true); assert.equal(solid(10, 2, 16.99, r), false);
  // an edge and a corner: the metre round them, not the box's
  const e = 0.99 / Math.SQRT2, f = 1.01 / Math.SQRT2;
  assert.equal(solid(12 + e, 2, 22 + e, r), true); assert.equal(solid(12 + f, 2, 22 + f, r), false);
  const c = 0.99 / Math.sqrt(3), d = 1.01 / Math.sqrt(3);
  assert.equal(solid(8 - c, -c, 18 - c, r), true); assert.equal(solid(8 - d, -d, 18 - d, r), false);
  assert.equal(solid(8 - 0.9, 0, 18 - 0.9, r), false, 'inside the box\'s own reach, outside the corner\'s');
  // inside: two metres from every face at the centre, so no face within a metre
  assert.equal(solid(10, 2, 20, r), false);
  assert.equal(solid(10, 0.5, 20, r), true, 'half a metre over the floor face');
  assert.equal(solid(-50, 0, -50, r), false, 'the model the host stands nothing for');
  assert.equal(laid, 2, 'each model\'s mesh asked once');
  // one triangle, every region round it: off each corner, off each edge, over the face - a hair inside the metre and out
  const tri = { positions: new Float32Array([0, 0, 0, 4, 0, 0, 0, 0, 4]), indices: new Uint32Array([0, 1, 2]) };
  const lone = blockSolids([{ modelIdNum: 3, matrix: trs(100, 0, 100, 0, 0, 0) }], () => tri);
  const s = Math.SQRT1_2;
  for (const [name, at, dir] of [['a', [0, 0, 0], [-s, 0, -s]], ['b', [4, 0, 0], [s, 0, -s]], ['c', [0, 0, 4], [-s, 0, s]],
    ['ab', [2, 0, 0], [0, 0, -1]], ['ac', [0, 0, 2], [-1, 0, 0]], ['bc', [2, 0, 2], [s, 0, s]], ['face', [1, 0, 1], [0, 1, 0]]]) {
    const p = (k) => [100 + at[0] + dir[0] * k, at[1] + dir[1] * k, 100 + at[2] + dir[2] * k];
    assert.equal(lone(...p(0.99), r), true, `${name}: 0.99 m off`);
    assert.equal(lone(...p(1.01), r), false, `${name}: 1.01 m off`);
  }
});

// ---- the plant ----------------------------------------------------------------------------------------------------------

// ---- the hosts ----------------------------------------------------------------------------------------------------------
test('CROPS by source: the streamed world and the one-location exterior hand a field\'s batch the climate and the block\'s solids - the models each drew and collided; the interior and dungeon hosts sow no field', () => {
  const w = hostText('src/scenes/world.js');
  assert.match(w, /const flatOpts = \{ climateIndex: maps\.getClimateIndex\(px, py\), solid: blockSolids\(b\.layout\.models, \(m\) => \(m\.enhancedOnly && !isEnhanced\(\) \? null : cpuModels\.get\(m\.modelIdNum\)\)\) \};\n\s+const blockFlats = collectBlockFlats\(b\.dfBlock, natureArchive, flatOpts\);/);   // PIN MOVED (AUDIT PRECIP HOST-7): the options kept, the block read again in a season
  const e = src('src/scenes/exterior.js');
  assert.match(e, /const fieldSolids = blockSolids\(b\.layout\.models, \(m\) => \(m\.enhancedOnly && !isEnhanced\(\)\) \|\| !gpuMeshes\.get\(m\.modelIdNum\) \? null : cpuModels\.get\(m\.modelIdNum\)\);/);
  assert.match(e, /const blockFlats = collectBlockFlats\(b\.dfBlock, natureArchive, \{ climateIndex: locClimateIndex, solid: fieldSolids \}\)/);
  for (const host of ['src/scenes/worldModes.js', 'src/scenes/dungeonContext.js']) assert.doesNotMatch(src(host), /collectBlockFlats|sowField/, `${host}: no RMB exterior field`);
});
