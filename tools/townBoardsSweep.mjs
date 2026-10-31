#!/usr/bin/env node
// TOWN-BOARDS (the owner's field report, 2026-10-27, item 3: "Random wooden board placement in smaller towns on the
// ground"; bible/03-World/Urban-Fabric.md section 9) - THE BOARDS SWEPT: the world's small towns on the player's own data,
// on the Bay and past it. The law test/world/urban/townboards.test.js holds on a sample of the same.
//
//   ARENA2_PATH=<the player's arena2> node tools/townBoardsSweep.mjs [--every N] [--land M] [--kinds village,town,city-state]
//
// PAST THE BAY - every Nth template of each kind (world/arenaLocations.js arenaTemplates: a village, a hamlet - Arena's
// "town" - and a city), cloned under a map id of its own and laid as its own outline of blocks (world/townOutline.js - the
// open cell's block on the door, installTownOutline, and a walled city's wall stood, world/townWalls.js standTownWall,
// as the places' host stands them),
// its fabric planned through the stand as the pixel build plans it (world/urban/townFabricStand.js townFabricFor, on the
// town's ground - its outline, world/terrain/terrainTiles.js locationShapeField; the sea's tiles are the terrain job's
// to take, LAND below):
//   PAVE - its main streets' pavements, as each style lays them: their pieces (four ways - in the planks' styles a
//     boardwalk, the only thing they lay on a main street; in the stone styles flags over the setts), those shorter than
//     FABRIC.paveLeast (6.4 m) along their longer side - a lone board, a lone flag - and those that meet another at a
//     corner alone across the town's open ground (a step); and in the stone styles the setts' islands, a piece of the
//     carriageway no walk runs down shorter than the same.
//   OFF - the fabric's pieces on a cell its town's ground does not hold: a fence's or a gate's edge, a dead end's wall, a
//     woodpile, a pavement's or a carriageway's cell.
//   LAND - every Mth of them laid on its template's own pixel (the template's Bay pixel, WOODS.WLD) as the terrain kernel
//     flattens it (world/terrain/terrainGen.js generatePixelTerrain, TS2's outline - its own townGround, the sea's tiles
//     taken) with a road every way through it (TS10's own measure, test/world/townpaths.test.js - the painter's paths the
//     job's), the fabric planned on that ground and those roads as the pixel build plans it, and each of its fence edges,
//     woodpiles and pavements read against the ground under it: BURIED where the ground stands over LAND_M above its foot
//     (a fence to its top rail - a board on the ground), HUNG where it falls more than LAND_M under it.
//   ROADS - on the same: a fence's edge, a gate's or a woodpile on a cell whose tile the terrain painted a road over (a
//     yard across the road - its fence crosses it), and the yards' cells there.
// ON THE BAY - every village and hamlet of every region, its blocks as the world-data door serves them (both town packs
// on): FABRIC, how many the fabric dresses (world/urban/townFabricStand.js fabricTown - none: the Bay's towns are
// Daggerfall's); FLAT, every placed model of their blocks that lies on the ground (under FLAT_H high, its foot within
// FLAT_FOOT of the ground, FLAT_W or more across), by model and picture - and WOOD, those of them in Daggerfall's timber
// (TEXTURE.067).
//
// Nothing of ARENA2 or the packs is written; the numbers are a measurement of the player's data.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isMain } from './lib/isMain.mjs';
import { openTownData } from './townQuestMarkers.mjs';
import { arenaTemplates } from '../src/world/arenaLocations.js';
import { outlineTownLocation, installTownOutline, townOutlineBlockJson } from '../src/world/townOutline.js';
import { standTownWall } from '../src/world/townWalls.js';
import { townFabricFor, _resetTownFabrics, fabricTown, fabricBlockOf } from '../src/world/urban/townFabricStand.js';
import { FABRIC_KIND as K, FABRIC, labelPieces, fabricGrid } from '../src/world/urban/townFabric.js';
import { onTownTile, isWallCarrier } from '../src/world/townShape.js';
import {
  locationShapeField,
  getLocationTerrainTileOrigin,
  setLocationTiles,
} from '../src/world/terrain/terrainTiles.js';
import { generatePixelTerrain } from '../src/world/terrain/terrainGen.js';
import { surfaceHeightAt } from '../src/world/terrain/terrainSurface.js';
import { MAX_TERRAIN_HEIGHT, STREAMING_TERRAIN_SCALE, TERRAIN_SIZE } from '../src/world/terrain/terrainSampler.js';
import { WoodsFile } from '../src/formats/woodsFile.js';
import { LOCATION_TYPES, longitudeLatitudeToMapPixel } from '../src/formats/mapsFile.js';
import { layoutRmbBlock } from '../src/world/rmbLayout.js';
import { NAV_CELL } from '../src/world/city/cityNavigation.js';
import { DIR } from '../src/world/road/roadNetwork.js';

