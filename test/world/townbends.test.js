// TOWN-SHAPES TS8 (2026-10-26, the owner: "Town walls and their curvature expose thin open extruding walls";
// bible/03-World/Town-Shapes.md TS8): a bend's tower is Daggerfall's corner tower's BODY - the corner tower (ARCH3D 444)
// carries two 6.4 m stubs of wall, open at their ends, where a corner's two lengths meet it, and TS4 stood it whole at
// every bend of a line that is no corner: one stub into the town, one out past the wall's face, the body off the line.
// Pinned on a corner tower's shape (no data), on the game's own 444 and on the walls of the cities past the Bay (ARENA2).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { bendTower, townWall, townWallModel, townWallCells, CORNER_TOWER, WALL_MODELS, TOWN_WALL } from '../../src/world/townWalls.js';
import { outlineTownLocation, TOWN_OUTLINE_BLOCK } from '../../src/world/townOutline.js';
import { isWallCarrier } from '../../src/world/townShape.js';

const ARENA2 = process.env.ARENA2_PATH;
const skipReal = !ARENA2 || !['BLOCKS.BSA', 'MAPS.BSA', 'ARCH3D.BSA'].every((f) => existsSync(join(ARENA2 ?? '', f))) ? 'ARENA2_PATH not set or missing - real-data validation skipped' : false;

/** A corner tower's shape, faces as quads (two triangles each, `n` its outward normal): the body's four sides (its -x and
 *  +z whole, its +x and -z over the wall walk only - a stub under each), the two stubs, and the crown's top. */
function cornerTower() {
  const faces = [];
  const quad = (a, b, c, d, n, tex = [317, 0]) => faces.push({ q: [a, b, c, d], n, tex });
  const [x0, x1, z0, z1] = CORNER_TOWER.body, C = CORNER_TOWER.crown;
  quad([x0, 0, z0], [x0, 0, z1], [x0, C, z1], [x0, C, z0], [-1, 0, 0]);   // the body's -x side, whole
  quad([x0, 0, z1], [x1, 0, z1], [x1, C, z1], [x0, C, z1], [0, 0, 1]);   // its +z side, whole
  quad([x1, 6.45, z0], [x1, 6.45, z1], [x1, C, z1], [x1, C, z0], [1, 0, 0]);   // its +x side over the walk
  quad([x0, 6.45, z0], [x1, 6.45, z0], [x1, C, z0], [x0, C, z0], [0, 0, -1]);   // its -z side over the walk
  quad([x1, 6.45, 2.23], [x1, 6.45, 3.48], [x1, 8.7, 3.48], [x1, 8.7, 2.23], [1, 0, 0], [74, 0]);   // a door onto the walk
  quad([x0, 0, -8.35], [x0, 0, z0], [x0, 8.05, z0], [x0, 8.05, -8.35], [-1, 0, 0]);   // the -z stub's side
  quad([x1, 0, z1], [8.4, 0, z1], [8.4, 8.05, z1], [x1, 8.05, z1], [0, 0, 1]);   // the +x stub's side
  quad([-8.4, 14.45, -2.7], [2.8, 14.45, -2.7], [2.8, 14.45, 8.35], [-8.4, 14.45, 8.35], [0, 1, 0]);   // the crown
  return modelOf(faces);
}
/** Faces to dfMeshToModel's shape: a submesh a picture, a vertex a corner of a triangle. */
function modelOf(faces) {
  const byTex = new Map();
  for (const f of faces) { const k = f.tex.join('/'); if (!byTex.has(k)) byTex.set(k, []); byTex.get(k).push(f); }
  const positions = [], normals = [], uvs = [], subMeshes = [];
  for (const [k, fs] of byTex) {
    const startIndex = positions.length / 3;
    for (const f of fs) for (const i of [0, 1, 2, 0, 2, 3]) { positions.push(...f.q[i]); normals.push(...f.n); uvs.push(i & 1, i >> 1); }
    const [a, r] = k.split('/').map(Number);
    subMeshes.push({ textureArchive: a, textureRecord: r, startIndex, primitiveCount: fs.length * 2 });
  }
  const n = positions.length / 3;
  return { positions: new Float32Array(positions), normals: new Float32Array(normals), uvs: new Float32Array(uvs), indices: Uint32Array.from({ length: n }, (_, i) => i), subMeshes };
}
/** Each triangle of a model: its corners and its mean normal. */
function triangles(m) {
  const out = [];
  for (let t = 0; t < m.indices.length; t += 3) {
    const v = [0, 1, 2].map((k) => m.indices[t + k]);
    out.push({ p: v.map((i) => [m.positions[i * 3], m.positions[i * 3 + 1], m.positions[i * 3 + 2]]), n: [0, 1, 2].map((a) => (m.normals[v[0] * 3 + a] + m.normals[v[1] * 3 + a] + m.normals[v[2] * 3 + a]) / 3) });
  }
  return out;
}
/** Whether a level ray from `o` along `d` meets a triangle of `tris` whose normal faces back at it, within `far`. */
function meetsFace(tris, o, d, far) {
  for (const { p, n } of tris) {
    if (n[0] * d[0] + n[1] * d[1] + n[2] * d[2] >= 0) continue;
    const e1 = [0, 1, 2].map((a) => p[1][a] - p[0][a]), e2 = [0, 1, 2].map((a) => p[2][a] - p[0][a]);
    const h = [d[1] * e2[2] - d[2] * e2[1], d[2] * e2[0] - d[0] * e2[2], d[0] * e2[1] - d[1] * e2[0]];
    const det = e1[0] * h[0] + e1[1] * h[1] + e1[2] * h[2];
    if (Math.abs(det) < 1e-9) continue;
    const s = [0, 1, 2].map((a) => o[a] - p[0][a]), u = (s[0] * h[0] + s[1] * h[1] + s[2] * h[2]) / det;
    if (u < 0 || u > 1) continue;
    const q = [s[1] * e1[2] - s[2] * e1[1], s[2] * e1[0] - s[0] * e1[2], s[0] * e1[1] - s[1] * e1[0]];
    const v = (d[0] * q[0] + d[1] * q[1] + d[2] * q[2]) / det;
    if (v < 0 || u + v > 1) continue;
    const t = (e2[0] * q[0] + e2[1] * q[1] + e2[2] * q[2]) / det;
    if (t > 0 && t < far) return true;
  }
  return false;
}
/** The body's half side, metres. */
const HALF = (CORNER_TOWER.body[1] - CORNER_TOWER.body[0]) / 2;
/** A bend tower's sides closed: from 6 m out of each side, at every height to the crown, a level ray in meets a face
 *  turned out to it within the side. */
