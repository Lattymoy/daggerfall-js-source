// CITY-WALL (FIELD BUGS 2026-10-03c, Mefwhesk on Discord: "Looks like there's some missing holes in the out walls of
// Alik'ra"; Fay: "Saw the same thing in Chesterwark. I assume it's a general issue"). Beautiful Cities turns its walls
// round corners of its own (WALLAA12-15, 112 composites), its first wall segment on each line a whole segment out from
// the corner tower, and closes the 128 units between with the RMB Resource Pack's wall piece 53210 - which the port
// stood nothing in for, so every corner of every city's wall stood open. Pinned here: the law the stand-in is built on,
// read straight off the vendored pack (every placement on its line, the gap 448-576 units from the crossing, the 445s
// beginning where it ends); the stand-in itself (the middle of the player's own 445, cut and moved, its faces and their
// pictures kept); its install behind the towns' switch; and the real pipeline building it from ARCH3D's 445 for the
// renderer and the collider.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

import { CITY_WALL_PIECE, CITY_WALL_MODEL, CITY_WALL_FILL, sliceModelX, cityWallFillModel, installTownStandIns, _resetTownStandIns } from '../../src/world/townStandIns.js';
import { _resetDetStandIns, MeshBuilder } from '../../src/world/detStandIns.js';
import { customModelFor, customModelNeeds, hasCustomModel, _resetCustomModels } from '../../src/world/customModels.js';
import { _resetFlatFields } from '../../src/world/flatFields.js';
import { addVendorTextures, clearVendorTextures } from '../../src/systems/textureReplacement.js';
import { _resetDetailedShipsArt, DETAILED_SHIPS_VENDOR } from '../../src/systems/detailedShips.js';
import { unregisterBillboardXml } from '../../src/world/billboardXml.js';
import { _resetModSettings } from '../../src/systems/modSettings.js';
import { createDataPipeline } from '../../src/scenes/dataPipeline.js';
import { color32Bytes } from '../../src/render/renderer.js';
import { GLOBAL_SCALE } from '../../src/world/meshReader.js';
import { trs, multiply } from '../../src/world/mat4.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const U = GLOBAL_SCALE;
const RD = 512 / 90;   // Daggerfall's angle units a degree

function resetAll() {
  _resetTownStandIns(); _resetDetStandIns(); _resetCustomModels(); _resetFlatFields(); clearVendorTextures();
  _resetDetailedShipsArt(); unregisterBillboardXml(DETAILED_SHIPS_VENDOR); _resetModSettings();
}

/** A stand-in 445 in dfMeshToModel's shape: a wall `len` units long on x (centred), `thick` across z (centred), `high`
 *  from the ground up, a merlon on its outer edge - every face facing its normal, uvs a texel a unit over a 64 picture. */
function fakeWall({ len = 1024, thick = 96, high = 320, tex = [17, 2] } = {}) {
  const m = new MeshBuilder();
  m.box(tex, [0, (high / 2) * U, 0], [len * U, high * U, thick * U], 1 / (64 * U));
  m.box(tex, [0, (high + 16) * U, (-thick / 2 + 8) * U], [len * U, 32 * U, 16 * U], 1 / (64 * U));
  return m.build();
}
const boundsOf = (m) => {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < m.positions.length; i++) { lo[i % 3] = Math.min(lo[i % 3], m.positions[i]); hi[i % 3] = Math.max(hi[i % 3], m.positions[i]); }
  return { lo, hi };
};
const units = (v) => v.map((x) => +(x / U).toFixed(3));
const faces = (m) => {
  const P = (i) => [m.positions[i * 3], m.positions[i * 3 + 1], m.positions[i * 3 + 2]];
  let along = 0, against = 0;
  for (let t = 0; t < m.indices.length; t += 3) {
    const [a, b, c] = [P(m.indices[t]), P(m.indices[t + 1]), P(m.indices[t + 2])], i0 = m.indices[t];
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], w = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const cr = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
    if (cr[0] * m.normals[i0 * 3] + cr[1] * m.normals[i0 * 3 + 1] + cr[2] * m.normals[i0 * 3 + 2] > 0) along++; else against++;
  }
  return { along, against };
};

