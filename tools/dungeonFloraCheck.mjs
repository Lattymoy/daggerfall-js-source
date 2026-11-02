#!/usr/bin/env node
// THE SEABED, HELD TO THE DUNGEONS IT GROWS IN (src/world/dungeon/dungeonFlora.js; AUDIT SHIP-REFIT). Whole dungeons are
// laid out through the port's own builder at their own seeds, their colliders built as the host builds them
// (tools/dungeonFireProbe.mjs), and every plant asked again with rays of this tool's own - denser than the law's, at
// bearings and heights it never casts: in its own block's water a metre down; on a floor level under its footprint and
// on no island (a table, a plinth); no wall inside its half width and nothing over it; inside no solid; clear of doors (each one's own middle), markers and
// the layout's flats; 2.4 m from every other plant of the dungeon; the same plan twice. Read: every flooded block alone at
// twenty seeds, the dungeons the audit named, and lairs past the Bay; `--all` every dungeon MAPS.BSA floods.
//
//   node tools/dungeonFloraCheck.mjs <arena2> [--all]     prints the counts and each problem; exit 1 if any

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isMain } from './lib/isMain.mjs';
import { loadData } from './climbDungeonProbe.mjs';
import { hostModelReader, hostFireCollider } from './dungeonFireProbe.mjs';
import { layoutRdbBlock, RDB_SIDE } from '../src/world/rdbLayout.js';
import { layoutDungeon, isDungeonExitDoor } from '../src/world/dungeon/dungeonLayout.js';
import { TextureFile, texName } from '../src/formats/textureFile.js';
import { classicBillboardSize } from '../src/world/rmbFlats.js';
import { GLOBAL_SCALE } from '../src/world/meshReader.js';
import { transformPoint, multiply, trs } from '../src/world/mat4.js';
import { itemMarks, enemyMarks } from '../src/world/dungeon/dungeonFires.js';
import {
  lairTemplates,
  lairPools,
  lairLayout,
  lairBlockCount,
  lairPlaceId,
  synthesizeLairLocation,
  LAIR_TYPES,
} from '../src/world/tamrielDungeons.js';
import { hash32 } from '../src/world/blockHash.js';
import {
  SEABED,
  FLORA_KINDS,
  FLORA_ARCHIVES,
  dungeonFloraPlan,
  colliderFloraProbe,
  floraDoors,
} from '../src/world/dungeon/dungeonFlora.js';

const SLACK = 0.02;
/** How far a wall may come inside a plant's half width before it is a problem: the law's eight bearings read a flat
 *  wall up to 8% far (cos 22.5 degrees), which its 0.1 m clearance covers for a plant up to 2.5 m across. */
const WALL_TOL = 0.05;
const RAY16 = Array.from({ length: 16 }, (_, k) => [Math.sin((k * Math.PI) / 8), Math.cos((k * Math.PI) / 8)]);
const RAY64 = Array.from({ length: 64 }, (_, k) => [Math.sin((k * Math.PI) / 32), Math.cos((k * Math.PI) / 32)]);
/** The clearance read up a plant every 5 cm - a third of the law's own gap (SEABED.gapM) - from over the level rule's
 *  5 cm to a centimetre under its top. */
const heightsOf = (h) => {
  const ys = [];
  for (let y = SEABED.levelM + SLACK; y < h; y += 0.05) ys.push(y);
  ys.push(h - 0.01);
  return ys;
};
const KNOWN = new Set(FLORA_KINDS.flatMap((k) => k.records.map(([a, r]) => `${a}_${r}`)));
/** The dungeons the audit named (spills past a block, a plant on a pile or a table), and a few more of the Bay's. */
export const NAMED_DUNGEONS = Object.freeze([
  ['Daggerfall', 'The Penitentiary of Rodoryan'],
  ['Wrothgarian Mountains', 'Ruins of The Ashfield Cabin'],
  ['Daggerfall', 'The Barrow of Verenus'],
  ['Tigonus', 'The Norgoth Nest'],
  ['Alcaire', 'Ruins of Moorcroft Manor'],
  ["Alik'r Desert", "Maorn's Guard"],
]);