/** LAND: how far the ground may stand over or fall under a piece's foot before it is buried or hung (metres) - a fence's
 *  lower rail is 0.4 m up (ARCH3D 41206), a pavement 0.13 m. */
export const LAND_M = 0.4;
/** FLAT: a placed model lying on the ground - under this high, its foot this near the ground, this wide or more (metres). */
export const FLAT_H = 0.4;
export const FLAT_FOOT = 0.6;
export const FLAT_W = 0.8;
/** Daggerfall's timber (TEXTURE.067: boards, planks, posts - its fences, benches, crates, stalls). */
export const TIMBER_ARCHIVE = 67;
/** The kinds past the Bay a sweep reads, the smaller first. */
export const SWEEP_KINDS = Object.freeze(['village', 'town', 'city-state']);
/** The map id a sweep clones a template under (the place's own is its province's slot's - any id is a town's outline). */
export const sweepMapId = (kind, j) => ((0xa7 << 20) | ((SWEEP_KINDS.indexOf(kind) + 5) * 100000 + j)) >>> 0;

/** The player's data opened for the sweep: the town data (both packs on the door), every row of MAPS.BSA, the templates. */
export async function openSweep(arena2) {
  const data = await openTownData(arena2);
  installTownOutline(); // the open cell's block (TESAOPEN) on the door: never read as another block of a like name
  data.maps.autoDiscard = false;
  const rows = [];
  for (let r = 0; r < 62; r++) {
    const reg = data.maps.getRegion(r);
    if (!reg) continue;
    for (let l = 0; l < reg.locationCount; l++) {
      const lc = data.maps.getLocation(r, l);
      if (lc) rows.push(lc);
    }
  }
  const io = {
    classicOf: (n) => data.blocks.readClassicBlock(data.blocks.getBlockIndex(data.blocks.checkName(n))),
    servedOf: (n) => data.blocks.getBlockByName(n),
  };
  let woods = null;
  const woodsOf = () => {
    if (!woods) {
      woods = new WoodsFile();
      woods.load(new Uint8Array(readFileSync(join(arena2, 'WOODS.WLD'))));
    }
    return woods;
  };
  return { ...data, rows, templates: arenaTemplates(rows), io, woodsOf };
}

/** A template past the Bay as the host stands it: cloned under its own map id, its own outline of blocks, an Arena place. */
export function sweepClone(sw, kind, j) {
  const tpl = sw.templates[kind][j];
  const loc = outlineTownLocation(
    {
      ...tpl,
      mapTableData: { ...tpl.mapTableData, mapId: sweepMapId(kind, j) },
      arena: { province: 'HighRock', kind },
    },
    sw.io,
  );
  if (loc.outline?.walled) standTownWall(loc, tpl.exterior.exteriorData.blockNames, sw.io, townOutlineBlockJson); // TS4: its wall, its carrier and its gates
  return loc;
}

/** A location's blocks as layoutLocation hands them to the stand (world/locationLayout.js: its grid's names checked and
 *  served by the door - the open cell's and a wall's carrier's the port's own). */
