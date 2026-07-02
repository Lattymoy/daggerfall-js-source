import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { dfMeshToModel, GLOBAL_SCALE, DOOR_TYPE } from '../src/world/meshReader.js';
import { getStaticDoors } from '../src/world/staticDoors.js';
import { layoutInterior, isBadInteriorModel, INTERIOR_MARKER } from '../src/world/interiorLayout.js';
import { Arch3dFile } from '../src/formats/arch3dFile.js';
import { BlocksFile } from '../src/formats/blocksFile.js';

const ARENA2 = process.env.ARENA2_PATH;
const skipReal = !ARENA2 || !existsSync(ARENA2)
  ? 'ARENA2_PATH not set or missing - real-data validation skipped'
  : false;

function approx(actual, expected, eps = 1e-4) {
  assert.ok(Math.abs(actual - expected) < eps, `${actual} !~ ${expected}`);
}

// ---------------------------------------------------------------------------
// Synthetic - always run.
// ---------------------------------------------------------------------------

function doorPlane(x0) {
  // A flat door quad in the XY plane at z = 0, model units.
  return {
    points: [
      { x: x0, y: 0, z: 0, nx: 0, ny: 0, nz: 1, u: 0, v: 0 },
      { x: x0, y: 200, z: 0, nx: 0, ny: 0, nz: 1, u: 0, v: 0 },
      { x: x0 + 100, y: 200, z: 0, nx: 0, ny: 0, nz: 1, u: 0, v: 0 },
      { x: x0 + 100, y: 0, z: 0, nx: 0, ny: 0, nz: 1, u: 0, v: 0 },
    ],
  };
}

function mesh(subMeshes) {
  let tv = 0, tt = 0;
  for (const sm of subMeshes) {
    sm.totalTriangles = 0;
    for (const p of sm.planes) {
      tv += p.points.length;
      sm.totalTriangles += p.points.length - 2;
    }
    tt += sm.totalTriangles;
  }
  return { totalVertices: tv, totalTriangles: tt, subMeshes };
}

test('interior: ModelDoor extraction - archives, climate reduction, per-submesh index', () => {
  const unit = () => ({ width: 64, height: 64 });

  // Archive 74: each plane is one door; index resets per submesh.
  const m = dfMeshToModel(mesh([
    { textureArchive: 74, textureRecord: 0, planes: [doorPlane(0), doorPlane(200)] },
    { textureArchive: 174, textureRecord: 0, planes: [doorPlane(400)] }, // climate variant -> base 74
  ]), unit);
  assert.equal(m.doors.length, 3);
  assert.deepEqual(m.doors.map((d) => d.index), [0, 1, 0]);
  assert.ok(m.doors.every((d) => d.type === DOOR_TYPE.BUILDING));

  // Vert transform (X, -Y, Z) * scale and normal from cross(v0-v2, v0-v1).
  const d0 = m.doors[0];
  approx(d0.vert0.x, 0); approx(d0.vert0.y, 0); approx(d0.vert0.z, 0);
  approx(d0.vert1.y, -200 * GLOBAL_SCALE);
  approx(d0.vert2.x, 100 * GLOBAL_SCALE);
  approx(Math.hypot(d0.normal.x, d0.normal.y, d0.normal.z), 1);
  approx(d0.normal.z, -1); // y-flip mirrors the winding

  // Dungeon ruin enter 331: record 0 is plain stone, record 1 is a door.
  // 156 exempts the base reduction and is never a door itself.
  const m2 = dfMeshToModel(mesh([
    { textureArchive: 331, textureRecord: 0, planes: [doorPlane(0)] },
    { textureArchive: 331, textureRecord: 1, planes: [doorPlane(200)] },
    { textureArchive: 156, textureRecord: 1, planes: [doorPlane(400)] },
    { textureArchive: 95, textureRecord: 0, planes: [doorPlane(600)] },
  ]), unit);
  assert.equal(m2.doors.length, 2);
  assert.equal(m2.doors[0].type, DOOR_TYPE.DUNGEON_ENTRANCE);
  assert.equal(m2.doors[1].type, DOOR_TYPE.DUNGEON_EXIT);
});

