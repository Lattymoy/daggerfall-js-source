#!/usr/bin/env node
// THE SEABED, HELD TO THE BLOCKS IT GROWS IN (src/world/dungeon/dungeonFlora.js). Every block BLOCKS.BSA floods is laid
// out alone through the port's own builder, its collider built as the host builds it (tools/dungeonFireProbe.mjs), and
// the law's plan asked again with rays of this tool's own:
//   - each plant stands on a level floor a metre or more under the block's water, 1.5 m from every door;
//   - no wall comes inside its half width at a quarter, half and three quarters of its height, nothing overhead;
//   - no two plants nearer than 2.4 m, no block past its count, the same plan twice.
// The blocks are the stuff of every dungeon in every province, so the check reads them all, not a dungeon's.
//
//   node tools/dungeonFloraCheck.mjs <arena2>     prints the counts and each problem; exit 1 if any

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isMain } from './lib/isMain.mjs';
import { loadData } from './climbDungeonProbe.mjs';
import { hostModelReader, hostFireCollider } from './dungeonFireProbe.mjs';
import { layoutRdbBlock } from '../src/world/rdbLayout.js';
import { TextureFile, texName } from '../src/formats/textureFile.js';
import { classicBillboardSize } from '../src/world/rmbFlats.js';
import { GLOBAL_SCALE } from '../src/world/meshReader.js';
import { fireLayoutInputs } from '../src/world/dungeon/dungeonFires.js';
import { FLORA, FLORA_KINDS, FLORA_ARCHIVES, dungeonFloraPlan, colliderFloraProbe } from '../src/world/dungeon/dungeonFlora.js';

const SLACK = 0.02;
const RAYS = [[1, 0], [-1, 0], [0, 1], [0, -1], [Math.SQRT1_2, Math.SQRT1_2], [Math.SQRT1_2, -Math.SQRT1_2], [-Math.SQRT1_2, Math.SQRT1_2], [-Math.SQRT1_2, -Math.SQRT1_2]];
const KNOWN = new Set(FLORA_KINDS.flatMap((k) => k.records.map(([a, r]) => `${a}_${r}`)));

/** One flooded block's problems, `label` first in each. */
export function checkFloraBlock({ label, block, col, sizeOf, seed }) {
  const out = [];
  const blocks = [block];
  const args = { blocks, probe: colliderFloraProbe(col), sizeOf, doors: fireLayoutInputs(blocks, []).doors, seed };
  const plan = dungeonFloraPlan(args);
  if (JSON.stringify(dungeonFloraPlan(args)) !== JSON.stringify(plan)) out.push(`${label}: two plans differ`);
  if (plan.length > FLORA.perBlock) out.push(`${label}: ${plan.length} plants, past ${FLORA.perBlock}`);
  const water = -block.layout.waterLevel * GLOBAL_SCALE;
  for (const [i, f] of plan.entries()) {
    const at = `${label} ${f.archive}_${f.record} at [${f.pos.map((v) => v.toFixed(2)).join(', ')}]`;
    const size = sizeOf(f.archive, f.record);
    if (!KNOWN.has(`${f.archive}_${f.record}`) || !size) { out.push(`${at}: not one of the seabed's records`); continue; }
    if (f.pos[1] > water - FLORA.depthM + SLACK) out.push(`${at}: ${(water - f.pos[1]).toFixed(2)} m under the water`);
    const floor = col.raycastHit([f.pos[0], f.pos[1] + 0.5, f.pos[2]], [0, -1, 0], 1);
    if (!floor || !(Math.abs(floor.dist - 0.5) <= SLACK) || !(floor.normal?.[1] >= FLORA.flatNy) || floor.back) out.push(`${at}: no level floor under it`);
    const up = col.raycast([f.pos[0], f.pos[1] + 0.05, f.pos[2]], [0, 1, 0], size.h);
    if (Number.isFinite(up)) out.push(`${at}: ${up.toFixed(2)} m of room overhead`);
    for (const k of [0.25, 0.5, 0.75]) {
      const near = Math.min(...RAYS.map(([dx, dz]) => col.raycast([f.pos[0], f.pos[1] + size.h * k, f.pos[2]], [dx, 0, dz], size.w / 2)));
      if (Number.isFinite(near) && near < size.w / 2 - SLACK) { out.push(`${at}: a wall ${near.toFixed(2)} m off at ${k} of its height`); break; }
    }
    for (const d of args.doors) if (Math.hypot(d[0] - f.pos[0], d[1] - f.pos[1], d[2] - f.pos[2]) < FLORA.doorM - SLACK) out.push(`${at}: a door ${Math.hypot(d[0] - f.pos[0], d[1] - f.pos[1], d[2] - f.pos[2]).toFixed(2)} m off`);
    for (const g of plan.slice(i + 1)) if (Math.hypot(g.pos[0] - f.pos[0], g.pos[1] - f.pos[1], g.pos[2] - f.pos[2]) < FLORA.spacingM - SLACK) out.push(`${at}: another plant nearer than ${FLORA.spacingM} m`);
  }
  return { plants: plan.length, problems: out };
}

/** Every flooded block BLOCKS.BSA carries: { flooded, plants, counts (block name -> plants), problems }. */
export function checkDungeonFlora(arena2, { seed = 7 } = {}) {
  const data = loadData(arena2);
  const getModel = hostModelReader(data.arch);
  const textures = new Map();
  for (const a of FLORA_ARCHIVES) {
    const t = new TextureFile();
    textures.set(a, t.load(new Uint8Array(readFileSync(join(arena2, texName(a)))), texName(a)) ? t : null);
  }
  const sizeOf = (a, r) => { const t = textures.get(a); return t && r < t.recordCount ? classicBillboardSize(t, r) : null; };
  let flooded = 0, plants = 0;
  const problems = [], counts = {};
  const count = data.blocks.count;
  for (let i = 0; i < count; i++) {
    const dfBlock = data.blocks.readClassicBlock(i);
    if (!dfBlock?.rdbBlock) continue;
    const layout = layoutRdbBlock(dfBlock, i, true, getModel);
    if (layout.waterLevel === 10000) continue;
    flooded++;
    const block = { name: dfBlock.name, layout, originX: 0, originZ: 0 };
    const r = checkFloraBlock({ label: dfBlock.name, block, col: hostFireCollider([block], getModel), sizeOf, seed });
    plants += r.plants;
    counts[dfBlock.name] = r.plants;
    problems.push(...r.problems);
  }
  if (!flooded) problems.push('no flooded block read: BLOCKS.BSA answered none');
  return { flooded, plants, counts, problems };
}

if (isMain(import.meta.url)) {
  const arena2 = process.argv[2] ?? process.env.ARENA2_PATH;
  if (!arena2) { console.error('usage: node tools/dungeonFloraCheck.mjs <arena2>'); process.exit(2); }
  const t0 = Date.now();
  const r = checkDungeonFlora(arena2);
  for (const p of r.problems) console.log(p);
  console.log(`${r.flooded} flooded blocks, ${r.plants} plants, ${r.problems.length} problems (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  process.exit(r.problems.length ? 1 : 0);
}
