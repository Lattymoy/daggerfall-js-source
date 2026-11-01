// @ts-check
// GATE-ROADS (bible/03-World/Town-Shapes.md GATE-ROADS): A WALLED TOWN'S GATES FOR THEIR ROADS - each gate in its pixel's
// tiles and what stands in its road's way, for the terrain kernel to lay (world/road/gateRoads.js layGateRoads). The main
// thread's: a wall on its outline is made here (world/townWalls.js, its gates on its roads and its streets); a ring a town
// keeps - Daggerfall's own (the town packs that rebuilt the Bay's retired in OWN-WORK3) - stands its gates in its blocks.
import {
  townWallOf,
  townWallCells,
  townHouses,
  gateOpening,
  WALL_MODELS,
  GATE_OPENING,
  GATE_CLEAR,
  TOWN_WALL_MODEL_BASE,
} from './townWalls.js';
import { getLocationTerrainTileOrigin } from './terrain/terrainTiles.js';
import { isWallCarrier, SHAPE_AUTOMAP_SIDE } from './townShape.js';
import { GATE_BLOCK } from './road/gateRoads.js';

const TILE_M = 6.4,
  BLOCK_M = 102.4,
  D = 128;

/** A kept ring's gates: each gate model (WALL_MODELS.gate) its blocks stand, its opening's middle (gateOpening) facing out
 *  (RMBLayout: a subrecord at (x, 4096 - z) turned by its yRotation, its model's offset turned with it, the model turned by
 *  its own on that) - in the town's metres.
 *  @param {number} w @param {number} h @param {(bx: number, by: number) => any} rmbAt */
export function blockGates(w, h, rmbAt) {
  const out = [];
  for (let by = 0; by < h; by++)
    for (let bx = 0; bx < w; bx++) {
      for (const s of rmbAt(bx, by)?.subRecords ?? []) {
        for (const o of s.exterior?.block3dObjectRecords ?? []) {
          if (o.modelIdNum !== WALL_MODELS.gate) continue;
          const f = ((s.yRotation ?? 0) * Math.PI) / 1024,
            cos = Math.cos(f),
            sin = Math.sin(f),
            lx = o.xPos * 0.025,
            lz = o.zPos * 0.025;
          const sx = bx * BLOCK_M + s.xPos * 0.025,
            sz = by * BLOCK_M + (4096 - s.zPos) * 0.025,
            F = f + ((o.yRotation ?? 0) * Math.PI) / 1024;
          out.push(
            gateOpening({ at: [sx + lx * cos - lz * sin, sz + lx * sin + lz * cos], out: [-Math.sin(F), Math.cos(F)] }),
          );
        }
      }
    }
  return out;
}

/**
 * GATE-ROADS: A TOWN'S GATES AND THEIR BLOCKS for the terrain kernel - `{ gates, blocked }`: each gate `{ x, y, ox, oy,
 * half }` (its opening's middle in its pixel's tiles, x east and y north, its outward normal, the opening's half width in
 * tiles - GATE_OPENING), and per tile (x + y * 128) GATE_BLOCK's hard for a house or the wall and soft for a block's model
 * or flat. Null for a town with no gate, a capital (its own approaches, world/capitalApproaches.js), and a wall still
 * waiting for its roads (its pixel is built again when they land). `mapsFile` and `blocksFile` read its blocks as
 * setLocationTiles does.
 * @param {any} dfLocation @param {any} mapsFile @param {any} blocksFile */