// ---- the law, off the author's own placements ------------------------------------------------------------------------
test('CITY-WALL the law: 224 wall pieces, two in each of the 112 corner composites (WALLAA12-15), each alone in its subrecord and sunk one unit; in every one the two pieces\' lines cross 64 units from the corner tower\'s subrecord on both axes, each piece fills its line from 448 to 576 units off that crossing, and every 445 of the author\'s on the line begins where it ends (mutants: the fill\'s middle, its line, its length)', () => {
  const pack = JSON.parse(zlib.gunzipSync(readFileSync(join(ROOT, 'vendor/beautiful-cities/WorldDataPack/beautiful-cities.pack.json.gz'))).toString('utf8'));
  const P = (v) => (typeof v === 'string' ? JSON.parse(v) : v);
  const nodes = pack.nodes.map(P);
  const deref = (v) => (v && typeof v === 'object' && !Array.isArray(v) && v.$n !== undefined && Object.keys(v).length === 1 ? deref(nodes[v.$n]) : v);
  const at = (M, p) => [0, 1, 2].map((k) => M[k] * p[0] + M[4 + k] * p[1] + M[8 + k] * p[2] + M[12 + k]);
  const files = new Set();
  let placed = 0, withWalls = 0, abutting = 0;
  for (const [name, entry] of Object.entries(pack.files)) {
    const op = P(entry)[2].find((o) => o[0] === 's' && JSON.stringify(o[1]) === '["RmbBlock","SubRecords"]');
    if (!op) continue;
    const walls = [], fills = [], towers = [];
    for (const sr of op[2].map(deref)) {
      const ext = deref(sr.Exterior);
      if (ext.$c) continue;   // a classic subrecord's exterior, by reference - Daggerfall's own models, read only with ARENA2
      const rows = ext.Block3dObjectRecords.$m ?? ext.Block3dObjectRecords;
      const S = trs(sr.XPos, 0, 4096 - sr.ZPos, 0, -sr.YRotation / RD, 0);   // RMBLayout's subrecord, in classic units
      for (const r of rows) {
        assert.ok(Array.isArray(r), `${name}: a model row`);
        const [id, , x, y, z, rx, ry, rz] = r;
        const M = multiply(S, trs(x, -y, z, -rx / RD, -ry / RD, -rz / RD));
        if (id === CITY_WALL_MODEL) walls.push([at(M, [-512, 0, 0]), at(M, [512, 0, 0])]);
        if (id === 444) towers.push([sr.XPos, 4096 - sr.ZPos]);   // the corner tower's subrecord
        if (id === CITY_WALL_PIECE) {
          assert.equal(rows.length, 1, `${name}: the piece alone in its subrecord`);
          assert.deepEqual([x, y, z, rx, ry, rz], [0, 1, 0, 0, 0, 0], `${name}: on its subrecord's origin, sunk a unit, unturned`);
          fills.push(M);
        }
      }
    }
    if (!fills.length) continue;
    files.add(name);
    placed += fills.length;
    assert.equal(fills.length, 2, `${name}: one piece a line`);
    // the stand-in's span in each piece's own frame: its two ends on the line 128 along +z
    const span = fills.map((M) => [-1, 1].map((sg) => at(M, [CITY_WALL_FILL.x + (sg * CITY_WALL_FILL.length) / 2, 0, CITY_WALL_FILL.z])));
    const along = (e) => (Math.abs(e[1][0] - e[0][0]) > 1 ? 'x' : 'z');
    const onX = span.find((e) => along(e) === 'x'), onZ = span.find((e) => along(e) === 'z');
    assert.ok(onX && onZ, `${name}: one piece on each of the corner's two lines`);
    const zOfX = onX[0][2], xOfZ = onZ[0][0];   // where the two lines run - the corner is where they cross
    assert.equal(towers.length, 1, `${name}: one corner tower`);
    assert.deepEqual([Math.abs(towers[0][0] - xOfZ), Math.abs(towers[0][1] - zOfX)], [64, 64], `${name}: the tower 64 units in from the crossing, as Daggerfall's corners stand it`);
    const off = (p) => +Math.hypot(p[0] - xOfZ, p[2] - zOfX).toFixed(6);   // off the crossing, along the line
    for (const ends of [onX, onZ]) {
      assert.deepEqual(ends.map(off).sort((a, b) => a - b), [448, 576], `${name}: from the tower's edge to the first segment`);
      const k = along(ends);
      const line = walls.filter((w) => (k === 'x' ? Math.abs(w[0][2] - zOfX) < 1e-6 && Math.abs(w[1][2] - zOfX) < 1e-6 : Math.abs(w[0][0] - xOfZ) < 1e-6 && Math.abs(w[1][0] - xOfZ) < 1e-6));
      const parallel = walls.filter((w) => (Math.abs(w[1][0] - w[0][0]) > 1 ? 'x' : 'z') === k);
      assert.equal(line.length, parallel.length, `${name}: every 445 running that way stands on the piece's line`);
      if (!line.length) continue;   // a line whose every segment is Daggerfall's own, by reference
      withWalls++;
      const starts = line.map((w) => Math.min(off(w[0]), off(w[1])));
      assert.ok(starts.every((st) => st >= 576 && (st - 576) % 1024 === 0), `${name}: the 445s begin where the piece ends, a segment apart (${starts})`);
      if (starts.includes(576)) abutting++;
    }
  }
  assert.deepEqual([placed, files.size], [224, 112]);
  assert.ok([...files].every((n) => /^WALLAA1[2-5]\.[A-Z]{6}\d\d\.RMB\.json$/.test(n)), 'only the corner composites');
  assert.deepEqual([withWalls, abutting], [210, 147], 'the rest stand on lines of Daggerfall\'s own segments, read only with ARENA2');
});

