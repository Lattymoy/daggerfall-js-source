// CHEST3D (2026-10-31, the owner, sending Low_Poly_Chest_Mimic.fbx: "I want to implement this and ensure any chests use
// this. Texture it with daggerfall textures"): the owner's chest baked (tools/bakeChest.mjs), built over Daggerfall's
// pictures (world/chestModel.js) and stood over ARCH3D's three chests, DET's sea chest and the Aurum Coffer. With the
// freeware ARENA2, each fit is held to the classic chest it stands for. tools/mutants/chest3d.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import { bakeChest, chestJson, SOURCE_FBX, OUT_JSON } from '../../tools/bakeChest.mjs';
import {
  chestModel, chestScale, chestUv, registerChestModels, CHEST_MODELS, CHEST_BOXES, CHEST_LOOKS, CHEST_IRON, CHEST_BRASS,
  CHEST_TEXELS_M, AURUM_COFFER_MODELS, AURUM_COFFER_BOX, AURUM_COFFER_LOOK, SEA_CHEST_BOX,
} from '../../src/world/chestModel.js';
import { customModelFor } from '../../src/world/customModels.js';
import { aurumCofferBox } from '../../src/scenes/aurumCacheHost.js';
import { GLOBAL_SCALE } from '../../src/world/meshReader.js';
import { HOUSE_CONTAINER_NAMES } from '../../src/systems/worldTooltips.js';

const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url));
const CHEST = JSON.parse(rd(OUT_JSON).toString());
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const boxOf = (p) => { const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity]; for (let i = 0; i < p.length; i += 3) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], p[i + k]); mx[k] = Math.max(mx[k], p[i + k]); } return { min: mn, max: mx }; };
const centre = (p) => { const c = [0, 0, 0]; for (let i = 0; i < p.length; i += 3) for (let k = 0; k < 3; k++) c[k] += p[i + k] / (p.length / 3); return c; };

test('CHEST3D the bake: the committed JSON is the FBX\'s own bake to the byte; four parts - a base, a lid, a hinge, a latch - and the lid opened by the action\'s widest key, 77 degrees (mutants: the bake stale, the lid shut in the open pose)', () => {
  const fbx = rd(SOURCE_FBX);
  assert.equal(chestJson(bakeChest(fbx)), rd(OUT_JSON).toString(), 'node tools/bakeChest.mjs');
  assert.deepEqual(Object.keys(CHEST.parts), ['base', 'lid', 'hinge', 'latch']);
  assert.deepEqual(Object.keys(CHEST.open), ['lid', 'hinge', 'latch'], 'the base stays as it is');
  assert.ok(CHEST.lidOpenDeg > 70 && CHEST.lidOpenDeg < 85, `${CHEST.lidOpenDeg}`);
  for (const [k, p] of Object.entries({ ...CHEST.parts, ...Object.fromEntries(Object.entries(CHEST.open).map(([n, v]) => [`open ${n}`, v])) })) {
    assert.equal(p.positions.length, p.normals.length * 3, `${k}: three corners a normal`);
    for (let t = 0; t < p.normals.length / 3; t++) {
      const a = p.positions.slice(t * 9, t * 9 + 3), b = p.positions.slice(t * 9 + 3, t * 9 + 6), c = p.positions.slice(t * 9 + 6, t * 9 + 9);
      assert.ok(dot(cross(sub(b, a), sub(c, a)), p.normals.slice(t * 3, t * 3 + 3)) > 0, `${k} triangle ${t}: wound to its outside`);
    }
  }
  const lidShut = boxOf(CHEST.parts.lid.positions), lidOpen = boxOf(CHEST.open.lid.positions);
  assert.ok(lidOpen.max[1] > lidShut.max[1] + 0.5, 'open, the lid stands up');
  assert.ok(lidOpen.min[2] < lidShut.min[2], 'and swings back over its hinge');
});

