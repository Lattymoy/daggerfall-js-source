#!/usr/bin/env node
// THE SHIP REFIT, HELD TO THE SHELLS IT FURNISHES (src/world/shipRefit.js). Each ship's interior is laid out from the
// player's own BLOCKS.BSA and ARCH3D.BSA through the port's own builder, and every piece is asked:
//   - no wall of the shell passes through it (rays from its middle to its sides and corners, at three heights);
//   - it stands on the floor, or on the piece it is stacked on;
//   - it overlaps no other piece;
//   - every floor reachable before the refit still is (no piece shuts a door, a hatch or a passage), and every
//     container has floor beside it, within arm's reach of a stacked one;
//   - a flat stands on the floor (or its table) and a lamp hangs from the ceiling;
//   - on the open deck the same, against the hull, from the deck's own start.
//
//   node tools/shipRefitCheck.mjs <arena2>     prints each problem; exit 1 if any

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isMain } from './lib/isMain.mjs';
import { BlocksFile } from '../src/formats/blocksFile.js';
import { Arch3dFile } from '../src/formats/arch3dFile.js';
import { TextureFile } from '../src/formats/textureFile.js';
import { DFPalette } from '../src/formats/dfPalette.js';
import { dfMeshToModel } from '../src/world/meshReader.js';
import { layoutInterior } from '../src/world/interior/interiorLayout.js';
import { Collider } from '../src/player/collider.js';
import { trs } from '../src/world/mat4.js';
import { ROTATION_DIVISOR } from '../src/formats/blocksFile.js';
import { buildingReplacementFromJson } from '../src/formats/worldData/worldDataReplacement.js';
import { isHouseContainerModel } from '../src/systems/containers.js';
import { SHIP_REFIT, shipRefitJson, REFIT_FLAT_PX, REFIT_MODEL_FOOT } from '../src/world/shipRefit.js';

const STEP = 0.25; // the walk's grid
const CLIMB = 0.5; // a step a player takes
const SLACK = 0.02; // a piece may stand this close to a wall or a floor

export function loadArena2(arena2) {
  const blocks = new BlocksFile();
  if (!blocks.load(new Uint8Array(readFileSync(join(arena2, 'BLOCKS.BSA')))))
    throw new Error('BLOCKS.BSA did not load');
  const arch = new Arch3dFile();
  arch.load(new Uint8Array(readFileSync(join(arena2, 'ARCH3D.BSA'))));
  const palette = new DFPalette();
  palette.load(new Uint8Array(readFileSync(join(arena2, 'ART_PAL.COL'))));
  const models = new Map();
  const getModel = (id) => {
    if (!models.has(id)) {
      const r = arch.getRecordIndex(id);
      models.set(id, r < 0 ? null : dfMeshToModel(arch.getMesh(r), () => ({ width: 64, height: 64 })));
    }
    return models.get(id);
  };
  const textures = new Map();
  const flatSize = (archive, record) => {
    if (!textures.has(archive)) {
      const t = new TextureFile();
      const name = `TEXTURE.${String(archive).padStart(3, '0')}`;
      textures.set(archive, t.load(new Uint8Array(readFileSync(join(arena2, name))), name, palette) ? t : null);
    }
    const t = textures.get(archive);
    return t ? { size: t.getSize(record), scale: t.getScale(record) } : null;
  };
  return { blocks, getModel, flatSize };
}

/** A model's vertices under its matrix: their box. */
function worldBox(model, mat) {
  const lo = [Infinity, Infinity, Infinity],
    hi = [-Infinity, -Infinity, -Infinity];
  const p = model.positions;
  for (let i = 0; i < p.length; i += 3) {
    const v = [
      mat[0] * p[i] + mat[4] * p[i + 1] + mat[8] * p[i + 2] + mat[12],
      mat[1] * p[i] + mat[5] * p[i + 1] + mat[9] * p[i + 2] + mat[13],
      mat[2] * p[i] + mat[6] * p[i + 1] + mat[10] * p[i + 2] + mat[14],
    ];
    for (let k = 0; k < 3; k++) {
      lo[k] = Math.min(lo[k], v[k]);
      hi[k] = Math.max(hi[k], v[k]);
    }
  }
  return { lo, hi };
}