test('interior: getStaticDoors size, centre, and null parity', () => {
  const doors = [{
    index: 0,
    type: DOOR_TYPE.BUILDING,
    vert0: { x: 1, y: 2.2, z: -0.2 },
    vert1: { x: 1, y: 2.2, z: 1 },
    vert2: { x: 1, y: 0, z: 1 },
    normal: { x: -1, y: 0, z: 0 },
  }];
  const matrix = new Float32Array(16);
  const out = getStaticDoors({ doors }, 823, 0, matrix);
  assert.equal(out.length, 1);
  const d = out[0];
  // width 0, height 2.2, depth 1.2 -> thickness 1.2,
  // size = (1.2, max(2.2, 1.2), min(2.2, 1.2)).
  approx(d.size.x, 1.2);
  approx(d.size.y, 2.2);
  approx(d.size.z, 1.2);
  approx(d.centre.x, 1); approx(d.centre.y, 1.1); approx(d.centre.z, 0.4);
  assert.equal(d.blockIndex, 823);
  assert.equal(d.matrix, matrix);
  assert.equal(getStaticDoors({}, 0, 0, matrix), null);
});

test('interior: isBadInteriorModel filters 31000 only at flagged records', () => {
  assert.equal(isBadInteriorModel(51, 1, 31000), true);
  assert.equal(isBadInteriorModel(51, 0, 31000), false);
  assert.equal(isBadInteriorModel(51, 1, 999), false);
  assert.equal(isBadInteriorModel(1278, 4, 31000), true);
  assert.equal(isBadInteriorModel(9999, 1, 31000), false);
});

test('interior: layoutInterior - prop anchor, marker split, action door modulo', () => {
  // Minimal model: two verts, lowest converted Y at -0.5.
  const model = {
    positions: new Float32Array([0, 1, 0, 0, -0.5, 0]),
    doors: [],
  };
  const dfBlock = {
    rmbBlock: {
      subRecords: [{
        interior: {
          header: { num3dObjectRecords: 2 },
          block3dObjectRecords: [
            { modelIdNum: 100, objectType: 0, xPos: 40, yPos: 80, zPos: 120, xRotation: 0, yRotation: 0, zRotation: 0 },
            // Prop: +Y (not negated), axis moved to lowest vertex Y.
            { modelIdNum: 100, objectType: 3, xPos: 0, yPos: 40, zPos: 0, xRotation: 0, yRotation: 0, zRotation: 0 },
          ],
          blockFlatObjectRecords: [
            { textureArchive: 210, textureRecord: 6, xPos: 8, yPos: -16, zPos: 24 },
            { textureArchive: 199, textureRecord: 8, xPos: 0, yPos: 0, zPos: 0 }, // Enter marker
          ],
          blockDoorRecords: [
            { xPos: 100, yPos: 0, zPos: 100, yRotation: 512, openRotation: 90, doorModelIndex: 7 },
          ],
        },
      }],
    },
  };
  const it = layoutInterior(dfBlock, 0, 0, () => model);
  assert.equal(it.placements.length, 2);
  approx(it.placements[0].matrix[12], 40 * GLOBAL_SCALE);
  approx(it.placements[0].matrix[13], -80 * GLOBAL_SCALE);
  // Prop Y: +yPos * scale - bottomY = 1 + 0.5.
  approx(it.placements[1].matrix[13], 40 * GLOBAL_SCALE + 0.5);

  assert.equal(it.flats.length, 1);
  approx(it.flats[0].y, 16 * GLOBAL_SCALE);
  assert.equal(it.markers.length, 1);
  assert.equal(it.markers[0].type, INTERIOR_MARKER.ENTER);

  assert.equal(it.actionDoors.length, 1);
  assert.equal(it.actionDoors[0].modelIdNum, 9002); // 9000 + 7 % 5
  assert.equal(it.actionDoors[0].openRotation, 90);
});