// ---- the stand-in -----------------------------------------------------------------------------------------------------
test('CITY-WALL the stand-in: the middle 128 units of the player\'s 445 - every face that crosses the cut kept and cut, its uvs where the wall\'s own were, its winding and picture its own - moved 128 along x and z and lifted the unit the piece is sunk; nothing without a 445 (mutants: the cut planes, the move, the lift)', () => {
  assert.deepEqual([CITY_WALL_PIECE, CITY_WALL_MODEL], [53210, 445]);
  assert.deepEqual({ ...CITY_WALL_FILL }, { x: 128, z: 128, length: 128, lift: 1 });
  const wall = fakeWall();
  const fill = cityWallFillModel(wall);
  const wb = boundsOf(wall), fb = boundsOf(fill);
  assert.deepEqual([units(fb.lo), units(fb.hi)], [[64, units(wb.lo)[1] + 1, units(wb.lo)[2] + 128], [192, units(wb.hi)[1] + 1, units(wb.hi)[2] + 128]]);
  assert.deepEqual(fill.subMeshes.map((s) => [s.textureArchive, s.textureRecord]), [[17, 2]], 'the wall\'s own picture');
  assert.deepEqual(fill.doors, []);
  assert.deepEqual(faces(wall).against, 0);
  assert.deepEqual(faces(fill), { along: fill.indices.length / 3, against: 0 }, 'every face as the wall turned it');
  // the long faces are cut, not dropped; the end caps 512 units out are gone
  const xs = new Set(); for (let i = 0; i < fill.positions.length; i += 3) xs.add(+(fill.positions[i] / U).toFixed(3));
  assert.deepEqual([...xs].sort((a, b) => a - b), [64, 192], 'every vertex on one of the two cuts');
  const nx = [...fill.normals].filter((_, i) => i % 3 === 0);
  assert.ok(nx.every((v) => Math.abs(v) < 1e-6), 'no end cap of the 445 kept');
  // uvs: the box's front face runs u = x over a 64 picture from its left end - at the cut, the wall's own u there
  for (let i = 0; i < fill.positions.length / 3; i++) {
    const [x, , z] = [fill.positions[i * 3] / U, fill.positions[i * 3 + 1] / U, fill.positions[i * 3 + 2] / U];
    if (Math.abs(z - 128 - 48) < 1e-3 && Math.abs(fill.normals[i * 3 + 2] - 1) < 1e-6) assert.ok(Math.abs(fill.uvs[i * 2] - (x - 128 + 512) / 64) < 1e-4, `u at ${x}`);
  }
  for (const none of [null, undefined, {}, { positions: new Float32Array(0) }]) assert.equal(cityWallFillModel(none), null);
  assert.equal(sliceModelX(wall, 600 * U, 700 * U), null, 'nothing of the wall out past its end');
  const half = sliceModelX(wall, 0, 600 * U);
  assert.deepEqual(units(boundsOf(half).hi).slice(0, 1), [512], 'a slab past one end keeps that end\'s cap');
  assert.ok(faces(half).against === 0);
});