/** A model's triangles under its matrix, in world space: [[a, b, c], ...]. */
function trianglesOf(model, m) {
  const p = model.positions,
    idx = model.indices,
    out = [];
  const at = (i) => [
    m[0] * p[i * 3] + m[4] * p[i * 3 + 1] + m[8] * p[i * 3 + 2] + m[12],
    m[1] * p[i * 3] + m[5] * p[i * 3 + 1] + m[9] * p[i * 3 + 2] + m[13],
    m[2] * p[i * 3] + m[6] * p[i * 3 + 1] + m[10] * p[i * 3 + 2] + m[14],
  ];
  for (let t = 0; t < idx.length; t += 3) out.push([at(idx[t]), at(idx[t + 1]), at(idx[t + 2])]);
  return out;
}
/** AUDIT SHIP-REFIT: HOW FAR THE SHELL'S SURFACE PASSES INTO A BOX - every shell triangle near it sampled every 4 cm,
 *  each point inside `box` measured by its least axis: `foot` where the face looks up (a floor - a foot settling on a
 *  curved deck), `side` where it does not (a wall or a bulwark through it). Eight rays from a piece's middle missed a
 *  sloped bulwark that rose through a crate's outer corners between the heights they were cast at. */
const SAMPLE_M = 0.04;
function shellDepthIn(tris, box) {
  let foot = 0,
    side = 0;
  for (const [a, b, c] of tris) {
    if ([0, 1, 2].some((k) => Math.max(a[k], b[k], c[k]) < box.lo[k] || Math.min(a[k], b[k], c[k]) > box.hi[k]))
      continue;
    const e1 = [0, 1, 2].map((k) => b[k] - a[k]),
      e2 = [0, 1, 2].map((k) => c[k] - a[k]);
    const nm = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    const floorFace = Math.abs(nm[1]) >= 0.7 * Math.hypot(...nm);
    const n = Math.min(
      400,
      Math.ceil(
        Math.max(
          Math.hypot(...[0, 1, 2].map((k) => b[k] - a[k])),
          Math.hypot(...[0, 1, 2].map((k) => c[k] - a[k])),
          Math.hypot(...[0, 1, 2].map((k) => c[k] - b[k])),
        ) / SAMPLE_M,
      ),
    );
    for (let i = 0; i <= n; i++) {
      for (let j = 0; i + j <= n; j++) {
        const u = i / n,
          v = j / n,
          w = 1 - u - v;
        const q = [0, 1, 2].map((k) => a[k] * w + b[k] * u + c[k] * v);
        const d = Math.min(...[0, 1, 2].map((k) => Math.min(q[k] - box.lo[k], box.hi[k] - q[k])));
        if (d <= 0) continue;
        if (floorFace) foot = Math.max(foot, d);
        else side = Math.max(side, d);
      }
    }
  }
  return { foot, side };
}
/** A billboard's column - it turns to the eye, so its footprint is its half width all round its centre - as a box. */
const flatColumn = (x, z, half, base, top) => ({ lo: [x - half, base, z - half], hi: [x + half, top, z + half] });
const overlapOf = (a, b) => Math.min(...[0, 1, 2].map((k) => Math.min(a.hi[k], b.hi[k]) - Math.max(a.lo[k], b.lo[k])));

/** The floor a player can reach from `start`, a cell a step: Map key -> { x, y, z }. */
function reachable(col, start, isBlocked) {
  const lv = (y) => Math.round(y / 0.6);
  const floorAt = (x, y, z) => {
    const h = col.raycastHit([x, y + 0.6, z], [0, -1, 0], 1.6);
    return h && Number.isFinite(h.dist) && h.normal && h.normal[1] > 0.7 && !h.back ? y + 0.6 - h.dist : null;
  };
  const out = new Map();
  const y0 = floorAt(start[0], start[1], start[2]);
  if (y0 == null) return out;
  const q = [[0, 0, y0]];
  out.set(`0,0,${lv(y0)}`, { x: start[0], y: y0, z: start[2] });
  while (q.length) {
    const [i, j, y] = q.shift();
    const x = start[0] + i * STEP,
      z = start[2] + j * STEP;
    for (const [di, dj] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = start[0] + (i + di) * STEP,
        nz = start[2] + (j + dj) * STEP;
      if (isBlocked(nx, nz)) continue;
      const ny = floorAt(nx, y + CLIMB, nz);
      if (ny == null || Math.abs(ny - y) > CLIMB) continue;
      const k = `${i + di},${j + dj},${lv(ny)}`;
      if (out.has(k)) continue;
      if ([0.5, 1.2].some((hh) => Number.isFinite(col.raycast([x, Math.max(y, ny) + hh, z], [di, 0, dj], STEP))))
        continue;
      if (Number.isFinite(col.raycast([nx, ny + 0.1, nz], [0, 1, 0], 1.7))) continue;
      out.set(k, { x: nx, y: ny, z: nz });
      q.push([i + di, j + dj, ny]);
    }
  }
  return out;
}