// ---------------------------------------------------------------------------
// Real-data validation - gated on ARENA2_PATH.
// ---------------------------------------------------------------------------

function loadReal() {
  const blocks = new BlocksFile();
  blocks.load(new Uint8Array(readFileSync(join(ARENA2, 'BLOCKS.BSA'))));
  const arch = new Arch3dFile();
  arch.load(new Uint8Array(readFileSync(join(ARENA2, 'ARCH3D.BSA'))));
  const cache = new Map();
  const getModel = (id) => {
    if (!cache.has(id)) {
      cache.set(id, dfMeshToModel(
        arch.getMesh(arch.getRecordIndex(id)),
        () => ({ width: 1, height: 1 })
      ));
    }
    return cache.get(id);
  };
  return { blocks, arch, getModel };
}

test('interior: ARCH3D corpus door extraction pins', { skip: skipReal }, () => {
  const { arch, getModel } = loadReal();
  let modelsWithDoors = 0, totalDoors = 0;
  const byType = { [DOOR_TYPE.BUILDING]: 0, [DOOR_TYPE.DUNGEON_ENTRANCE]: 0, [DOOR_TYPE.DUNGEON_EXIT]: 0 };
  for (let i = 0; i < arch.count; i++) {
    const model = getModel(arch.getRecordId(i));
    if (!model.doors.length) continue;
    modelsWithDoors++;
    totalDoors += model.doors.length;
    for (const d of model.doors) byType[d.type]++;
  }
  assert.equal(modelsWithDoors, 1398);
  assert.equal(totalDoors, 1999);
  assert.equal(byType[DOOR_TYPE.BUILDING], 1712);
  assert.equal(byType[DOOR_TYPE.DUNGEON_ENTRANCE], 285);
  assert.equal(byType[DOOR_TYPE.DUNGEON_EXIT], 2);
});

test('interior: MAGEAA00.RMB record 0 layout pins', { skip: skipReal }, () => {
  const { blocks, getModel } = loadReal();
  const bi = blocks.getBlockIndex('MAGEAA00.RMB');
  assert.equal(bi, 823);
  const b = blocks.getBlock(bi);
  const it = layoutInterior(b, bi, 0, getModel);

  assert.equal(it.placements.length, 78);
  assert.equal(it.actionDoors.length, 18);
  assert.equal(it.flats.length, 18);
  assert.equal(it.markers.length, 38);
  assert.equal(it.doors.length, 1);

  // First placement origin.
  approx(it.placements[0].matrix[12], -6.325);
  approx(it.placements[0].matrix[13], 1.575);
  approx(it.placements[0].matrix[14], 9.525);

  // The one static door: the interior face of the building exit.
  const d = it.doors[0];
  assert.equal(d.doorType, DOOR_TYPE.BUILDING);
  approx(d.centre.x, 0); approx(d.centre.y, -0.4625); approx(d.centre.z, -0.625);
  approx(d.size.x, 1.25); approx(d.size.y, 2.225); approx(d.size.z, 1.25);

  // First action door: model modulo into the 9000 range, closed pose.
  assert.equal(it.actionDoors[0].modelIdNum, 9004);
  assert.equal(it.actionDoors[0].openRotation, 90);
  approx(it.actionDoors[0].matrix[12], 3.375);
  approx(it.actionDoors[0].matrix[13], 1.125);
  approx(it.actionDoors[0].matrix[14], 11.775);

  // Enter markers exist for the spawn point.
  assert.ok(it.markers.some((m) => m.type === INTERIOR_MARKER.ENTER));

  // Prop anchor math holds on real data: first objectType-3 record.
  const sr = b.rmbBlock.subRecords[0].interior.block3dObjectRecords;
  const propI = sr.findIndex((o) => o.objectType === 3);
  assert.ok(propI !== -1);
  const prop = sr[propI];
  const verts = getModel(prop.modelIdNum).positions;
  let bottomY = verts[1];
  for (let i = 4; i < verts.length; i += 3) if (verts[i] < bottomY) bottomY = verts[i];
  approx(it.placements[propI].matrix[13], prop.yPos * GLOBAL_SCALE - bottomY);
});