/** Each action door's middle (its model's box) and each exit door's face, read here, not through the law's floraDoors. */
function doorsOf(blocks, getModel) {
  const out = [];
  for (const b of blocks) {
    for (const d of b.layout.actionDoors ?? []) {
      const m = multiply(trs(b.originX, 0, b.originZ, 0, 0, 0), d.matrix),
        md = getModel(d.modelIdNum);
      let c = [0, 0, 0];
      if (md) {
        let lx = Infinity,
          ly = Infinity,
          lz = Infinity,
          hx = -Infinity,
          hy = -Infinity,
          hz = -Infinity;
        for (let i = 0; i < md.positions.length; i += 3) {
          lx = Math.min(lx, md.positions[i]);
          hx = Math.max(hx, md.positions[i]);
          ly = Math.min(ly, md.positions[i + 1]);
          hy = Math.max(hy, md.positions[i + 1]);
          lz = Math.min(lz, md.positions[i + 2]);
          hz = Math.max(hz, md.positions[i + 2]);
        }
        c = [(lx + hx) / 2, (ly + hy) / 2, (lz + hz) / 2];
      }
      out.push(transformPoint(m, c[0], c[1], c[2]));
    }
    for (const d of (b.layout.exitDoors ?? []).filter(isDungeonExitDoor)) {
      const c = d.centre
        ? transformPoint(d.matrix, d.centre.x, d.centre.y, d.centre.z)
        : [d.matrix[12], d.matrix[13], d.matrix[14]];
      out.push([c[0] + b.originX, c[1], c[2] + b.originZ]);
    }
  }
  return out;
}

