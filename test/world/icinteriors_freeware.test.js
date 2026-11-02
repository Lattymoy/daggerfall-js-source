// IC-INTERIORS (2026-10-27; bible/03-World/Arena-Provinces.md IC-INTERIORS) - THE IMPERIAL CITY'S OWN INTERIORS AGAINST THE
// FREEWARE (the player's own ARCH3D and BLOCKS.BSA, ARENA2_PATH - tools/fetch-data.sh): every piece Daggerfall's own and
// measured as the kit's table says, the street door's wall the game's door at the building's door, Daggerfall's every
// ladder climbed the same by the ladder's own markers, made interiors seen through nowhere and drawn twice nowhere, every
// donor's cast stood again. The laws without the freeware: test/world/icinteriors.test.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fabricCell } from '../../src/world/imperialFabric.js';
import { fabricCellBuildings, fabricBuildingInterior, withFabricBuildings, fabricDoorModel, FABRIC_DONORS, _resetFabricInteriors } from '../../src/world/imperialFabricBuildings.js';
import { KIT_PIECE, KIT_MEASURE, KIT_SHIFT, KIT_LADDER, KIT_SET_ARCHIVES, FURNITURE, kitModel } from '../../src/world/interior/fabricInteriorKit.js';
import { imperialBlockJson, imperialOwnName } from '../../src/world/imperialBlocks.js';
import { IMPERIAL_CELLS, IMPERIAL_SECTORS, polar, imperialCell } from '../../src/world/imperialCity.js';
import { portBlockJson, startMarkerAt, miscModelAt } from '../../src/world/tamrielCapitals.js';
import { layoutRmbBlock } from '../../src/world/rmbLayout.js';
import { getStaticDoors } from '../../src/world/staticDoors.js';
import { doorWorldPosition, doorWorldNormal, climbLadder } from '../../src/player/enterExit.js';
import { dfMeshToModel, GLOBAL_SCALE } from '../../src/world/meshReader.js';
import { layoutInterior, INTERIOR_MARKER } from '../../src/world/interior/interiorLayout.js';
import { BlocksFile } from '../../src/formats/blocksFile.js';
import { Arch3dFile } from '../../src/formats/arch3dFile.js';
import { BLOCK_M } from '../../src/world/spawnedDungeons.js';

const B = BLOCK_M, HALF = IMPERIAL_CELLS / 2;
function sampleCell(x, z, n = 8) {
  const r0 = Math.floor(z / B + HALF), c0 = Math.floor(x / B + HALF);
  for (let k = 0; k < 6; k++) for (let r = r0 - k; r <= r0 + k; r++) for (let c = c0 - k; c <= c0 + k; c++) {
    if (Math.max(Math.abs(r - r0), Math.abs(c - c0)) !== k || !/^I/.test(imperialCell(r, c) ?? '')) continue;
    if (fabricCell(r, c).plots.length >= n) return [r, c];
  }
  return null;
}
/** The BLD sample's cells (every sector, the inner and the outer ring, the palace's), and a spread of the city's. */
const CELLS = [...IMPERIAL_SECTORS.flatMap(([, b]) => [[b + 22.5, 3000], [b + 37.5, 5300]]), [170, 7300]].map(([b, r]) => sampleCell(...polar(b, r))).filter(Boolean);
const SPREAD = [];
for (let r = 5; r < IMPERIAL_CELLS; r += 29) for (let c = 7; c < IMPERIAL_CELLS; c += 29) if (/^I/.test(imperialCell(r, c) ?? '')) SPREAD.push([r, c]);
const SAMPLE = [];
for (const [r, c] of [...CELLS, ...SPREAD]) SAMPLE.push(...fabricCellBuildings(r, c));