const name0 = (label, p) =>
  `${label} ${p.modelIdNum} at ${((p.box.lo[0] + p.box.hi[0]) / 2).toFixed(2)},${((p.box.lo[2] + p.box.hi[2]) / 2).toFixed(2)}`;
/** The checks every piece answers - walls, floor, overlaps, the walk and the containers - against `shell` (the classic
 *  models alone) and `all` (the shell with the pieces). */
function checkPieces({ label, shell, shellTris, all, pieces, before, start, isBlocked }) {
  const problems = [];
  const name = (p) =>
    `${label} ${p.modelIdNum} at ${((p.box.lo[0] + p.box.hi[0]) / 2).toFixed(2)},${((p.box.lo[2] + p.box.hi[2]) / 2).toFixed(2)}`;
  for (const [k, p] of pieces.entries()) {
    const { lo, hi } = p.box;
    const depth = shellDepthIn(shellTris, p.box);
    if (depth.side > SLACK * 1.5)
      problems.push(`${name(p)}: the shell passes ${depth.side.toFixed(2)} m into its side`);
    if (depth.foot > SLACK * 3) problems.push(`${name(p)}: its foot sinks ${depth.foot.toFixed(2)} m into the floor`);
    const c = [(lo[0] + hi[0]) / 2, 0, (lo[2] + hi[2]) / 2];
    const half = [(hi[0] - lo[0]) / 2, (hi[2] - lo[2]) / 2];
    for (const y of [lo[1] + 0.1, (lo[1] + hi[1]) / 2, hi[1] - 0.05]) {
      for (const [dx, dz, reach] of [
        [1, 0, half[0]],
        [-1, 0, half[0]],
        [0, 1, half[1]],
        [0, -1, half[1]],
      ]) {
        const d = shell.raycast([c[0], y, c[2]], [dx, 0, dz], reach + 1);
        if (Number.isFinite(d) && d < reach - SLACK) {
          problems.push(`${name(p)}: a wall ${d.toFixed(2)} m from its middle, inside its ${reach.toFixed(2)}`);
          break;
        }
      }
      for (const [sx, sz] of [
        [1, 1],
        [1, -1],
        [-1, 1],
        [-1, -1],
      ]) {
        const v = [sx * half[0], sz * half[1]],
          len = Math.hypot(...v);
        const d = shell.raycast([c[0], y, c[2]], [v[0] / len, 0, v[1] / len], len + 1);
        if (Number.isFinite(d) && d < len - SLACK * 2) {
          problems.push(`${name(p)}: a wall across its corner (${d.toFixed(2)} of ${len.toFixed(2)} m)`);
          break;
        }
      }
    }
    // the floor (or the piece it is stacked on) under its corners
    for (const [sx, sz] of [
      [0.8, 0.8],
      [0.8, -0.8],
      [-0.8, 0.8],
      [-0.8, -0.8],
      [0, 0],
    ]) {
      const x = c[0] + sx * half[0],
        z = c[2] + sz * half[1];
      const under = pieces.filter(
        (o, j) =>
          j !== k &&
          Math.abs(o.box.hi[1] - lo[1]) < SLACK &&
          x > o.box.lo[0] &&
          x < o.box.hi[0] &&
          z > o.box.lo[2] &&
          z < o.box.hi[2],
      );
      if (under.length) continue;
      const h = shell.raycastHit([x, lo[1] + 0.3, z], [0, -1, 0], 1);
      const gap = h && Number.isFinite(h.dist) ? h.dist - 0.3 : Infinity;
      if (Math.abs(gap) > SLACK * 2) {
        problems.push(`${name(p)}: ${Number.isFinite(gap) ? `${gap.toFixed(2)} m off` : 'no'} floor under a corner`);
        break;
      }
    }
    for (const o of pieces.slice(k + 1)) {
      const ov = [0, 1, 2].every((a) => Math.min(hi[a], o.box.hi[a]) - Math.max(lo[a], o.box.lo[a]) > SLACK);
      if (ov) problems.push(`${name(p)} overlaps ${name(o)}`);
    }
  }
  const covered = (x, z) =>
    pieces.some(
      (p) => x > p.box.lo[0] - 0.35 && x < p.box.hi[0] + 0.35 && z > p.box.lo[2] - 0.35 && z < p.box.hi[2] + 0.35,
    );
  const after = reachable(all, start, isBlocked);
  const lost = [...before.entries()].filter(([key, c]) => !after.has(key) && !covered(c.x, c.z));
  if (lost.length)
    problems.push(
      `${label}: ${lost.length} cells reachable before the refit are not after (first at ${lost[0][1].x.toFixed(2)},${lost[0][1].z.toFixed(2)})`,
    );
  for (const p of pieces.filter((q) => isHouseContainerModel(q.modelIdNum))) {
    const near = [...after.values()].some(
      (c) =>
        p.box.lo[1] - c.y > -0.6 &&
        p.box.lo[1] - c.y < 1.5 &&
        c.x > p.box.lo[0] - 1.2 &&
        c.x < p.box.hi[0] + 1.2 &&
        c.z > p.box.lo[2] - 1.2 &&
        c.z < p.box.hi[2] + 1.2,
    );
    if (!near) problems.push(`${name(p)}: a container no player can stand beside`);
  }
  return problems;
}