export function sweepBlocks(sw, loc) {
  const ed = loc.exterior.exteriorData,
    out = [];
  for (let y = 0; y < ed.height; y++)
    for (let x = 0; x < ed.width; x++) {
      const blockName = sw.blocks.checkName(ed.blockNames[y * ed.width + x]);
      const dfBlock = sw.blocks.getBlockByName(blockName);
      if (dfBlock) out.push({ x, y, blockName, dfBlock });
    }
  return out;
}

/** The outline's tiles (inland: the town's ground) as the terrain job's mask - 1 a tile of it, 128 x 128. */
export function outlineGround(sw, loc) {
  const ed = loc.exterior.exteriorData,
    at = new Map(sweepBlocks(sw, loc).map((b) => [b.y * ed.width + b.x, b]));
  const shape = locationShapeField(loc, (bx, by) => {
    const b = at.get(by * ed.width + bx);
    return !b || isWallCarrier(b.blockName) ? null : b.dfBlock.rmbBlock;
  }); // setLocationTiles' read
  return shape ? Uint8Array.from(shape, (v) => (v ? 1 : 0)) : null;
}

/** TS10's road every way (test/world/townpaths.test.js): the pixel's road byte with all eight arms - the painter's arms and
 *  its ring round the town's outline. */
export const ROADS_EVERY_WAY = DIR.N | DIR.S | DIR.E | DIR.W | DIR.NE | DIR.SW | DIR.NW | DIR.SE;

/** A clone laid on its template's own pixel as the terrain kernel flattens it, a road every way through it: its ground
 *  mask, the paths the painter wrote, and the ground's height under a point of the fabric over the fabric's own 0
 *  (scenes/pixelBuild.js locLocal: the job's level and 5 cm). */
export function sweepLand(sw, loc) {
  const p = longitudeLatitudeToMapPixel(loc.mapTableData.longitude, loc.mapTableData.latitude);
  const tilemap = new Uint8Array(128 * 128),
    rect = setLocationTiles(loc, sw.maps, sw.blocks, tilemap);
  const roads = new Uint8Array(1000 * 500);
  if (p.x >= 0 && p.x < 1000 && p.y >= 0 && p.y < 500) roads[p.y * 1000 + p.x] = ROADS_EVERY_WAY;
  const t = generatePixelTerrain({
    woods: sw.woodsOf(),
    px: p.x,
    py: p.y,
    tilemap,
    locationRect: rect,
    hasLocation: true,
    climateType: 0,
    roads: { roads, tracks: new Uint8Array(1000 * 500), smooth: true },
  });
  const tile = TERRAIN_SIZE / 128,
    wh = MAX_TERRAIN_HEIGHT * STREAMING_TERRAIN_SCALE,
    o = getLocationTerrainTileOrigin(loc);
  const base = t.avg * wh + 2.0 * 0.025;
  return {
    px: p.x,
    py: p.y,
    ground: t.townGround,
    paths: t.paths,
    groundAt: (x, z) => surfaceHeightAt(t.samples, o.x * tile + x, o.y * tile + z) - base,
  };
}

/** The clone's fabric's plan, planned through the stand on `ground` and `paths` (null: its whole grid, and no roads but its
 *  blocks' - the fabric before TOWN-BOARDS), and its blocks' cells as the plan reads them (`g`: built, house). */
export async function sweepPlan(sw, loc, ground, paths = null) {
  _resetTownFabrics();
  const blocks = sweepBlocks(sw, loc),
    f = await townFabricFor(loc, blocks, { px: 0, py: 0, ground, paths });
  _resetTownFabrics();
  if (!f) return null;
  const ed = loc.exterior.exteriorData,
    at = new Map(blocks.map((b) => [b.y * ed.width + b.x, b]));
  return { plan: f.plan, g: fabricGrid(ed.width, ed.height, (bx, by) => fabricBlockOf(at.get(by * ed.width + bx))) };
}

/** PAVE's threshold, in cells: FABRIC.paveLeast (6.4 m - one of Daggerfall's ground tiles), the same for a fabric before it
 *  had one, so a sweep of either reads the same pieces as short. */