const ARENA2 = process.env.ARENA2_PATH;
const skipReal = !ARENA2 || !existsSync(ARENA2) ? 'ARENA2_PATH not set or missing - the pieces against the freeware skipped' : false;
test('IC-INTERIORS DAGGERFALL\'S OWN PIECES, AS THE FREEWARE HAS THEM - every kit piece in all nine building sets and every piece of FURNITURE in ARCH3D, measured as the table says (a piece made elsewhere moved as KIT_SHIFT says); the street door\'s wall the game\'s door, entered from the building\'s own door; Daggerfall\'s every ladder climbed the same by its own markers as by DFU\'s nearest; and a spread of made interiors seen through nowhere and drawn twice nowhere (mutants: a set\'s window wall unshifted; a ceiling\'s shift; a wall stretched short)', { skip: skipReal }, () => {
  const af = new Arch3dFile(); af.load(new Uint8Array(readFileSync(`${ARENA2}/ARCH3D.BSA`)));
  const bf = new BlocksFile(); bf.load(new Uint8Array(readFileSync(`${ARENA2}/BLOCKS.BSA`)));
  const models = new Map();
  const getModel = (id) => { if (!models.has(id)) { let m = null; try { const k = af.getRecordIndex(id); if (k >= 0) m = dfMeshToModel(af.getMesh(k), () => ({ width: 64, height: 64 })); } catch { m = null; } models.set(id, m); } return models.get(id); };
  const bounds = (id) => { const m = getModel(id), P = m.positions, lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity]; for (let i = 0; i < P.length; i += 3) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], P[i + k]); hi[k] = Math.max(hi[k], P[i + k]); } return [lo.map((v) => v / GLOBAL_SCALE), hi.map((v) => v / GLOBAL_SCALE)]; };
  // the kit in every set, each a pure move of set 0's (KIT_SHIFT's, else none)
  for (const piece of Object.values(KIT_PIECE)) {
    const [lo0, hi0] = bounds(piece);
    for (let s = 0; s < KIT_SET_ARCHIVES.length; s++) {
      const id = kitModel(piece, s);
      assert.ok(getModel(id), `${id} in ARCH3D`);
      const [lo, hi] = bounds(id), sh = KIT_SHIFT[id] ?? [0, 0, 0];
      for (let k = 0; k < 3; k++) assert.ok(Math.abs(lo[k] - lo0[k] - sh[k]) < 1.5 && Math.abs(hi[k] - hi0[k] - sh[k]) < 1.5, `${id} axis ${k}: ${lo[k] - lo0[k]} / ${hi[k] - hi0[k]} against ${sh[k]}`);
    }
  }
  // the street door's wall: its door face (the game's door) where KIT_MEASURE says, its middle along the wall
  const [face] = getModel(KIT_PIECE.exit).doors;
  assert.ok(Math.abs((face.vert0.z + face.vert2.z) / 2 / GLOBAL_SCALE - KIT_MEASURE.exitDoorMid) < 0.5 && Math.abs(face.vert0.x) < 1e-6, 'the street door on its wall');
  // the furniture measured: its extent at rest and its height
  for (const [id, [x0, x1, z0, z1, h]] of Object.entries(FURNITURE)) {
    const [lo, hi] = bounds(Number(id));
    assert.ok(Math.abs(lo[0] - x0) < 2 && Math.abs(hi[0] - x1) < 2 && Math.abs(lo[2] - z0) < 2 && Math.abs(hi[2] - z1) < 2 && Math.abs(hi[1] - lo[1] - h) < 3, `${id}: ${lo.map(Math.round)} ${hi.map(Math.round)}`);
  }
  // every ladder of Daggerfall's own blocks: its own markers are DFU's nearest
  let same = 0;
  for (let i = 0; i < 2000; i++) {
    let blk; try { blk = bf.getBlock(i); } catch { break; }
    if (!blk?.rmbBlock) continue;
    blk.rmbBlock.subRecords.forEach((sub, k) => {
      if (!sub.interior?.block3dObjectRecords?.some((o) => o.modelIdNum === KIT_LADDER)) return;
      const lay = layoutInterior(blk, blk.index, k, getModel), tops = lay.markers.filter((m) => m.type === INTERIOR_MARKER.LADDER_TOP), bots = lay.markers.filter((m) => m.type === INTERIOR_MARKER.LADDER_BOTTOM);
      if (!tops.length || !bots.length) return;
      for (const l of lay.placements.filter((p) => p.modelIdNum === KIT_LADDER)) {
        const M = l.matrix, nearest = (list, p) => list.reduce((a, m) => (Math.hypot(m.x - p[0], m.y - p[1], m.z - p[2]) < Math.hypot(a.x - p[0], a.y - p[1], a.z - p[2]) ? m : a));
        const b0 = nearest(bots, [M[12], M[13] - 1.6, M[14]]), t0 = nearest(tops, [M[12], M[13] + 1.6, M[14]]);
        for (const at of [[b0.x, b0.y + 1.17, b0.z], [t0.x, t0.y + 1.17, t0.z]]) assert.deepEqual(climbLadder(at, lay.markers, INTERIOR_MARKER, M), climbLadder(at, lay.markers, INTERIOR_MARKER), `${blk.name} #${k}`);
        same++;
      }
    });
  }
  assert.ok(same > 1500, `${same} of Daggerfall's ladders`);
  // made interiors, entered: the street door's wall a door the player leaves by, at the building's door; seen through
  // nowhere at eye height; no two faces of two pieces drawn in one plane
  const mul = (A, Bm) => { const o = new Float32Array(16); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { let s = 0; for (let k = 0; k < 4; k++) s += A[k * 4 + i] * Bm[j * 4 + k]; o[j * 4 + i] = s; } return o; };
  const DEPS = { portBlockJson, miscModelAt, startMarkerAt, footprintOf: () => null, anchorMarkers: [], noGround: 255, rim: () => false };
  const [r, c] = CELLS[2], name = imperialOwnName(r, c);
  _resetFabricInteriors();
  const block = withFabricBuildings(imperialBlockJson(name, DEPS), name, bf);
  let entered = 0;
  for (const m of layoutRmbBlock(block).models.filter((x) => x.recordIndex != null).slice(0, 10)) {
    const [door] = getStaticDoors(fabricDoorModel(m.modelIdNum), block.index, m.recordIndex, m.matrix), D = doorWorldPosition(door), N = doorWorldNormal(door);
    const inner = layoutInterior(block, block.index, m.recordIndex, getModel);
    const exits = inner.doors.map((x) => ({ ...x, matrix: mul(door.matrix, x.matrix) })).map((x) => [doorWorldPosition(x), doorWorldNormal(x)]);
    // the street door's wall's door face (facing in, the building's out): at the building's door, a wall's breadth in
    assert.ok(exits.some(([p, n]) => Math.abs((p[0] - D[0]) * N[2] - (p[2] - D[2]) * N[0]) < 0.05 && Math.hypot(p[0] - D[0], p[2] - D[2]) < 0.3 && n[0] * N[0] + n[2] * N[2] < -0.99), `building ${m.recordIndex}: its street door at the building's (${exits.length} doors)`);
    entered++;
    leakFree(inner, getModel, `${name} #${m.recordIndex}`);
  }
  assert.equal(entered, 10);
  _resetFabricInteriors();
});