test('interior: full corpus - every building interior lays out clean', { skip: skipReal }, () => {
  const { blocks, getModel } = loadReal();
  let interiors = 0, placements = 0, staticDoors = 0, flats = 0, filtered = 0;
  for (let i = 0; i < blocks.count; i++) {
    if (blocks.getBlockName(i).indexOf('.RMB') === -1) continue;
    const blk = blocks.getBlock(i);
    for (let r = 0; r < blk.rmbBlock.subRecords.length; r++) {
      const sr = blk.rmbBlock.subRecords[r];
      if (sr.interior.header.num3dObjectRecords === 0) continue;
      const out = layoutInterior(blk, i, r, getModel);
      interiors++;
      placements += out.placements.length;
      staticDoors += out.doors.length;
      flats += out.flats.length;
      filtered += sr.interior.block3dObjectRecords.length - out.placements.length;
    }
  }
  assert.equal(interiors, 6832);
  assert.equal(placements, 226208);
  assert.equal(staticDoors, 11449);
  assert.equal(flats, 39940);
  // Exactly one misplaced model 31000 per flagged block/record combo -
  // the IsBadInteriorModel table has 60 combos across 27 blocks.
  assert.equal(filtered, 60);
});

test('interior: R8 point lights - offsets and MAGEAA00 pins', { skip: skipReal }, async () => {
  const { collectInteriorLights, INTERIOR_AMBIENT, INTERIOR_LIGHT_RANGE } =
    await import('../src/world/interiorLights.js');
  // Offset law on synthetic flats: base + h/2 + per-record offset;
  // 14/15 use +h/2 and 21 uses +h/2.4; unknown records add 0.
  const size = () => ({ w: 1, h: 2 });
  const mk = (record) => collectInteriorLights(
    [{ archive: 210, record, x: 0, y: 10, z: 0 }], size)[0];
  approx(mk(6).y, 10 + 1 + 0.6);
  approx(mk(24).y, 10 + 1 - 1.85);
  approx(mk(14).y, 10 + 1 + 1);
  approx(mk(21).y, 10 + 1 + 2 / 2.4);
  approx(mk(7).y, 10 + 1); // "todo" record: no offset
  assert.equal(mk(6).range, INTERIOR_LIGHT_RANGE);
  // Non-210 flats produce nothing.
  assert.equal(collectInteriorLights(
    [{ archive: 199, record: 1, x: 0, y: 0, z: 0 }], size).length, 0);
  assert.deepEqual([...INTERIOR_AMBIENT], [0.18, 0.18, 0.18]);

  // Real data: the mages guild hall carries 17 lights; the first is the
  // record-6 skull torch at flat y + h/2 + 0.6.
  const { blocks, getModel } = loadReal();
  const { DFPalette } = await import('../src/formats/dfPalette.js');
  const { TextureFile } = await import('../src/formats/textureFile.js');
  const { scaledBillboardSize } = await import('../src/world/rmbFlats.js');
  const pal = new DFPalette();
  pal.load(new Uint8Array(readFileSync(join(ARENA2, 'ART_PAL.COL'))), 'ART_PAL.COL');
  const t210 = new TextureFile();
  t210.load(new Uint8Array(readFileSync(join(ARENA2, 'TEXTURE.210'))), 'TEXTURE.210', pal);
  const idx = blocks.getBlockIndex('MAGEAA00.RMB');
  const interior = layoutInterior(blocks.getBlock(idx), idx, 0, getModel);
  const getSize = (r) => scaledBillboardSize(t210.getSize(r), t210.getScale(r));
  const lights = collectInteriorLights(interior.flats, getSize);
  assert.equal(lights.length, 17);
  approx(lights[0].x, 8.4);
  approx(lights[0].y, 14.675);
  approx(lights[0].z, 4.4);
});