function assertClosed(tris, what) {
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    for (const y of [0.5, 3, 6, 7.5, 9, 12]) {
      for (const along of [-3.5, 0, 3.5]) {
        const o = [dx * 6 + dz * along, y, dz * 6 + dx * along];
        assert.ok(meetsFace(tris, o, [-dx, 0, -dz], 6 - HALF + 0.01), `${what}: its side (${dx}, ${dz}) closed at ${y} m, ${along} along`);
      }
    }
  }
}

test('TS8 a bend\'s tower: the corner tower\'s body alone at the origin - its stubs and the faces over the walk on their two sides left out, those sides closed with its own outer faces turned a half round, the crown kept; once a model; a tower of another measure as it stands (mutants: a stub kept; a side left open; the turned face unturned; the body off the origin; a mod\'s tower cut)', () => {
  const m = cornerTower(), b = bendTower(m);
  assert.equal(bendTower(m), b, 'kept a model');
  const tris = triangles(b);
  const under = tris.filter((t) => t.p.some((p) => p[1] < CORNER_TOWER.crown - 0.02));
  for (const t of under) for (const p of t.p) assert.ok(Math.abs(p[0]) <= HALF + 1e-4 && Math.abs(p[2]) <= HALF + 1e-4, `no stub: (${p.map((v) => v.toFixed(2))}) in the body`);
  for (const t of under) {
    const mid = [0, 2].map((a) => (t.p[0][a] + t.p[1][a] + t.p[2][a]) / 3);
    assert.ok(t.n[0] * mid[0] + t.n[2] * mid[1] > 0, 'every side faces out');
  }
  assert.equal(under.length, 8, 'four sides, two triangles each - the door and the faces over the walk gone with the stubs');
  assertClosed(tris, 'the shape');
  const crown = tris.filter((t) => t.p.every((p) => Math.abs(p[1] - 14.45) < 1e-4)).flatMap((t) => t.p);
  assert.ok(crown.length, 'the crown kept');
  assert.deepEqual([Math.min(...crown.map((p) => p[0])), Math.max(...crown.map((p) => p[0]))].map((v) => Math.round(v * 100) / 100), [-5.6, 5.6], 'its crown about the body\'s middle');
  assert.deepEqual(b.subMeshes.map((s) => `${s.textureArchive}/${s.textureRecord}`), ['317/0'], 'the door\'s picture gone with its face');
  // a tower of another measure (a mod's, a tenth larger): as it stands
  const big = modelOf([{ q: [[-9.24, 0, -9.2], [9.24, 0, -9.2], [9.24, 15, 9.2], [-9.24, 15, 9.2]], n: [0, 0, -1], tex: [317, 0] }]);
  assert.equal(bendTower(big), big);
  assert.equal(bendTower(null), null);
});