const LEAST = FABRIC.paveLeast ?? 4;
/** A piece's extent along its longer side, in cells (its box's). */
const extentOf = (cells, W) => {
  let x0 = Infinity,
    x1 = -Infinity,
    z0 = Infinity,
    z1 = -Infinity;
  for (const i of cells) {
    const x = i % W,
      z = (i - x) / W;
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
    z0 = Math.min(z0, z);
    z1 = Math.max(z1, z);
  }
  return Math.max(x1 - x0, z1 - z0) + 1;
};
/** The cells of each piece (four ways) of a mask. */
const piecesOf = (W, H, mask) => {
  const { id, sizes } = labelPieces(W, H, mask),
    list = sizes.map(() => []);
  for (let i = 0; i < id.length; i++) if (id[i] >= 0) list[id[i]].push(i);
  return { id, list };
};
/** PAVE: the pavements' pieces (four ways - the planks' boardwalks, the stone styles' flags), their cells, those shorter
 *  than FABRIC.paveLeast along their longer side (`short` - a lone board, a lone flag: each `house` where a cell of it is
 *  beside a house's, `props` beside one of the block's misc models' or flats' cells, else `alone`), the steps (two pieces
 *  meeting at a corner alone across the town's open ground), and the stone styles' setts islands (`islands`: a piece of the
 *  carriageway no walk runs down, shorter than the same). @param {any} plan @param {{ built: Uint8Array, house: Uint8Array }} g */
export function paveReads(plan, g) {
  const { W, H } = plan,
    n = W * H;
  const pave = piecesOf(
    W,
    H,
    Uint8Array.from(plan.kind, (k) => (k === K.pave ? 1 : 0)),
  );
  const ground = (c) => plan.kind[c] !== K.off && plan.kind[c] !== K.built; // the town's open ground
  const out = { pieces: pave.list.length, cells: 0, short: 0, house: 0, props: 0, alone: 0, steps: 0, islands: 0 };
  for (let i = 0; i < n; i++) {
    if (pave.id[i] < 0) continue;
    out.cells++;
    const x = i % W;
    for (const [dx, dz] of [
      [1, 1],
      [-1, 1],
    ]) {
      const j = i + dz * W + dx;
      if (
        x + dx >= 0 &&
        x + dx < W &&
        j < n &&
        pave.id[j] >= 0 &&
        pave.id[j] !== pave.id[i] &&
        ground(i + dx) &&
        ground(i + dz * W)
      )
        out.steps++;
    }
  }
  for (const cells of pave.list) {
    if (extentOf(cells, W) >= LEAST) continue;
    out.short++;
    let house = false,
      prop = false;
    for (const i of cells) {
      const x = i % W;
      for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W]) {
        if (j < 0 || j >= n) continue;
        if (g.house[j]) house = true;
        else if (g.built[j]) prop = true;
      }
    }
    if (house) out.house++;
    else if (prop) out.props++;
    else out.alone++;
  }
  const walk = new Uint8Array(n);
  for (const p of plan.paths) for (const c of p) walk[c] = 1;
  for (const cells of piecesOf(
    W,
    H,
    Uint8Array.from(plan.kind, (k) => (k === K.main ? 1 : 0)),
  ).list) {
    if (!cells.some((i) => walk[i]) && extentOf(cells, W) < LEAST) out.islands++;
  }
  return out;
}

/** OFF: the fabric's pieces whose cell the town's ground (`ground`, 128 x 128 tiles) does not hold. */
export function offGround(plan, loc, ground) {
  const o = getLocationTerrainTileOrigin(loc),
    W = plan.W,
    on = (i) => onTownTile(ground, o, i % W, (i - (i % W)) / W);
  const out = { fences: 0, gates: 0, walls: 0, piles: 0, pave: 0, main: 0 };
  for (const e of plan.fences) if (!on(e.inner)) out.fences++;
  for (const e of plan.gates) if (!on(e.inner)) out.gates++;
  for (const e of plan.walls) if (!on(e.inner)) out.walls++;
  for (const p of plan.props) if (!on(p.cell)) out.piles++;
  for (let i = 0; i < plan.kind.length; i++) {
    if (plan.kind[i] === K.pave && !on(i)) out.pave++;
    if (plan.kind[i] === K.main && !on(i)) out.main++;
  }
  return out;
}