export function townGateRoads(dfLocation, mapsFile, blocksFile) {
  const ed = dfLocation?.exterior?.exteriorData;
  if (!ed || dfLocation.capital) return null;
  const { width: w, height: h } = ed,
    o = getLocationTerrainTileOrigin(dfLocation);
  const blocks = [];
  let carrier = null;
  for (let by = 0; by < h; by++)
    for (let bx = 0; bx < w; bx++) {
      const name = blocksFile.checkName(mapsFile.getRmbBlockName(dfLocation, bx, by)),
        i = isWallCarrier(name) ? -1 : blocksFile.getBlockIndex(name);
      if (isWallCarrier(name) && bx === 0 && by === 0) carrier = name;
      blocks.push(i < 0 ? null : (blocksFile.getBlock(i)?.rmbBlock ?? null));
    }
  const rmbAt = (bx, by) => blocks[by * w + bx];
  const wall = dfLocation.outline?.walled ? townWallOf(dfLocation) : null;
  if (dfLocation.outline?.walled && !wall) return null;
  const at = wall ? wall.pieces.filter((p) => p.model === WALL_MODELS.gate).map(gateOpening) : blockGates(w, h, rmbAt);
  if (!at.length) return null;
  const houses = townHouses(w, h, rmbAt),
    records = rmbAtRecords(w, h, rmbAt),
    walls = wall ? townWallCells(wall, w, h) : null;
  const ci = wall && carrier ? blocksFile.getBlockIndex(carrier) : -1,
    things = ci >= 0 ? gateThingsOutside(blocksFile.getBlock(ci)?.rmbBlock, wall) : [];
  const town = gatesAndBlocks(at, o, w, h, houses, records, walls, things);
  if (!wall) return town;
  // FB1028 YARDS: and the gates' roads as #1184 laid them, for its yards alone (gateRoads.js yardRoads)
  const was = wall.yardPieces ?? wall.pieces,
    yard = gatesAndBlocks(
      was.filter((p) => p.model === WALL_MODELS.gate).map(gateOpening),
      o,
      w,
      h,
      houses,
      records,
      townWallCells({ pieces: was }, w, h),
    );
  // FB1028 ROADS: a Bay wall on its outline hands the tiles inside its inner face - the painter's arms past them taken up
  return dfLocation.outline?.bay
    ? { ...town, yard, inside: insideWall(wall, walls, w * S_SIDE, o) }
    : { ...town, yard };
}

const S_SIDE = SHAPE_AUTOMAP_SIDE;
/** GATE-ROADS: the gates in the pixel's tiles and the tiles their roads may not cross (townGateRoads'), off openings `at`.
 *  AUDIT CAPITAL-CARRIAGES L2: `things` the gate things outside the wall - a model's tiles within its reach never crossed, a
 *  flat's at a cost - so a gate's road goes round the carriage standing beside it. */
function gatesAndBlocks(at, o, w, h, houses, records, walls, things = []) {
  const gates = at.map((g) => ({
    x: o.x + g.at[0] / TILE_M,
    y: o.y + g.at[1] / TILE_M,
    ox: g.out[0],
    oy: g.out[1],
    half: GATE_OPENING.half / TILE_M,
  }));
  const blocked = new Uint8Array(D * D),
    S = SHAPE_AUTOMAP_SIDE,
    C = TILE_M / (BLOCK_M / S);
  const mark = (tx, ty, v) => {
    if (tx >= 0 && ty >= 0 && tx < D && ty < D && blocked[tx + ty * D] !== GATE_BLOCK.hard) blocked[tx + ty * D] = v;
  };
  for (const r of records) mark(o.x + Math.floor(r[0] / TILE_M), o.y + Math.floor(r[1] / TILE_M), GATE_BLOCK.soft);
  for (const [x, z, model] of things) {
    const reach = model ? GATE_CLEAR.model : GATE_CLEAR.flat;
    for (let tx = Math.floor((x - reach) / TILE_M); tx <= Math.floor((x + reach) / TILE_M); tx++)
      for (let ty = Math.floor((z - reach) / TILE_M); ty <= Math.floor((z + reach) / TILE_M); ty++) {
        if (
          Math.hypot(
            Math.max(tx * TILE_M, Math.min(x, (tx + 1) * TILE_M)) - x,
            Math.max(ty * TILE_M, Math.min(z, (ty + 1) * TILE_M)) - z,
          ) < reach
        )
          mark(o.x + tx, o.y + ty, model ? GATE_BLOCK.hard : GATE_BLOCK.soft);
      }
  }
  for (let cy = 0; cy < h * S; cy++)
    for (let cx = 0; cx < w * S; cx++) {
      const i = cy * w * S + cx;
      if (houses[i] || walls?.[i]) mark(o.x + Math.floor(cx / C), o.y + Math.floor(cy / C), GATE_BLOCK.hard);
    }
  return { gates, blocked };
}

