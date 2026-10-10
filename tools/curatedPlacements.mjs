#!/usr/bin/env node
// FIELD BUGS 2026-10-09e - HILL-HOUSE: THE CURATED PLACEMENTS, MEASURED - the rows src/world/curatedPlacements.js
// carries, made from the player's own data, as tools/templeSummoners.mjs made the summoners'.
//
//   ARENA2_PATH=<the player's arena2> node tools/curatedPlacements.mjs           print each row's measurement
//   ARENA2_PATH=<...> node tools/curatedPlacements.mjs --check                   compare with the committed rows (exit 1)
//
// For each row: the record's block as the door mints it (townQuestMarkers.mjs openTownData's packBlock - the pack's own
// rebuild over the player's BLOCKS.BSA, before any curation), every OTHER piece of the block laid as the exterior lays
// it (a subrecord's models under its own transform, the misc models under theirs, every flat), the pack's hills as the
// port draws them (townStandIns.js blockHillSeat - a hill is a surface, not a box: AUDIT FB1005 T3), and the record's
// own models at a candidate spot: its footprint (each model's box, PLACE_CLEAR_M wider all round) must stand inside the
// block EDGE_M from its edge, under no hill's surface higher than HILL_LIFT_M over the ground, over no other piece's
// footprint (PLACE_CLEAR_M wider) and no flat; its doors and DOOR_CLEAR_M before each must stand under no hill and in no
// other piece. The row's spot is the NEAREST such to the author's, at the author's own facing, on a SEARCH_STEP grid
// (the first found at the least distance, x then z ascending); its automap cells are the footprint's (the models'
// boxes, unwidened). Nothing of ARENA2 or the packs is written; the numbers are a measurement of the player's data.
import { join } from 'node:path';
import { isMain } from './lib/isMain.mjs';
import { openTownData, UNIT } from './townQuestMarkers.mjs';
import { trs, multiply } from '../src/world/mat4.js';
import { RMBRP_HILLS, blockHillSeat } from '../src/world/townStandIns.js';

/** A footprint's clearance all round, metres. */
export const PLACE_CLEAR_M = 1.5;
/** The door's approach: the door and every metre before it to this, metres. */
export const DOOR_CLEAR_M = 4;
/** A footprint's distance from the block's edge, metres (the block is 4096 units, 102.4 m). */
export const EDGE_M = 2;
/** A hill's surface over the ground under a footprint, metres, past which the hill stands on it. */
export const HILL_LIFT_M = 0.15;
/** The search's grid, block units. */
export const SEARCH_STEP = 32;
const BLOCK = 4096, RD = 512 / 90;   // RMB block units; Daggerfall's angle units a degree

const at = (M, p) => [0, 1, 2].map((k) => M[k] * p[0] + M[4 + k] * p[1] + M[8 + k] * p[2] + M[12 + k]);
const boxOf = (m) => {
  if (!m?.positions?.length) return null;
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < m.positions.length; i += 3) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], m.positions[i + k]); hi[k] = Math.max(hi[k], m.positions[i + k]); }
  return { lo, hi };
};
/** The exterior's transforms, as the wd3 sweep lays them: a subrecord at (xPos, 4096 - zPos), its models under it; a
 *  misc model at (xPos, zPos + 4096). Metres. */
const subMatrix = (x, z, rot) => trs(x * UNIT, 0, (BLOCK - z) * UNIT, 0, -rot / RD, 0);
const modelMatrix = (S, m) => multiply(S, trs(m.xPos * UNIT, -m.yPos * UNIT, m.zPos * UNIT, -m.xRotation / RD, -m.yRotation / RD, -m.zRotation / RD, m.xScale || 1, m.yScale || 1, m.zScale || 1));
const miscMatrix = (m) => trs(m.xPos * UNIT, (-m.yPos - 4) * UNIT, (m.zPos + BLOCK) * UNIT, -m.xRotation / RD, -m.yRotation / RD, -m.zRotation / RD, m.xScale || 1, m.yScale || 1, m.zScale || 1);
/** A box's footprint on the ground (x, z), `pad` metres wider: four corners. */
const footprint = (M, b, pad = 0) => [[b.lo[0] - pad, b.lo[2] - pad], [b.hi[0] + pad, b.lo[2] - pad], [b.hi[0] + pad, b.hi[2] + pad], [b.lo[0] - pad, b.hi[2] + pad]]
  .map(([x, z]) => { const w = at(M, [x, 0, z]); return [w[0], w[2]]; });