/** LAND: each fence edge (its middle), woodpile and pavement cell read against the ground under it - buried or hung. */
export function onLand(plan, groundAt) {
  const W = plan.W,
    C = NAV_CELL,
    out = { fenceBuried: 0, fenceHung: 0, pileBuried: 0, pileHung: 0, paveBuried: 0, worst: 0 };
  const steps = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  for (const e of plan.fences) {
    const x = e.inner % W,
      z = (e.inner - x) / W,
      [dx, dz] = steps[e.dir],
      h = groundAt((x + 0.5 + dx / 2) * C, (z + 0.5 + dz / 2) * C);
    if (h > LAND_M) out.fenceBuried++;
    else if (h < -LAND_M) out.fenceHung++;
    out.worst = Math.max(out.worst, Math.abs(h));
  }
  for (const p of plan.props) {
    const x = p.cell % W,
      z = (p.cell - x) / W,
      h = groundAt((x + 0.5) * C, (z + 0.5) * C);
    if (h > LAND_M) out.pileBuried++;
    else if (h < -LAND_M) out.pileHung++;
  }
  for (let i = 0; i < plan.kind.length; i++) {
    if (plan.kind[i] !== K.pave) continue;
    const x = i % W,
      z = (i - x) / W;
    if (groundAt((x + 0.5) * C, (z + 0.5) * C) > 0.13) out.paveBuried++; // FABRIC_PAVE_Y over the fabric's 0
  }
  return out;
}

/** ROADS: the fabric's pieces on a cell whose tile the terrain painted a road over (`paths`, 128 x 128): a fence's edge, a
 *  gate's, a woodpile, a yard's cell - each a yard across the road. */
export function onRoads(plan, loc, paths) {
  const o = getLocationTerrainTileOrigin(loc),
    W = plan.W,
    on = (i) => !!paths && onTownTile(paths, o, i % W, (i - (i % W)) / W);
  const out = { fences: 0, gates: 0, piles: 0, yard: 0 };
  for (const e of plan.fences) if (on(e.inner)) out.fences++;
  for (const e of plan.gates) if (on(e.inner)) out.gates++;
  for (const p of plan.props) if (on(p.cell)) out.piles++;
  for (let i = 0; i < plan.kind.length; i++) if (plan.kind[i] === K.yard && on(i)) out.yard++;
  return out;
}

/** ON THE BAY: every village and hamlet - how many the fabric dresses, and every flat-lying model of their blocks. */
export function bayBoards(sw) {
  const types = new Set([LOCATION_TYPES.TownVillage, LOCATION_TYPES.TownHamlet]);
  const out = { towns: 0, fabric: 0, blocks: 0, flat: new Map(), wood: 0 };
  const names = new Set();
  for (const loc of sw.rows) {
    if (!types.has(loc.mapTableData?.locationType) || !loc.exterior?.exteriorData?.blockNames) continue;
    out.towns++;
    if (fabricTown(loc)) out.fabric++;
    for (const n of loc.exterior.exteriorData.blockNames) names.add(sw.blocks.checkName(n));
  }
  const at = (M, x, y, z) => [
    M[0] * x + M[4] * y + M[8] * z + M[12],
    M[1] * x + M[5] * y + M[9] * z + M[13],
    M[2] * x + M[6] * y + M[10] * z + M[14],
  ];
  for (const name of [...names].sort()) {
    const dfBlock = sw.blocks.getBlockByName(name);
    if (!dfBlock?.rmbBlock) continue;
    out.blocks++;
    for (const m of layoutRmbBlock(dfBlock, { enhanced: true }).models) {
      const mesh = sw.getModel(m.modelIdNum);
      if (!mesh?.positions?.length) continue;
      const lo = [Infinity, Infinity, Infinity],
        hi = [-Infinity, -Infinity, -Infinity],
        p = mesh.positions;
      for (let i = 0; i < p.length; i += 3) {
        const w = at(m.matrix, p[i], p[i + 1], p[i + 2]);
        for (let k = 0; k < 3; k++) {
          lo[k] = Math.min(lo[k], w[k]);
          hi[k] = Math.max(hi[k], w[k]);
        }
      }
      if (hi[1] - lo[1] >= FLAT_H || lo[1] > FLAT_FOOT || Math.max(hi[0] - lo[0], hi[2] - lo[2]) < FLAT_W) continue;
      const pictures = [...new Set(mesh.subMeshes.map((s) => s.textureArchive))].sort((a, b) => a - b);
      const key = `${m.modelIdNum} (TEXTURE ${pictures.join(', ')})`;
      out.flat.set(key, (out.flat.get(key) ?? 0) + 1);
      if (pictures.includes(TIMBER_ARCHIVE)) out.wood++;
    }
  }
  return out;
}