/**
 * FB1028 ROADS: THE TILES INSIDE A WALL - each pixel tile (x + y * 128) whose middle stands inside the wall's line and off
 * its cells (`cells`, townWallCells', `CW` cells a row) - 1 inside, 0 under the wall or outside it. A row's crossings of
 * the line, filled between pairs (harbourKeep.js townKeepField's law). @param {any} wall @param {Uint8Array} cells
 * @param {number} CW @param {{ x: number, y: number }} o the town's south-west tile in its pixel
 */
export function insideWall(wall, cells, CW, o) {
  const out = new Uint8Array(D * D),
    line = wall.line,
    CH = cells.length / CW,
    C = TILE_M / (BLOCK_M / SHAPE_AUTOMAP_SIDE);
  for (let ty = 0; ty < D; ty++) {
    const z = (ty - o.y + 0.5) * TILE_M,
      xs = [];
    for (let i = 0, k = line.length - 1; i < line.length; k = i++) {
      const [x1, z1] = line[k],
        [x2, z2] = line[i];
      if (z1 > z !== z2 > z) xs.push(x1 + ((z - z1) * (x2 - x1)) / (z2 - z1));
    }
    xs.sort((a, b) => a - b);
    for (let q = 0; q + 1 < xs.length; q += 2) {
      for (
        let tx = Math.max(0, Math.ceil(xs[q] / TILE_M - 0.5 + o.x));
        tx < D && (tx - o.x + 0.5) * TILE_M <= xs[q + 1];
        tx++
      ) {
        const cx = Math.floor((tx - o.x + 0.5) * C),
          cy = Math.floor((ty - o.y + 0.5) * C);
        if (!(cx >= 0 && cy >= 0 && cx < CW && cy < CH && cells[cy * CW + cx])) out[tx + ty * D] = 1;
      }
    }
  }
  return out;
}

/** AUDIT CAPITAL-CARRIAGES L2: the wall carrier's gate things standing outside its wall (world/townWalls.js gateFurniture:
 *  Immersive Travel's carriage, team and driver) - [x, z, model] in the town's metres; never its wall's model nor a start
 *  marker. @param {any} rmb the carrier's RMB half @param {any} wall */
function gateThingsOutside(rmb, wall) {
  const line = wall?.line ?? [],
    inside = (x, z) => {
      let c = false;
      for (let i = 0, k = line.length - 1; i < line.length; k = i++) {
        const [xi, zi] = line[i],
          [xk, zk] = line[k];
        if (zi > z !== zk > z && x < ((xk - xi) * (z - zi)) / (zk - zi) + xi) c = !c;
      }
      return c;
    };
  const at = (r) => [r.xPos * 0.025, (r.zPos + 4096) * 0.025];
  return [
    ...(rmb?.misc3dObjectRecords ?? []).filter((r) => r.modelIdNum < TOWN_WALL_MODEL_BASE).map((r) => [...at(r), true]),
    ...(rmb?.miscFlatObjectRecords ?? [])
      .filter((r) => !(r.textureArchive === 199 && r.textureRecord === 10))
      .map((r) => [...at(r), false]),
  ].filter(([x, z]) => !inside(x, z));
}
/** Each block's misc models' and flats' places in the town's metres (world/townShape.js townTiles' read). */
function rmbAtRecords(w, h, rmbAt) {
  const out = [];
  for (let by = 0; by < h; by++)
    for (let bx = 0; bx < w; bx++) {
      const rmb = rmbAt(bx, by);
      for (const r of [...(rmb?.misc3dObjectRecords ?? []), ...(rmb?.miscFlatObjectRecords ?? [])])
        out.push([bx * BLOCK_M + r.xPos * 0.025, by * BLOCK_M + (r.zPos + 4096) * 0.025]);
    }
  return out;
}
