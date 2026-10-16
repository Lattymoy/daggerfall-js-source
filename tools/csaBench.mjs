// PERF-SAILS1 (2026-10-10, Dudey's `?perf=cpu` readout in a port at night: `sails` 5-7.6 ms a frame): THE BOATS' FRAME.
// Come Sail Away's pool (scenes/comeSailAway/comeSailAwayPool.js) over the vendored hulls, N ships standing in a row, its `frame`
// (the walk, the holders' bakes, the lanterns, the flats) and its `draw` (to a stand-in renderer) timed over FRAMES frames after a warm-up. No GL: the
// renderer and the picture pipeline are stand-ins (test/scenes/audit0928_online.test.js's), so the time is the pool's own.
//
//   node tools/csaBench.mjs [ships=12] [frames=600]      BOB=1: each hull pitched and rolled every frame, as navalHost's
//                                                        poseShip rocks a ship in a wind (her MeshObject's local turn)
//   ANIM=1 node tools/csaBench.mjs [ships=12] [frames=600]   PERF-SAILS4: the ships' animators instead (navalHost's poseShip
//                                                        steps each every frame within NEAR_LIFE_M) - every one of them, standing
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createComeSailAwayPool } from '../src/scenes/comeSailAway/comeSailAwayPool.js';
import { Boat, boatAnimators } from '../src/systems/comeSailAway/comeSailAwayBoat.js';

const fileFetch = async (url) => {
  const bytes = readFileSync(fileURLToPath(url));
  return { ok: true, json: async () => JSON.parse(bytes.toString('utf8')), arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length) };
};
const renderer = {
  createMesh: (m) => ({ model: m, buffers: [{}, {}], bounds: [0, 0, 0, 0], subMeshes: m.subMeshes.map((s) => ({ ...s, _bounds: [0, 0, 0, 0] })) }),
  drawMesh() {}, updateMeshVertices() {}, createBillboardBatch: (a, rec, size) => ({ a, rec, size }), destroyBillboardBatch() {}, destroyMesh() {},
};
const texture = () => ({ recordCount: 100, getSize: () => ({ width: 40, height: 64 }), getScale: () => ({ width: 0, height: 0 }) });
const pipeline = { textureFiles: new Map(), cpuModels: new Map(), gpuMeshes: new Map(), getTexture: async () => texture(), uploadRecord() {}, getGpuMesh: async (id) => ({ classic: id }) };

const SHIPS = Number(process.argv[2] || 12);
const FRAMES = Number(process.argv[3] || 600);
const pool = createComeSailAwayPool({ renderer, pipeline, fetchFn: fileFetch, log: { warn() {} } });
await pool.preload();
for (let i = 0; i < SHIPS; i++) { const b = pool.spawnSeaNow(new Boat(i % 5, 0)); b.GameObject.localPosition = [i * 30, 0, 0]; }
const world = { cityLightsOn: true, playerPosition: [0, 0, 0] };
for (let f = 0; f < 60; f++) { pool.frame(1 / 60, world); pool.draw(); }
await new Promise((res) => setTimeout(res, 50));   // the bakes' uploads land
if (process.env.ANIM === '1') {
  const anims = pool.seaBoats.flatMap((b) => boatAnimators(b));
  for (let f = 0; f < 60; f++) for (const a of anims) a.update(1 / 60);
  const ta = performance.now();
  for (let f = 0; f < FRAMES; f++) for (const a of anims) a.update(1 / 60);
  console.log(`ships ${SHIPS} (${anims.length} animators): the animators' frame ${((performance.now() - ta) / FRAMES).toFixed(3)} ms`);
  process.exit(0);
}
const t0 = performance.now();
const BOB = process.env.BOB === '1';
const bob = (f) => { if (!BOB) return; for (const b of pool.seaBoats) if (b.MeshObject) { const a = Math.sin(f * 0.05) * 0.02, c = Math.cos(f * 0.07) * 0.03; b.MeshObject.localRotation = [Math.sin(a / 2), 0, Math.sin(c / 2), Math.cos(a / 2) * Math.cos(c / 2)]; } };
for (let f = 0; f < FRAMES; f++) { bob(f); pool.frame(1 / 60, world); pool.draw(); }
let objects = 0;
const count = (n) => { objects++; for (const c of n.children) count(c); };
for (const b of pool.seaBoats) count(b.GameObject);
console.log(`${BOB ? 'rocking ' : ''}ships ${SHIPS} (${objects} objects): the pool's frame ${((performance.now() - t0) / FRAMES).toFixed(3)} ms`);