test('CITY-WALL the stand-in at its cuts (AUDIT CITY-WALL S1): a face lying ON a cut - float32 puts 1.6 m at 1.6000000238 - is kept when it looks out of the slab (a merlon\'s end the cut closes on) and dropped when it looks in (the next merlon\'s side, over the gap); nothing else of the outside is kept (mutants: the on-plane snap, which side is kept)', () => {
  // four merlons a unit tall above a plain wall face, their sides ON the cuts at x = -64 and +64 units:
  // [-128,-64] and [64,128] outside the slab, [-64,0] and [0,64] inside it
  const m = new MeshBuilder(), tex = [17, 2];
  for (const [a, b] of [[-128, -64], [-64, 0], [0, 64], [64, 128]]) m.box(tex, [((a + b) / 2) * U, 0.5 * U, 0], [(b - a) * U, U, 16 * U]);
  const cut = sliceModelX(m.build(), -64 * U, 64 * U);
  const ends = [];
  for (let t = 0; t < cut.indices.length; t += 3) {
    const i = cut.indices[t], nx = Math.round(cut.normals[i * 3]);
    const x = Math.round(cut.positions[i * 3] / U);
    if (nx !== 0 && Math.abs(x) === 64) ends.push(`${x}:${nx > 0 ? '+x' : '-x'}`);   // a face on a cut (the merlons' faces at 0 are the slab's own inside)
  }
  assert.deepEqual([...new Set(ends)].sort(), ['-64:-x', '64:+x'], 'the two merlons\' outer ends kept, the outside merlons\' inner sides dropped');
  assert.equal(ends.length, 4, 'each a whole face (two triangles)');
  const xs = [...cut.positions].filter((_, k) => k % 3 === 0).map((x) => x / U);
  assert.ok(xs.every((x) => x >= -64 - 1e-3 && x <= 64 + 1e-3), 'nothing of the outside');
  assert.ok(faces(cut).against === 0);
});

// ---- the install -------------------------------------------------------------------------------------------------------
test('CITY-WALL the install: 53210 behind the towns\' switch, its build reading the 445 out of the ctx it is handed - nothing built, and nothing kept, before the pipeline hands it over; ARCH3D\'s 445 its need', () => {
  resetAll();
  let on = true;
  installTownStandIns(() => on);
  assert.equal(hasCustomModel(CITY_WALL_PIECE), true);
  assert.deepEqual(customModelNeeds(CITY_WALL_PIECE), [445], 'the pipeline loads the 445\'s pictures before it builds');
  assert.equal(customModelFor(CITY_WALL_PIECE), null, 'no 445 handed over, no piece');
  const wall = fakeWall();
  const asked = [];
  const fill = customModelFor(CITY_WALL_PIECE, { classicModel: (id) => { asked.push(id); return id === 445 ? wall : null; } });
  assert.deepEqual(asked, [445]);
  assert.deepEqual(units(boundsOf(fill).lo).slice(0, 1), [64], 'built after an empty ask - the empty one was never kept');
  assert.equal(customModelFor(CITY_WALL_PIECE), fill, 'then kept');
  on = false;
  assert.equal(hasCustomModel(CITY_WALL_PIECE), false);
  assert.equal(customModelFor(CITY_WALL_PIECE), null, 'switched off: nothing stands, as before the towns');
  resetAll();
});