if (isMain(import.meta.url)) {
  const arg = (k, d) => {
    const i = process.argv.indexOf(`--${k}`);
    return i > 0 ? process.argv[i + 1] : d;
  };
  const every = Number(arg('every', 1)),
    land = Number(arg('land', 0)),
    kinds = arg('kinds', SWEEP_KINDS.join(',')).split(',');
  const quiet = console.log;
  console.log = (...a) => {
    if (!/^\[worlddata\]/.test(String(a[0]))) quiet(...a);
  };
  const sw = await openSweep(process.env.ARENA2_PATH);
  for (const kind of kinds) {
    const sum = {
      towns: 0,
      pave: { pieces: 0, cells: 0, short: 0, house: 0, props: 0, alone: 0, steps: 0, islands: 0 },
      roads: { fences: 0, gates: 0, piles: 0, yard: 0 },
      roadTowns: 0,
      off: { fences: 0, gates: 0, walls: 0, piles: 0, pave: 0, main: 0 },
      offTowns: 0,
      landTowns: 0,
      land: { fenceBuried: 0, fenceHung: 0, pileBuried: 0, pileHung: 0, paveBuried: 0 },
      landHit: [],
    };
    for (let j = 0; j < sw.templates[kind].length; j += every) {
      const loc = sweepClone(sw, kind, j),
        outline = outlineGround(sw, loc),
        planned = await sweepPlan(sw, loc, outline);
      if (!planned) continue;
      const { plan } = planned;
      sum.towns++;
      const pc = paveReads(plan, planned.g);
      for (const k of Object.keys(sum.pave)) sum.pave[k] += pc[k];
      if (outline) {
        const o = offGround(plan, loc, outline);
        let any = 0;
        for (const k of Object.keys(o)) {
          sum.off[k] += o[k];
          any += o[k];
        }
        if (any) sum.offTowns++;
      }
      if (land && (sum.towns - 1) % land === 0) {
        const L = sweepLand(sw, loc),
          lp = await sweepPlan(sw, loc, L.ground, L.paths),
          r = onLand(lp.plan, L.groundAt),
          rd = onRoads(lp.plan, loc, L.paths);
        sum.landTowns++;
        let hit = 0,
          crossed = 0;
        for (const k of Object.keys(sum.land)) {
          sum.land[k] += r[k];
          hit += r[k];
        }
        for (const k of Object.keys(sum.roads)) {
          sum.roads[k] += rd[k];
          crossed += rd[k];
        }
        if (crossed) sum.roadTowns++;
        if (hit || crossed)
          sum.landHit.push(`${loc.name} #${j} (${L.px},${L.py}) ${JSON.stringify(r)} roads ${JSON.stringify(rd)}`);
      }
    }
    quiet(`PAST THE BAY ${kind}: ${JSON.stringify({ ...sum, landHit: sum.landHit.length })}`);
    for (const l of sum.landHit) quiet(`  LAND ${l}`);
  }
  const bay = bayBoards(sw);
  quiet(
    `ON THE BAY villages and hamlets: ${bay.towns} towns, ${bay.fabric} dressed by the fabric; ${bay.blocks} blocks; ${bay.wood} timber pieces lying flat`,
  );
  for (const [k, v] of [...bay.flat].sort((a, b) => b[1] - a[1])) quiet(`  FLAT ${k}: ${v}`);
}