const inPoly = (pt, poly) => {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i], [xj, zj] = poly[j];
    if (((zi > pt[1]) !== (zj > pt[1])) && (pt[0] < ((xj - xi) * (pt[1] - zi)) / (zj - zi) + xi)) c = !c;
  }
  return c;
};
/** A quad's points on an n x n lattice (its corners and edges included). */
const lattice = (q, n = 8) => {
  const out = [];
  const [a, b, c, d] = q;
  for (let i = 0; i <= n; i++) for (let j = 0; j <= n; j++) {
    const u = i / n, v = j / n;
    out.push([a[0] + (b[0] - a[0]) * u + (d[0] - a[0]) * v + (c[0] - b[0] - d[0] + a[0]) * u * v, a[1] + (b[1] - a[1]) * u + (d[1] - a[1]) * v + (c[1] - b[1] - d[1] + a[1]) * u * v]);
  }
  return out;
};

/**
 * The block round one record: { dfBlock, sub, others: [{ id, poly }], seat, flats: [[x, z]], getModel }.
 * @param {Awaited<ReturnType<typeof openTownData>>} data
 */
export function placementContext(data, vendor, block, record) {
  const { dfBlock } = data.packBlock(vendor, block);
  const rmb = dfBlock.rmbBlock;
  const others = [], hills = [], flats = [];
  const piece = (id, M) => {
    if (RMBRP_HILLS[id]) { hills.push({ modelIdNum: id, matrix: M }); return; }
    const b = boxOf(data.getModel(id));
    if (b) others.push({ id, poly: footprint(M, b, PLACE_CLEAR_M) });
  };
  rmb.subRecords.forEach((sr, ri) => {
    const S = subMatrix(sr.xPos, sr.zPos, sr.yRotation);
    if (ri !== record) for (const m of sr.exterior.block3dObjectRecords) piece(m.modelIdNum, modelMatrix(S, m));
    if (ri !== record) for (const f of sr.exterior.blockFlatObjectRecords ?? []) { const w = at(S, [f.xPos * UNIT, 0, f.zPos * UNIT]); flats.push([w[0], w[2]]); }
  });
  for (const m of rmb.misc3dObjectRecords) piece(m.modelIdNum, miscMatrix(m));
  for (const f of rmb.miscFlatObjectRecords ?? []) flats.push([f.xPos * UNIT, (f.zPos + BLOCK) * UNIT]);
  return { dfBlock, sub: rmb.subRecords[record], others, seat: blockHillSeat(hills), flats, getModel: data.getModel };
}

/** What stands in the way of the record at (xPos, zPos, yRotation): a list of words, empty where the spot is clear. */
export function placementIssues(ctx, xPos, zPos, yRotation) {
  const S = subMatrix(xPos, zPos, yRotation);
  const issues = new Set();
  const lo = EDGE_M, hi = BLOCK * UNIT - EDGE_M;
  for (const m of ctx.sub.exterior.block3dObjectRecords) {
    const model = ctx.getModel(m.modelIdNum), b = boxOf(model);
    if (!b) continue;
    const M = modelMatrix(S, m);
    const fp = footprint(M, b, PLACE_CLEAR_M), pts = lattice(fp);
    if (fp.some(([x, z]) => x < lo || z < lo || x > hi || z > hi)) issues.add('the block\'s edge');
    if (pts.some(([x, z]) => (ctx.seat?.topAt(x, z) ?? -Infinity) > HILL_LIFT_M)) issues.add('a hill');
    for (const o of ctx.others) if (pts.some((p) => inPoly(p, o.poly)) || o.poly.some((p) => inPoly(p, fp))) issues.add(`model ${o.id}`);
    if (ctx.flats.some((f) => inPoly(f, fp))) issues.add('a flat');
    for (const d of model.doors ?? []) {
      const c = [(d.vert0.x + d.vert2.x) / 2, d.vert1.y + 1, (d.vert0.z + d.vert2.z) / 2];
      for (let k = 0; k <= DOOR_CLEAR_M; k++) {
        const w = at(M, [c[0] + d.normal.x * k, c[1], c[2] + d.normal.z * k]);
        if ((ctx.seat?.topAt(w[0], w[2]) ?? -Infinity) > w[1] - 1) issues.add(k ? 'a hill before the door' : 'a hill at the door');
        for (const o of ctx.others) if (inPoly([w[0], w[2]], o.poly)) issues.add(`model ${o.id} before the door`);
      }
    }
  }
  return [...issues];
}