test('TS8 the wall\'s model and cells: a tower piece the bend\'s tower, a length Daggerfall\'s own; a tower\'s cells its body\'s square (mutants: the towers whole; the lengths cut)', () => {
  const m = cornerTower(), wallLen = modelOf([{ q: [[-12.8, 0, 4.8], [12.8, 0, 4.8], [12.8, 8.05, 4.8], [-12.8, 8.05, 4.8]], n: [0, 0, 1], tex: [317, 0] }]);
  const classic = (id) => (id === WALL_MODELS.tower ? m : wallLen);
  const one = townWallModel([{ model: WALL_MODELS.tower, at: [100, 50], out: [0, 1], stretch: 1 }], classic);
  const xs = [];
  for (let v = 0; v < one.positions.length; v += 3) if (one.positions[v + 1] < CORNER_TOWER.crown - 0.02) xs.push(one.positions[v] - 100, one.positions[v + 2] - 50);
  assert.ok(xs.every((d) => Math.abs(d) <= HALF + 1e-3), 'the tower stood its body alone, on its point');
  const len = townWallModel([{ model: WALL_MODELS.wall, at: [100, 50], out: [0, 1], stretch: 1 }], classic);
  assert.equal(len.positions.length, wallLen.positions.length, 'a length as Daggerfall made it');
  const cells = townWallCells({ pieces: [{ model: WALL_MODELS.tower, at: [51.2, 51.2], out: [0, 1], stretch: 1 }] }, 1, 1);
  assert.equal(cells.reduce((a, v) => a + v, 0), 36, 'six cells by six: 9.6 m');
});

test('TS8 with ARENA2: Daggerfall\'s corner tower made a bend\'s - nothing under its crown outside its body, its four sides closed to the crown', { skip: skipReal }, async () => {
  const { Arch3dFile } = await import('../../src/formats/arch3dFile.js');
  const { dfMeshToModel } = await import('../../src/world/meshReader.js');
  const arch = new Arch3dFile();
  arch.load(new Uint8Array(readFileSync(join(ARENA2, 'ARCH3D.BSA'))));
  const m = dfMeshToModel(arch.getMesh(arch.getRecordIndex(WALL_MODELS.tower)), () => ({ width: 64, height: 64 }));
  const b = bendTower(m);
  assert.notEqual(b, m, 'the game\'s 444 is the corner tower');
  const tris = triangles(b);
  for (const t of tris) for (const p of t.p) if (p[1] < CORNER_TOWER.crown - 0.02) assert.ok(Math.abs(p[0]) <= HALF + 1e-3 && Math.abs(p[2]) <= HALF + 1e-3, `(${p.map((v) => v.toFixed(2))}) in the body`);
  assertClosed(tris, '444');
  assert.ok(tris.some((t) => t.p.every((p) => Math.abs(p[1] - 14.45) < 0.01)), 'its crown');
  assert.ok(b.indices.length < m.indices.length, 'smaller');
});