test('CHEST3D the frame: on the floor, the base\'s middle at the origin, the latch to the front (+z) and the hinge at the back - Daggerfall\'s furniture faces +z (mutants: the frame turned, the origin off the floor)', () => {
  const base = boxOf(CHEST.parts.base.positions);
  assert.ok(Math.abs(base.min[1]) < 1e-6, 'on the floor');
  assert.ok(Math.abs(base.min[0] + base.max[0]) < 1e-3 && Math.abs(base.min[2] + base.max[2]) < 1e-3, 'its middle at the origin');
  assert.ok(base.max[0] - base.min[0] > base.max[2] - base.min[2], 'longer along x');
  assert.ok(centre(CHEST.parts.latch.positions)[2] > base.max[2] - 0.1, 'the latch on the front');
  assert.ok(centre(CHEST.parts.hinge.positions)[2] < base.min[2] + 0.1, 'the hinge at the back');
});

test('CHEST3D the model: each classic chest\'s stands inside its box, on its floor, in its middle; the body and lid in its own wood (TEXTURE.067), the hinge iron and the latch brass (TEXTURE.000), every face at Daggerfall\'s 40 texels a metre; shut and open (mutants: the scale past the box, the latch\'s picture the wood\'s, the density)', () => {
  for (const id of CHEST_MODELS) {
    const box = CHEST_BOXES[id], m = chestModel(box, CHEST_LOOKS[id]), b = boxOf(m.positions);
    for (let k = 0; k < 3; k++) assert.ok(b.min[k] >= box.min[k] - 1e-4 && b.max[k] <= box.max[k] + 1e-4, `${id}: inside its box on axis ${k}`);
    assert.ok(Math.abs(b.min[1] - box.min[1]) < 1e-4, `${id}: on its floor`);
    assert.ok(Math.abs(b.max[0] - box.max[0]) < 1e-3 || Math.abs(b.max[1] - box.max[1]) < 1e-3 || Math.abs(b.max[2] - box.max[2]) < 1e-3, `${id}: as large as it fits`);
    const pics = m.subMeshes.map((s) => `${s.textureArchive}:${s.textureRecord}`);
    assert.deepEqual(new Set(pics), new Set([...new Set([CHEST_LOOKS[id].body.join(':'), CHEST_LOOKS[id].lid.join(':')]), CHEST_IRON.join(':'), CHEST_BRASS.join(':')]), `${id}: ${pics}`);
    assert.ok(CHEST_LOOKS[id].body[0] === 67 && CHEST_LOOKS[id].lid[0] === 67, 'Daggerfall\'s wood');
    assert.equal(m.indices.length, m.positions.length / 3);
    assert.equal(m.subMeshes.reduce((n, s) => n + s.primitiveCount, 0) * 3, m.indices.length);
    const open = chestModel(box, CHEST_LOOKS[id], true);
    assert.ok(boxOf(open.positions).max[1] > b.max[1], `${id}: open, the lid above the shut chest`);
  }
  assert.equal(CHEST_TEXELS_M, Math.round(1 / GLOBAL_SCALE), 'a texel a classic unit');
  assert.deepEqual(chestUv([0.32, 0.64, 0], [0, 0, 1]), [(0.64 * 40) / 32, (0.32 * 40) / 64], 'a front: across its height, the grain along x');
  assert.deepEqual(chestUv([0, 0.32, 0.64], [1, 0, 0]), [(0.32 * 40) / 32, (0.64 * 40) / 64], 'an end: the grain along z');
  assert.ok(chestScale(CHEST_BOXES[41811]) > 0.15 && chestScale(CHEST_BOXES[41811]) < 0.25);
});