/** The nearest clear spot to the author's, at the author's facing: { xPos, zPos, yRotation, metres } or null. */
export function nearestClear(ctx, step = SEARCH_STEP) {
  const { xPos: ax, zPos: az, yRotation } = ctx.sub;
  let best = null;
  for (let x = step; x < BLOCK; x += step) {
    for (let z = step; z < BLOCK; z += step) {
      const d = Math.hypot(x - ax, z - az);
      if (best && d >= best.d) continue;
      if (!placementIssues(ctx, x, z, yRotation).length) best = { x, z, d };
    }
  }
  return best ? { xPos: best.x, zPos: best.z, yRotation, metres: +(best.d * UNIT).toFixed(2) } : null;
}

/** The automap cells the record's models cover at a spot: [col0, row0, col1, row1], a cell 64 block units, the row a
 *  zPos's (the automap's own: a building's pixels stand at its xPos / 64, zPos / 64). */
export function footprintCells(ctx, xPos, zPos, yRotation) {
  let c0 = Infinity, r0 = Infinity, c1 = -Infinity, r1 = -Infinity;
  const S = subMatrix(xPos, zPos, yRotation);
  for (const m of ctx.sub.exterior.block3dObjectRecords) {
    const b = boxOf(ctx.getModel(m.modelIdNum));
    if (!b) continue;
    for (const [x, z] of footprint(modelMatrix(S, m), b)) {
      const col = Math.floor(x / UNIT / 64), row = Math.floor((BLOCK - z / UNIT) / 64);
      c0 = Math.min(c0, col); c1 = Math.max(c1, col); r0 = Math.min(r0, row); r1 = Math.max(r1, row);
    }
  }
  return [Math.max(0, c0), Math.max(0, r0), Math.min(63, c1), Math.min(63, r1)];
}

/** Every row measured: { block, record, model, authored: issues, from, to, automap }. */
export async function measurePlacements(data, rows) {
  const out = [];
  for (const r of rows) {
    const ctx = placementContext(data, r.vendor, r.block, r.record);
    const { xPos, zPos, yRotation } = ctx.sub;
    const to = nearestClear(ctx);
    out.push({
      block: r.block, record: r.record, model: ctx.sub.exterior.block3dObjectRecords[0]?.modelIdNum,
      authored: placementIssues(ctx, xPos, zPos, yRotation), from: { xPos, zPos, yRotation },
      to: to && { xPos: to.xPos, zPos: to.zPos, yRotation: to.yRotation }, metres: to?.metres ?? null,
      automap: to ? footprintCells(ctx, to.xPos, to.zPos, to.yRotation) : null,
    });
  }
  return out;
}

if (isMain(import.meta.url)) {
  const arena2 = process.env.ARENA2_PATH;
  if (!arena2) { console.error('ARENA2_PATH not set'); process.exit(2); }
  const { CURATED_PLACEMENTS } = await import('../src/world/curatedPlacements.js');
  const data = await openTownData(join(arena2));
  const rows = await measurePlacements(data, CURATED_PLACEMENTS);
  if (process.argv.includes('--check')) {
    const strip = (r) => ({ block: r.block, record: r.record, model: r.model, from: r.from, to: r.to, automap: r.automap });
    const want = JSON.stringify(rows.map(strip)), have = JSON.stringify(CURATED_PLACEMENTS.map((r) => strip({ ...r, from: { ...r.from }, to: { ...r.to }, automap: [...r.automap] })));
    if (want !== have) { console.error('the committed rows are not the measurement'); console.log(JSON.stringify(rows, null, 2)); process.exit(1); }
    console.log(`the ${rows.length} committed rows are the measurement`);
  } else {
    console.log(JSON.stringify(rows, null, 2));
  }
}