/** One dungeon's problems, `label` first in each: { plants, problems, ms }. */
export function checkFloraDungeon({ label, blocks, getModel, sizeOf, seed }) {
  const out = [];
  const col = hostFireCollider(blocks, getModel);
  const positionsOf = (id) => getModel(id)?.positions ?? null;
  const args = { blocks, probe: colliderFloraProbe(col), sizeOf, doors: floraDoors(blocks, positionsOf), seed };
  const t0 = performance.now();
  const plan = dungeonFloraPlan(args);
  const ms = performance.now() - t0;
  if (
    JSON.stringify(dungeonFloraPlan({ ...args, probe: colliderFloraProbe(hostFireCollider(blocks, getModel)) })) !==
    JSON.stringify(plan)
  )
    out.push(`${label}: two plans differ`);
  const doors = doorsOf(blocks, getModel);
  const marks = [...itemMarks(blocks), ...enemyMarks(blocks)];
  const flats = blocks.flatMap((b) => (b.layout.flats ?? []).map((f) => [f.x + b.originX, f.y, f.z + b.originZ]));
  const perBlock = new Map();
  for (const [i, f] of plan.entries()) {
    const at = `${label} ${f.archive}_${f.record} at [${f.pos.map((v) => v.toFixed(2)).join(', ')}]`;
    const size = sizeOf(f.archive, f.record);
    if (!KNOWN.has(`${f.archive}_${f.record}`) || !size) {
      out.push(`${at}: not one of the seabed's records`);
      continue;
    }
    const half = size.w / 2,
      p = f.pos;
    // its own block's water: the host's rectangle (dungeonContext waterSurfaceYAt)
    const b = blocks.find(
      (q) => p[0] >= q.originX && p[0] < q.originX + RDB_SIDE && p[2] >= q.originZ && p[2] < q.originZ + RDB_SIDE,
    );
    if (!b || b.layout.waterLevel === 10000) out.push(`${at}: in a dry block (${b?.name ?? 'none'})`);
    else if (p[1] > -b.layout.waterLevel * GLOBAL_SCALE - SEABED.depthM + SLACK)
      out.push(`${at}: ${(-b.layout.waterLevel * GLOBAL_SCALE - p[1]).toFixed(2)} m under ${b.name}'s water`);
    if (b) perBlock.set(b, (perBlock.get(b) ?? 0) + 1);
    // the floor under it: level across its footprint (no step, ramp or edge under the plant), and no island - a table or a
    // plinth - with the room's floor below it all round
    const floorAt = (x, z) => {
      const h = col.raycastHit([x, p[1] + 0.8, z], [0, -1, 0], 3);
      return Number.isFinite(h?.dist) && !h.back ? { y: p[1] + 0.8 - h.dist, ny: h.normal?.[1] ?? 0 } : null;
    };
    const foot = Math.max(0.3, half);
    let level = true;
    for (const r of [0, foot / 2, foot]) {
      for (const [sx, sz] of r === 0 ? [[0, 0]] : RAY16) {
        const g = floorAt(p[0] + sx * r, p[2] + sz * r);
        if (!g || g.ny < 0.98 || Math.abs(g.y - p[1]) > SEABED.levelM + SLACK) {
          level = false;
          break;
        }
      }
      if (!level) break;
    }
    if (!level) out.push(`${at}: no level floor under its footprint`);
    const out15 = Math.max(1.5, foot + 0.3); // past a table's or a plinth's edge; a plateau under the water is a floor
    const below = RAY16.filter(([sx, sz]) => {
      const g = floorAt(p[0] + sx * out15, p[2] + sz * out15);
      return !g || g.y < p[1] - 0.25;
    }).length;
    if (below >= 12) out.push(`${at}: on an island - the floor ${below} of 16 ways round it lower (a table, a plinth)`);
    // inside no solid, nothing over it, no wall inside its half width
    const up = col.raycastHit([p[0], p[1] + 0.02, p[2]], [0, 1, 0], size.h);
    if (Number.isFinite(up?.dist)) out.push(`${at}: ${up.dist.toFixed(2)} m of room over it`);
    const behind = RAY16.filter(
      ([sx, sz]) => col.raycastHit([p[0], p[1] + size.h / 2, p[2]], [sx, 0, sz], 3)?.back === true,
    ).length;
    if (up?.back || behind >= 12) out.push(`${at}: inside a solid (${behind} of 16 rays meet a face from behind)`);
    let near = Infinity;
    for (const y of heightsOf(size.h))
      for (const [sx, sz] of RAY64) near = Math.min(near, col.raycast([p[0], p[1] + y, p[2]], [sx, 0, sz], half));
    if (near < half - WALL_TOL) out.push(`${at}: a wall ${near.toFixed(2)} m off, inside its ${half.toFixed(2)}`);
    for (const d of doors) {
      const dd = Math.hypot(d[0] - p[0], d[1] - p[1], d[2] - p[2]);
      if (dd < SEABED.doorM - SLACK) out.push(`${at}: a door's middle ${dd.toFixed(2)} m off`);
    }
    for (const m of marks)
      if (Math.abs(m[1] - p[1]) < SEABED.storeyM && Math.hypot(m[0] - p[0], m[2] - p[2]) < SEABED.markerM - SLACK)
        out.push(`${at}: a marker ${Math.hypot(m[0] - p[0], m[2] - p[2]).toFixed(2)} m off`);
    for (const fl of flats)
      if (Math.abs(fl[1] - p[1]) < SEABED.storeyM && Math.hypot(fl[0] - p[0], fl[2] - p[2]) < SEABED.flatM - SLACK)
        out.push(`${at}: the layout's flat ${Math.hypot(fl[0] - p[0], fl[2] - p[2]).toFixed(2)} m off`);
    for (const g of plan.slice(i + 1))
      if (Math.hypot(g.pos[0] - p[0], g.pos[1] - p[1], g.pos[2] - p[2]) < SEABED.spacingM - SLACK)
        out.push(`${at}: another plant nearer than ${SEABED.spacingM} m`);
  }
  for (const [b, n] of perBlock)
    if (n > SEABED.perBlock) out.push(`${label} ${b.name}: ${n} plants, past ${SEABED.perBlock}`);
  return { plants: plan.length, problems: out, ms };
}

function setUp(arena2) {
  const data = loadData(arena2);
  const getModel = hostModelReader(data.arch);
  const textures = new Map();
  for (const a of FLORA_ARCHIVES) {
    const t = new TextureFile();
    textures.set(a, t.load(new Uint8Array(readFileSync(join(arena2, texName(a)))), texName(a)) ? t : null);
  }
  const sizeOf = (a, r) => {
    const t = textures.get(a);
    return t && r < t.recordCount ? classicBillboardSize(t, r) : null;
  };
  return { data, getModel, sizeOf };
}

