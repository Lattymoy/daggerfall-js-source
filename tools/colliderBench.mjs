// Standing collider/foe perf bench (the 2026-08-17 live-lag fix):
// 29 EnemyAI foes on the REAL Privateer's Hold collider - ms per
// rendered frame of ai.update at various render rates (P17's
// accumulator makes total steps/s constant, so these are
// render-rate-independent sim costs). Baselines at CELL=2 + the
// idle rest path: IDLE 60fps ~0.7ms/frame, worst-case all-29
// pursuing at 10fps ~65ms/frame (pre-fix: 66ms / 767ms).
// Run: ARENA2_PATH=... node tools/colliderBench.mjs
import { readFileSync } from 'node:fs';
import { BsaFile } from '../src/formats/bsaFile.js';
import { Arch3dFile } from '../src/formats/arch3dFile.js';
import { BlocksFile } from '../src/formats/blocksFile.js';
import { MapsFile } from '../src/formats/mapsFile.js';
import { layoutDungeon } from '../src/world/dungeonLayout.js';
import { dfMeshToModel } from '../src/world/meshReader.js';
import { Collider } from '../src/player/collider.js';
import { EnemyAI } from '../src/characters/enemyMotor.js';
import { multiply, trs } from '../src/world/mat4.js';

const A2 = process.env.ARENA2_PATH;
const bytes = (n) => new Uint8Array(readFileSync(`${A2}/${n}`));
const blocks = new BlocksFile(); blocks.load(bytes('BLOCKS.BSA'));
const arch = new Arch3dFile(); arch.load(bytes('ARCH3D.BSA'));
const maps = new MapsFile(); maps.load(bytes('MAPS.BSA'), bytes('CLIMATE.PAK'), bytes('POLITIC.PAK'));
const dfLocation = maps.getLocationByName('Daggerfall', "Privateer's Hold");
const pre = new Map();
const getModel = (id) => {
  if (!pre.has(id)) pre.set(id, dfMeshToModel(arch.getMesh(arch.getRecordIndex(id)), () => ({ width: 1, height: 1 })));
  return pre.get(id);
};
const dungeon = layoutDungeon(dfLocation, blocks, getModel);
const collider = new Collider(() => -Infinity);
for (const b of dungeon.blocks) {
  const originMatrix = trs(b.originX, 0, b.originZ, 0, 0, 0);
  for (const p of b.layout.placements) {
    const cpu = getModel(p.modelIdNum);
    collider.addMesh('dungeon', cpu.positions, cpu.indices, multiply(originMatrix, p.matrix));
  }
}
// Foes at the real monster spawn spread (from the probe): mix of
// grounded + flyers across the dungeon.
const enemies = dungeon.blocks.flatMap((b) => (b.layout.flats ?? []).map((e) => ({ x: e.x + b.originX, y: e.y, z: e.z + b.originZ })));
console.log('enemy spawns:', enemies.length);
const mkFoes = (behaviour) => enemies.slice(0, 29).map((e, i) =>
  new EnemyAI(collider, [e.x, e.y + 0.2, e.z], (i % 8) * Math.PI / 4, { liveSpeed: 50, behaviour }));

function bench(label, foes, playerFeet, renderDt, seconds) {
  const frames = Math.round(seconds / renderDt);
  const t0 = performance.now();
  for (let i = 0; i < frames; i++) for (const f of foes) f.update(renderDt, playerFeet);
  const total = performance.now() - t0;
  console.log(`${label}: ${(total / frames).toFixed(2)} ms/frame (${frames} frames, ${total.toFixed(0)}ms total)`);
}

const far = [500, 0, 500];             // undetected: idle foes
const near = [enemies[0].x, enemies[0].y, enemies[0].z + 8];   // some pursue

bench('IDLE   60fps', mkFoes('General'), far, 1 / 60, 5);
bench('IDLE   10fps', mkFoes('General'), far, 1 / 10, 5);
bench('NEAR   10fps', mkFoes('General'), near, 1 / 10, 5);
bench('FLYERS 10fps', mkFoes('Flying'), near, 1 / 10, 5);