/** Every problem with one ship's refit, as text. */
export function checkShip(data, ship) {
  const { blocks, getModel, flatSize } = data;
  const problems = [];
  const classic = blocks.readClassicBlock(ship.index);
  const shellLay = layoutInterior(classic, ship.index, ship.record, getModel);
  const refit = buildingReplacementFromJson(shipRefitJson(blocks, ship));
  const block = {
    ...classic,
    rmbBlock: {
      ...classic.rmbBlock,
      subRecords: classic.rmbBlock.subRecords.map((s, i) =>
        i === ship.record ? { ...s, interior: refit.rmbSubRecord.interior } : s,
      ),
    },
  };
  const lay = layoutInterior(block, ship.index, ship.record, getModel);
  const shellCount = shellLay.placements.length;
  const shell = new Collider();
  const shellTris = [];
  for (const p of shellLay.placements) {
    const md = getModel(p.modelIdNum);
    shell.addMesh('shell', md.positions, md.indices, p.matrix);
    shellTris.push(...trianglesOf(md, p.matrix));
  }
  const doors = shellLay.doors.map((d) => {
    const c = d.centre,
      mt = d.matrix;
    return mt
      ? [mt[0] * c.x + mt[4] * c.y + mt[8] * c.z + mt[12], mt[2] * c.x + mt[6] * c.y + mt[10] * c.z + mt[14]]
      : [c.x, c.z];
  });
  const byDoor = (x, z) => doors.some((d) => Math.hypot(d[0] - x, d[1] - z) < 0.9);
  const marker = shellLay.markers[0];
  const before = reachable(shell, [marker.x, marker.y, marker.z], byDoor);
  // the pieces: the placements past the shell's own, in the order shipRefitJson appended them
  const all = new Collider();
  for (const p of lay.placements) {
    const md = getModel(p.modelIdNum);
    all.addMesh('all', md.positions, md.indices, p.matrix);
  }
  const pieces = lay.placements
    .slice(shellCount)
    .map((p) => ({ ...p, box: worldBox(getModel(p.modelIdNum), p.matrix) }));
  problems.push(
    ...checkPieces({
      label: ship.block,
      shell,
      shellTris,
      all,
      pieces,
      before,
      start: [marker.x, marker.y, marker.z],
      isBlocked: byDoor,
    }),
  );
  // the flats: the classic record's own (its lanterns) and the refit's, each a billboard's column clear of every piece
  const shellFlats = shellLay.flats.length;
  const column = (fl) => {
    const got = flatSize(fl.archive, fl.record);
    if (!got) return null;
    const w = got.size.width * (1 + got.scale.width / 256) * 0.025,
      h = got.size.height * (1 + got.scale.height / 256) * 0.025;
    return flatColumn(fl.x, fl.z, w / 2, fl.y - h / 2, fl.y + h / 2);
  };
  for (const [i, fl] of lay.flats.entries()) {
    const col = column(fl);
    if (!col) continue;
    for (const p of pieces) {
      const ov = overlapOf(col, p.box);
      if (ov > SLACK * 2)
        problems.push(
          `${ship.block} ${i < shellFlats ? 'classic' : 'refit'} flat ${fl.archive}_${fl.record} at ${fl.x.toFixed(2)},${fl.z.toFixed(2)}: ${ov.toFixed(2)} m into ${name0(ship.block, p)}`,
        );
    }
  }
  for (const fl of lay.flats.slice(shellFlats)) {
    const got = flatSize(fl.archive, fl.record);
    const key = `${fl.archive}_${fl.record}`;
    if (!got) {
      problems.push(`${ship.block} flat ${key}: not in this ARENA2`);
      continue;
    }
    if (REFIT_FLAT_PX[key] != null && (got.size.height !== REFIT_FLAT_PX[key] || got.scale.height !== 0))
      problems.push(
        `${ship.block} flat ${key}: ${got.size.height} px at scale ${got.scale.height}, the table says ${REFIT_FLAT_PX[key]}`,
      );
    const h = got.size.height * (1 + got.scale.height / 256) * 0.025;
    const base = fl.y - h / 2,
      top = fl.y + h / 2;
    const down = all.raycastHit([fl.x, base + 0.3, fl.z], [0, -1, 0], 1);
    const up = all.raycast([fl.x, top - 0.3, fl.z], [0, 1, 0], 1);
    const hangs = fl.archive === 210 && Number.isFinite(up) && Math.abs(up - 0.3) < 0.06;
    const stands = down && Number.isFinite(down.dist) && Math.abs(down.dist - 0.3) < 0.06;
    if (!hangs && !stands)
      problems.push(
        `${ship.block} flat ${key} at ${fl.x.toFixed(2)},${fl.z.toFixed(2)}: neither on a floor or a table nor hung from the ceiling`,
      );
  }
  problems.push(...checkDeck(data, ship, refit));
  return problems;
}