test('TS8 with ARENA2: every ninth city past the Bay - every length\'s and gate\'s end stands in a tower\'s body or meets the next length square, and every face of its wall under the crowns within a piece\'s footprint: no stub, no open end (mutants: the towers whole)', { skip: skipReal }, async () => {
  const { BlocksFile } = await import('../../src/formats/blocksFile.js');
  const { MapsFile } = await import('../../src/formats/mapsFile.js');
  const { arenaTemplates } = await import('../../src/world/arenaLocations.js');
  const { Arch3dFile } = await import('../../src/formats/arch3dFile.js');
  const { dfMeshToModel } = await import('../../src/world/meshReader.js');
  const bytes = (n) => new Uint8Array(readFileSync(join(ARENA2, n)));
  const blocks = new BlocksFile(); blocks.load(bytes('BLOCKS.BSA'));
  const maps = new MapsFile(); maps.load(bytes('MAPS.BSA'), bytes('CLIMATE.PAK'), bytes('POLITIC.PAK')); maps.autoDiscard = false;
  const arch = new Arch3dFile(); arch.load(bytes('ARCH3D.BSA'));
  const models = new Map();
  const classic = (id) => { if (!models.has(id)) models.set(id, dfMeshToModel(arch.getMesh(arch.getRecordIndex(id)), () => ({ width: 64, height: 64 }))); return models.get(id); };
  const rows = [];
  for (let r = 0; r < 62; r++) { const reg = maps.getRegion(r); if (!reg) continue; for (let l = 0; l < reg.locationCount; l++) { const loc = maps.getLocation(r, l); if (loc) rows.push(loc); } }
  const cities = arenaTemplates(rows)['city-state'];
  const io = { classicOf: (n) => blocks.readClassicBlock(blocks.getBlockIndex(blocks.checkName(n))), servedOf: (n) => blocks.getBlockByName(n) };
  const rmbOf = (n) => (isWallCarrier(n) || n === TOWN_OUTLINE_BLOCK ? null : blocks.getBlockByName(n)?.rmbBlock ?? null);
  let ends = 0, inTowers = 0;
  for (let j = 0; j < cities.length; j += 9) {
    const t = cities[j], mapId = ((0xa7 << 20) | (500000 + j)) >>> 0;
    const loc = outlineTownLocation({ ...t, mapTableData: { ...t.mapTableData, mapId } }, io);
    const wall = townWall(loc, t.exterior.exteriorData.blockNames, rmbOf);
    const towers = wall.pieces.filter((p) => p.model === WALL_MODELS.tower), runs = wall.pieces.filter((p) => p.model !== WALL_MODELS.tower);
    /** where a point stands in a piece's frame: [along, out] */
    const local = (p, x, z) => { const dx = x - p.at[0], dz = z - p.at[1]; return [dx * p.out[1] - dz * p.out[0], dx * p.out[0] + dz * p.out[1]]; };
    for (const r of runs) {
      const half = (TOWN_WALL.piece * r.stretch) / 2, ux = r.out[1], uz = -r.out[0];
      for (const s of [-1, 1]) {
        const e = [r.at[0] + ux * half * s, r.at[1] + uz * half * s];
        // its two corners, across its thickness
        const corners = [-4.8, 4.8].map((o) => [e[0] + r.out[0] * o, e[1] + r.out[1] * o]);
        const tower = towers.find((tw) => corners.every(([x, z]) => local(tw, x, z).every((c) => Math.abs(c) <= HALF + 1e-6)));
        const next = runs.find((q) => q !== r && Math.abs(q.out[0] - r.out[0]) < 1e-9 && Math.abs(q.out[1] - r.out[1]) < 1e-9 && corners.every(([x, z]) => { const [a, o] = local(q, x, z); return Math.abs(Math.abs(a) - (TOWN_WALL.piece * q.stretch) / 2) < 1e-6 && Math.abs(o) <= 4.8 + 1e-6; }));
        assert.ok(tower || next, `${t.name}: a ${r.model}'s end at (${e.map((v) => v.toFixed(1))}) in a tower or square on the next length`);
        ends++; if (tower) inTowers++;
      }
    }
    // every vertex of the wall under the crowns in some piece's footprint (a tower its body, a length its own)
    const model = townWallModel(wall.pieces, classic);
    for (let v = 0; v < model.positions.length; v += 3) {
      if (model.positions[v + 1] >= CORNER_TOWER.crown - 0.02) continue;
      const x = model.positions[v], z = model.positions[v + 2];
      const inside = wall.pieces.some((p) => { const [a, o] = local(p, x, z), hl = p.model === WALL_MODELS.tower ? HALF : (TOWN_WALL.piece * p.stretch) / 2; return Math.abs(a) <= hl + 0.01 && Math.abs(o) <= HALF * (p.thick ?? 1) + 0.01; });   // PIN MOVED (FB1028): a bend's tower grown across
      assert.ok(inside, `${t.name}: (${x.toFixed(2)}, ${model.positions[v + 1].toFixed(2)}, ${z.toFixed(2)}) in a piece's footprint - no stub`);
    }
  }
  assert.ok(ends > 1000 && inTowers > ends / 3, `the ends (${inTowers} of ${ends} in towers)`);
});