test('CHEST3D on the model door: ARCH3D\'s three chests, DET\'s sea chest and the Aurum Coffer shut and open answer as the chest - the pipeline registers them before any model is asked; the coffer in its picture\'s box, bound in gold (mutants: a chest left to ARCH3D, the coffer open when shut, the pipeline unregistered)', async () => {
  registerChestModels();
  assert.deepEqual(CHEST_MODELS, Object.keys(HOUSE_CONTAINER_NAMES).filter((id) => HOUSE_CONTAINER_NAMES[id] === 'Chest').map(Number), 'every model the game calls a chest');
  for (const id of CHEST_MODELS) assert.deepEqual(boxOf(customModelFor(id).positions), boxOf(chestModel(CHEST_BOXES[id], CHEST_LOOKS[id]).positions), `${id}`);
  const shut = customModelFor(AURUM_COFFER_MODELS.shut), open = customModelFor(AURUM_COFFER_MODELS.open);
  assert.ok(boxOf(open.positions).max[1] > boxOf(shut.positions).max[1] + 0.1, 'the open coffer\'s lid up');
  const cb = aurumCofferBox([0, 0, 0]), sb = boxOf(shut.positions);
  for (let k = 0; k < 3; k++) assert.ok(sb.min[k] >= cb.min[k] - 1e-4 && sb.max[k] <= cb.max[k] + 1e-4, `the coffer inside its press box on axis ${k}`);
  assert.deepEqual([AURUM_COFFER_BOX.max[1], AURUM_COFFER_BOX.max[0]].map((v) => +v.toFixed(4)), [+(cb.max[1]).toFixed(4), +(cb.max[0]).toFixed(4)]);
  assert.deepEqual([AURUM_COFFER_LOOK.hinge[0], AURUM_COFFER_LOOK.latch[0]], [0, 0], 'gold swatches');
  assert.deepEqual(shut.subMeshes.map((s) => `${s.textureArchive}:${s.textureRecord}`).sort(), ['0:2', '0:3', '67:3'].sort());
  const { DET_MODELS } = await import('../../src/world/detStandIns.js').catch(() => ({ DET_MODELS: null }));
  const sea = (DET_MODELS?.[45190] ?? null)?.();
  if (sea) assert.deepEqual(boxOf(sea.positions), boxOf(chestModel(SEA_CHEST_BOX, { body: [67, 2], lid: [67, 2] }).positions), 'DET\'s sea chest');
  assert.ok(rd('src/world/detStandIns.js').toString().includes('45190: () => chestModel(SEA_CHEST_BOX, SEA_CHEST_LOOK),'), 'the sea chest is the chest');
  assert.ok(/export function createDataPipeline\([^)]*\) \{\n {2}registerChestModels\(\);/.test(rd('src/scenes/dataPipeline.js').toString()), 'registered as the pipeline is made');
});

const ARENA2 = process.env.ARENA2_PATH ?? '';
const HAS = !!ARENA2 && existsSync(join(ARENA2, 'ARCH3D.BSA'));
test('CHEST3D with ARENA2: each classic chest\'s box is ARCH3D\'s own, measured as meshReader.js builds it, and each look\'s wood is a record the classic chests wear (mutants: a box typed off its model)', { skip: HAS ? false : 'ARENA2_PATH not set - the freeware is fetched by tools/fetch-data.sh' }, async () => {
  const { Arch3dFile } = await import('../../src/formats/arch3dFile.js');
  const { dfMeshToModel } = await import('../../src/world/meshReader.js');
  const arch = new Arch3dFile(); arch.load(new Uint8Array(readFileSync(join(ARENA2, 'ARCH3D.BSA'))));
  const worn = new Set();
  for (const id of CHEST_MODELS) {
    const mesh = arch.getMesh(arch.getRecordIndex(id));
    for (const sm of mesh.subMeshes) worn.add(`${sm.textureArchive}:${sm.textureRecord}`);
    const b = boxOf(dfMeshToModel(mesh, () => ({ width: 64, height: 64 })).positions);
    for (const end of ['min', 'max']) for (let k = 0; k < 3; k++) assert.ok(Math.abs(b[end][k] - CHEST_BOXES[id][end][k]) < 2e-3, `${id} ${end}[${k}]: ${b[end][k]} against ${CHEST_BOXES[id][end][k]}`);
  }
  assert.ok(worn.has('67:0') && worn.has('67:1'), 'the classic chests wear TEXTURE.067');
});