/** The open deck: the hull and the refit's pieces in the building's own frame (rmbLayout's exterior record transform). */
function checkDeck({ blocks, getModel }, ship, refit) {
  const problems = [];
  const label = `${ship.block} deck`;
  const matOf = (o) =>
    trs(
      o.xPos * 0.025,
      -o.yPos * 0.025,
      o.zPos * 0.025,
      -o.xRotation / ROTATION_DIVISOR,
      -o.yRotation / ROTATION_DIVISOR,
      -o.zRotation / ROTATION_DIVISOR,
      1,
      1,
      1,
    );
  const classicRecs = blocks.readClassicBlock(ship.index).rmbBlock.subRecords[ship.record].exterior
    .block3dObjectRecords;
  const recs = refit.rmbSubRecord.exterior.block3dObjectRecords;
  const shell = new Collider(),
    all = new Collider();
  const shellTris = [];
  for (const [k, o] of recs.entries()) {
    const md = getModel(o.modelIdNum);
    if (!md) {
      problems.push(`${label}: model ${o.modelIdNum} is not in this ARCH3D`);
      continue;
    }
    if (k < classicRecs.length) {
      shell.addMesh('shell', md.positions, md.indices, matOf(o));
      shellTris.push(...trianglesOf(md, matOf(o)));
    }
    all.addMesh('all', md.positions, md.indices, matOf(o));
    if (k >= classicRecs.length) {
      let lo = Infinity;
      for (let i = 1; i < md.positions.length; i += 3) lo = Math.min(lo, md.positions[i]);
      if (Math.abs(-lo - REFIT_MODEL_FOOT[o.modelIdNum]) > 0.001)
        problems.push(
          `${label}: model ${o.modelIdNum}'s foot is ${(-lo).toFixed(4)}, the table says ${REFIT_MODEL_FOOT[o.modelIdNum]}`,
        );
    }
  }
  const pieces = recs
    .slice(classicRecs.length)
    .map((o) => ({ modelIdNum: o.modelIdNum, box: worldBox(getModel(o.modelIdNum), matOf(o)) }));
  const start = [ship.deck.start[0], ship.deck.floor + 0.1, ship.deck.start[1]];
  const before = reachable(shell, start, () => false);
  if (before.size < 100) problems.push(`${label}: the deck's start reaches ${before.size} cells`);
  problems.push(...checkPieces({ label, shell, shellTris, all, pieces, before, start, isBlocked: () => false }));
  return problems;
}

export function checkShipRefit(arena2) {
  const data = loadArena2(arena2);
  return Object.values(SHIP_REFIT).flatMap((ship) => checkShip(data, ship));
}

if (isMain(import.meta.url)) {
  const arena2 = process.argv[2] ?? process.env.ARENA2_PATH;
  if (!arena2) {
    console.error('usage: node tools/shipRefitCheck.mjs <arena2>');
    process.exit(1);
  }
  const problems = checkShipRefit(arena2);
  for (const p of problems) console.log(p);
  console.log(problems.length ? `${problems.length} problems` : 'the refit stands clear');
  process.exit(problems.length ? 1 : 0);
}