/** No see-through gap at eye height (rays from cell middles: the first face hit faces the eye) and no two pieces' faces in
 *  one plane facing one way over each other. */
function leakFree(inner, getModel, label) {
  const arch = inner.placements.filter((p) => p.objectType !== 3);
  const xf = (M, x, y, z) => [M[0] * x + M[4] * y + M[8] * z + M[12], M[1] * x + M[5] * y + M[9] * z + M[13], M[2] * x + M[6] * y + M[10] * z + M[14]];
  const tris = [];
  arch.forEach((p, pi) => {
    const m = getModel(p.modelIdNum), P = m.positions, I = m.indices, N = m.normals, M = p.matrix;
    for (let t = 0; t < I.length; t += 3) {
      const a = xf(M, P[I[t] * 3], P[I[t] * 3 + 1], P[I[t] * 3 + 2]), b = xf(M, P[I[t + 1] * 3], P[I[t + 1] * 3 + 1], P[I[t + 1] * 3 + 2]), c = xf(M, P[I[t + 2] * 3], P[I[t + 2] * 3 + 1], P[I[t + 2] * 3 + 2]);
      const k = I[t] * 3, sn = [M[0] * N[k] + M[4] * N[k + 1] + M[8] * N[k + 2], M[1] * N[k] + M[5] * N[k + 1] + M[9] * N[k + 2], M[2] * N[k] + M[6] * N[k + 1] + M[10] * N[k + 2]], l = Math.hypot(...sn) || 1;
      tris.push({ a, b, c, sn: sn.map((v) => v / l), pi });
    }
  });
  const ray = (o, d) => {
    let best = Infinity, hit = null;
    for (const t of tris) {
      const e1 = [t.b[0] - t.a[0], t.b[1] - t.a[1], t.b[2] - t.a[2]], e2 = [t.c[0] - t.a[0], t.c[1] - t.a[1], t.c[2] - t.a[2]];
      const p = [d[1] * e2[2] - d[2] * e2[1], d[2] * e2[0] - d[0] * e2[2], d[0] * e2[1] - d[1] * e2[0]], det = e1[0] * p[0] + e1[1] * p[1] + e1[2] * p[2];
      if (Math.abs(det) < 1e-12) continue;
      const inv = 1 / det, s = [o[0] - t.a[0], o[1] - t.a[1], o[2] - t.a[2]], u = (s[0] * p[0] + s[1] * p[1] + s[2] * p[2]) * inv;
      if (u < -1e-6 || u > 1 + 1e-6) continue;
      const q = [s[1] * e1[2] - s[2] * e1[1], s[2] * e1[0] - s[0] * e1[2], s[0] * e1[1] - s[1] * e1[0]], v = (d[0] * q[0] + d[1] * q[1] + d[2] * q[2]) * inv;
      if (v < -1e-6 || u + v > 1 + 1e-6) continue;
      const tt = (e2[0] * q[0] + e2[1] * q[1] + e2[2] * q[2]) * inv;
      if (tt <= 1e-4) continue;
      const front = t.sn[0] * d[0] + t.sn[1] * d[1] + t.sn[2] * d[2] < 0;
      if (tt < best - 1e-3 || (tt < best + 1e-3 && front && hit && !(hit.sn[0] * d[0] + hit.sn[1] * d[1] + hit.sn[2] * d[2] < 0))) { best = Math.min(best, tt); hit = t; }
    }
    return hit;
  };
  const eyes = inner.markers.filter((m) => m.type === INTERIOR_MARKER.ENTER || m.type === INTERIOR_MARKER.LADDER_TOP || m.type === INTERIOR_MARKER.LADDER_BOTTOM);
  for (const e of eyes) for (let a = 0; a < 24; a++) {
    const th = (a / 24) * Math.PI * 2 + 0.0137, up = [0, 0.35, -0.35][a % 3], d = [Math.cos(th), up, Math.sin(th)], l = Math.hypot(...d);
    const h = ray([e.x + 0.07, e.y + 1.6, e.z + 0.11], d.map((v) => v / l));
    assert.ok(h && h.sn[0] * d[0] + h.sn[1] * d[1] + h.sn[2] * d[2] < 0, `${label}: seen through from ${[e.x, e.y, e.z].map((v) => v.toFixed(2))} toward ${d.map((v) => (v / l).toFixed(2))}`);
  }
  const groups = new Map();
  for (const t of tris) { const off = t.sn[0] * t.a[0] + t.sn[1] * t.a[1] + t.sn[2] * t.a[2], k = `${t.sn.map((v) => Math.round(v * 50)).join(',')}|${Math.round(off * 200)}`; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(t); }
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    const n = list[0].sn, ax = Math.abs(n[1]) > 0.9 ? [0, 2] : Math.abs(n[0]) > 0.9 ? [1, 2] : [0, 1], P2 = (v) => [v[ax[0]], v[ax[1]]];
    const inT = (q, [a, b, c]) => { const d = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]); if (Math.abs(d) < 1e-12) return false; const l1 = ((b[1] - c[1]) * (q[0] - c[0]) + (c[0] - b[0]) * (q[1] - c[1])) / d, l2 = ((c[1] - a[1]) * (q[0] - c[0]) + (a[0] - c[0]) * (q[1] - c[1])) / d; return l1 > 0.01 && l2 > 0.01 && 1 - l1 - l2 > 0.01; };
    for (let x = 0; x < list.length; x++) for (let y = x + 1; y < list.length; y++) {
      if (list[x].pi === list[y].pi) continue;
      const A = [list[x].a, list[x].b, list[x].c].map(P2), C = [list[y].a, list[y].b, list[y].c].map(P2);
      const bb = (pp) => [Math.min(...pp.map((q) => q[0])), Math.min(...pp.map((q) => q[1])), Math.max(...pp.map((q) => q[0])), Math.max(...pp.map((q) => q[1]))];
      const a = bb(A), c = bb(C), lo = [Math.max(a[0], c[0]), Math.max(a[1], c[1])], hi = [Math.min(a[2], c[2]), Math.min(a[3], c[3])];
      if (hi[0] - lo[0] < 0.02 || hi[1] - lo[1] < 0.02) continue;
      let hits = 0;
      for (let u = lo[0] + 0.01; u < hi[0]; u += 0.03) for (let v = lo[1] + 0.01; v < hi[1]; v += 0.03) if (inT([u, v], A) && inT([u, v], C)) hits++;
      assert.ok(hits <= 3, `${label}: pieces ${arch[list[x].pi].modelIdNum} and ${arch[list[y].pi].modelIdNum} drawn in one plane`);
    }
  }
}