/** { blocks (flooded blocks read), dungeons, plants, bare (flooded blocks no seed grew a plant in), problems, slowestMs }. */
export function checkDungeonFlora(arena2, { all = false, lairs = 60, seeds = 20 } = {}) {
  const { data, getModel, sizeOf } = setUp(arena2);
  const problems = [];
  let plants = 0,
    flooded = 0,
    dungeons = 0,
    slowestMs = 0;
  const bare = [];
  const run = (label, blocks, seed) => {
    const r = checkFloraDungeon({ label, blocks, getModel, sizeOf, seed });
    plants += r.plants;
    problems.push(...r.problems);
    slowestMs = Math.max(slowestMs, r.ms);
    return r.plants;
  };
  // every flooded block alone, at `seeds` seeds - the stuff of every province's dungeons
  for (let i = 0; i < data.blocks.count; i++) {
    const dfBlock = data.blocks.readClassicBlock(i);
    if (!dfBlock?.rdbBlock) continue;
    const layout = layoutRdbBlock(dfBlock, i, true, getModel);
    if (layout.waterLevel === 10000) continue;
    flooded++;
    let grew = 0;
    for (let s = 0; s < seeds; s++)
      grew += run(`${dfBlock.name} (seed ${s})`, [{ name: dfBlock.name, layout, originX: 0, originZ: 0 }], s);
    if (!grew) bare.push(dfBlock.name);
  }
  // whole dungeons: the named ones, or every one MAPS.BSA floods
  const locations = [];
  if (all) {
    for (let region = 0; region < 62; region++) {
      // BAY-OWN: MAPS.BSA's own regions - the Bay's dungeons, read whole
      const reg = data.maps.getRegion(region);
      for (let li = 0; li < (reg?.locationCount ?? 0); li++) {
        try {
          const l = data.maps.getLocation(region, li);
          if (l?.hasDungeon) locations.push(l);
        } catch {
          /* an unread record: none */
        }
      }
    }
  } else {
    for (const [region, name] of NAMED_DUNGEONS) {
      const l = data.maps.getLocationByName(region, name);
      if (l) locations.push(l);
      else problems.push(`${region} / ${name}: not in this MAPS.BSA`);
    }
  }
  for (const loc of locations) {
    const { blocks } = layoutDungeon(loc, data.blocks, getModel);
    if (!blocks.some((b) => b.layout.waterLevel !== 10000)) continue;
    dungeons++;
    run(loc.name, blocks, loc.dungeon?.recordElement?.header?.locationId ?? 0);
  }
  // lairs past the Bay (world/tamrielDungeons.js): the Bay's dungeons as templates, laid out at their own cells
  const rows = [];
  for (let region = 0; region < 62; region++) {
    // BAY-OWN: the lairs' templates are MAPS.BSA's own dungeons
    const reg = data.maps.getRegion(region);
    for (let li = 0; li < (reg?.locationCount ?? 0); li++) {
      try {
        const l = data.maps.getLocation(region, li);
        if (l) rows.push(l);
      } catch {
        /* an unread record: none */
      }
    }
  }
  const templates = lairTemplates(rows),
    pools = lairPools(templates);
  let laid = 0;
  for (let c = 0; laid < (all ? 600 : lairs) && c < 20000; c++) {
    const type = LAIR_TYPES[hash32(1, c) % LAIR_TYPES.length];
    const list = templates.get(type);
    if (!list?.length) continue;
    const template = list[hash32(2, c) % list.length];
    const plan = lairLayout(pools.get(template.mapTableData.dungeonType), lairBlockCount(template), lairPlaceId(c));
    if (!plan) continue;
    const { blocks } = layoutDungeon(
      synthesizeLairLocation(template, { c, px: 0, py: 0, name: `lair ${c}`, type, blocks: plan }),
      data.blocks,
      getModel,
    );
    if (!blocks.some((b) => b.layout.waterLevel !== 10000)) continue;
    laid++;
    dungeons++;
    run(`lair ${c} (${template.name})`, blocks, lairPlaceId(c));
  }
  if (!flooded) problems.push('no flooded block read: BLOCKS.BSA answered none');
  return { blocks: flooded, dungeons, plants, bare, problems, slowestMs };
}

if (isMain(import.meta.url)) {
  const arena2 = process.argv[2] ?? process.env.ARENA2_PATH;
  if (!arena2) {
    console.error('usage: node tools/dungeonFloraCheck.mjs <arena2> [--all]');
    process.exit(2);
  }
  const t0 = Date.now();
  const r = checkDungeonFlora(arena2, { all: process.argv.includes('--all') });
  for (const p of r.problems) console.log(p);
  if (r.bare.length) console.log(`no plant in ${r.bare.join(', ')} at any seed`);
  console.log(
    `${r.blocks} flooded blocks, ${r.dungeons} whole dungeons, ${r.plants} plants, ${r.problems.length} problems; the slowest plan ${r.slowestMs.toFixed(0)} ms (${((Date.now() - t0) / 1000).toFixed(1)} s)`,
  );
  process.exit(r.problems.length || r.bare.length ? 1 : 0);
}