// ---- the pipeline -----------------------------------------------------------------------------------------------------
test('CITY-WALL the pipeline: getGpuMesh(53210) reads the 445 out of ARCH3D (its pictures loaded first), uploads the cut wall as the piece\'s mesh and keeps it for the collider - so the corner is shut to the eye and to the feet', async () => {
  resetAll();
  addVendorTextures([{ archive: 1210, record: 3, standIn: true, fileName: '1210_3-0', build: async () => ({ width: 64, height: 64, data: new Uint8Array(64 * 64 * 4).fill(255) }) }]);
  installTownStandIns(() => true);
  // the 445 as ARCH3D hands it: DFMesh planes, a triangle each, so dfMeshToModel's fan [p0, p2, p1] gives back the wall's own
  const wall = fakeWall({ tex: [1210, 3] });
  const planes = [];
  for (let t = 0; t < wall.indices.length; t += 3) {
    const pt = (i) => ({ x: wall.positions[i * 3] / U, y: -wall.positions[i * 3 + 1] / U, z: wall.positions[i * 3 + 2] / U, nx: wall.normals[i * 3], ny: -wall.normals[i * 3 + 1], nz: wall.normals[i * 3 + 2], u: wall.uvs[i * 2] * 64, v: -wall.uvs[i * 2 + 1] * 64 });
    const [a, b, c] = [wall.indices[t], wall.indices[t + 1], wall.indices[t + 2]];
    planes.push({ points: [pt(a), pt(c), pt(b)] });
  }
  const dfMesh = { totalVertices: planes.length * 3, totalTriangles: planes.length, subMeshes: [{ textureArchive: 1210, textureRecord: 3, totalTriangles: planes.length, planes }] };
  const asked = [];
  const arch = { getRecordIndex: (id) => { asked.push(id); return id === 445 ? 7 : -1; }, getMesh: (i) => { assert.equal(i, 7); return dfMesh; } };
  const renderer = {
    uploads: [], meshes: [],
    uploadTexture(a, r, c) { color32Bytes(c, `uploadTexture(${a}, ${r})`); this.uploads.push(`${a}_${r}`); },
    uploadEmissionTexture() {}, createMesh(m) { this.meshes.push(m); return { mesh: m }; },
  };
  const pipe = createDataPipeline({ renderer, arch, palette: null, fetch: async (n) => { throw new Error(`no ${n} here`); } });
  const gpu = await pipe.getGpuMesh(CITY_WALL_PIECE);
  assert.ok(gpu?.mesh, 'a mesh for the piece');
  assert.deepEqual(asked, [445, 445], 'the need, then the build - never 53210 of ARCH3D');
  assert.deepEqual(renderer.uploads, ['1210_3'], 'the 445\'s picture uploaded as a model\'s');
  const cpu = pipe.cpuModels.get(CITY_WALL_PIECE);
  assert.equal(cpu.positions, gpu.mesh.positions, 'the collider holds what is drawn');
  const b = boundsOf(cpu);
  assert.deepEqual([units(b.lo)[0], units(b.hi)[0]], [64, 192]);
  assert.ok(Math.abs(b.hi[1] / U - 353) < 1e-3 && Math.abs(b.lo[2] / U - 80) < 1e-3, 'the wall\'s height and thickness, moved onto the piece\'s line');
  assert.deepEqual(faces(cpu).against, 0, 'the 445\'s winding, through ARCH3D and back');
  resetAll();
});