test('IC-INTERIORS THE DONORS\' CASTS AS THE FREEWARE HAS THEM - every donor\'s people and quest markers stood again in a building of its pool: each person (its picture, its faction, its flags, its stream position) and each marker of the donor in the building\'s own rooms, the questor pool\'s people the scene\'s', { skip: skipReal }, () => {
  const bf = new BlocksFile(); bf.load(new Uint8Array(readFileSync(`${ARENA2}/BLOCKS.BSA`)));
  _resetFabricInteriors();
  const byDonor = new Map();
  for (const b of SAMPLE) if (!byDonor.has(b.donor)) byDonor.set(b.donor, b);
  assert.ok(byDonor.size > 40, `${byDonor.size} donors met`);
  for (const [k, b] of byDonor) {
    const d = FABRIC_DONORS[k], src = bf.getBlockByName(d.block).rmbBlock.subRecords[d.record].interior, made = fabricBuildingInterior(b, bf);
    assert.equal(made.cast, src, `${d.block}#${d.record}: its cast`);
    assert.deepEqual(made.blockPeopleRecords.map((p) => [p.textureArchive, p.textureRecord, p.factionID, p.flags, p.position, ...p.castPos]), src.blockPeopleRecords.map((p) => [p.textureArchive, p.textureRecord, p.factionID, p.flags, p.position, p.xPos, p.yPos, p.zPos]));
    const quest = (list) => list.filter((f) => f.textureArchive === 199 && (f.textureRecord === 11 || f.textureRecord === 18)).map((f) => f.textureRecord);
    assert.deepEqual(quest(made.blockFlatObjectRecords), quest(src.blockFlatObjectRecords), `${d.block}#${d.record}: its quest markers`);
  }
  _resetFabricInteriors();
});
