// FIELD BUGS 2026-10-05 HILL-SHAPES (Discord: "Houses in Ipsham are floating" - "Whole crib is f up", houses over a
// gap at night by a dock; "this particular structure is frequently flying" - a gazebo on a stepped stone base).
//
// Beautiful Villages stands classic models on the RMB Resource Pack's hills at the heights the author read off the
// pack's meshes; DFU stands them there (RMBLayout reads no terrain) on the pack's hill. The port's hill stand-ins were
// the catalogue's mounds (3, 6 or 10 m in radius, 0.6-3.5 m high), so Ipsham's TEMPASH3 (Menevia, location 110, cell
// 0,1 of Beautiful Villages' grid) stood its houses 4.1-4.2 m over hill 52758's mound, and the roadside taverns'
// TVRNAS03 (283 of the packs' grid cells) its gazebo 74088 2-2.6 m over 52025's. The hills are drawn at their measured
// polar profiles now (world/rmbrpHillShapes.js, tools/rmbrpHills.mjs --shapes). No game data for the first two pins:
// both blocks' misc records are carried whole in the vendored pack and built by the door's own converter, laid out by
// layoutRmbBlock, and the seat read off the triangles the pipeline builds (blockHillSeat, TREES-SEATED's).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import zlib from 'node:zlib';

import { ROW_CODECS } from '../../../src/formats/worldData/worldDataPack.js';
import { blockFromJson } from '../../../src/formats/worldData/worldDataReplacement.js';
import { layoutRmbBlock } from '../../../src/world/rmbLayout.js';
import { RMBRP_HILLS, RMBRP_PIECES, blockHillSeat, hillMesh } from '../../../src/world/townStandIns.js';
import { RMBRP_HILL_SHAPES, SHAPE_BEARINGS, SHAPE_RINGS } from '../../../src/world/rmbrpHillShapes.js';

const drawn = (id) => (RMBRP_HILLS[id] ? RMBRP_PIECES[id]() : null);

/** One of the pack's blocks as the door serves its misc records (fb1003b_trees.test.js's packBlocks). */
function packMisc(pack, name) {
  const [, , ops] = JSON.parse(pack.files[`${name}.json`]);
  const list = (key, codec) => {
    const op = ops.find((o) => o[0] === 's' && o[1].join('.') === `RmbBlock.${key}`);
    assert.ok(op && op[2][codec], `${name}: ${key} is carried whole`);
    return op[2][codec].map((row) => (Array.isArray(row) ? ROW_CODECS[codec](row) : row));
  };
  return blockFromJson({ Name: name, RmbBlock: { FldHeader: {}, SubRecords: [], Misc3dObjectRecords: list('Misc3dObjectRecords', '$m'), MiscFlatObjectRecords: list('MiscFlatObjectRecords', '$f') } }, 9100);
}

test('HILL-SHAPES: the stand-in is the measured profile - its centre at `top`, every ring vertex on its bearing at its share of the reach, the rim the mesh\'s base, every face up', () => {
  for (const [id, surface] of Object.entries(RMBRP_HILLS)) {
    const s = RMBRP_HILL_SHAPES[id];
    assert.ok(s, `${id}: measured`);
    assert.equal(s.reach.length, SHAPE_BEARINGS);
    assert.ok(s.rings.length === SHAPE_BEARINGS && s.rings.every((r) => r.length === SHAPE_RINGS), `${id}: ${SHAPE_BEARINGS} x ${SHAPE_RINGS}`);
    const rim = s.rings[0][SHAPE_RINGS - 1];
    assert.ok(s.rings.every((r) => r[SHAPE_RINGS - 1] === rim) && rim < 0, `${id}: one rim, under the block's plane`);
    const mesh = hillMesh(s, surface), p = mesh.positions, n = mesh.normals;
    const f = (x, y, z) => `${Math.fround(x)},${Math.fround(y)},${Math.fround(z)}`;   // the mesh's positions are 32-bit
    const want = new Set([f(s.c[0], s.top, s.c[1])]);
    for (let k = 0; k < SHAPE_BEARINGS; k++) for (let j = 1; j <= SHAPE_RINGS; j++) {
      const a = (k / SHAPE_BEARINGS) * Math.PI * 2, r = (s.reach[k] * j) / SHAPE_RINGS;
      want.add(f(s.c[0] + Math.cos(a) * r, s.rings[k][j - 1], s.c[1] + Math.sin(a) * r));
    }
    const got = new Set();
    for (let i = 0; i < p.length; i += 3) got.add(`${p[i]},${p[i + 1]},${p[i + 2]}`);
    assert.deepEqual([...got].sort(), [...want].sort(), `${id}: the profile's vertices, and no other`);
    for (let i = 1; i < n.length; i += 3) assert.ok(n[i] >= 0, `${id}: a face turned down`);
    assert.equal(mesh.indices.length / 3, SHAPE_BEARINGS * (2 * SHAPE_RINGS - 1), `${id}: a fan at the top, two triangles a cell out to the rim`);
  }
});

const ARENA2 = process.env.ARENA2_PATH;
const HAVE_ARENA2 = !!ARENA2 && ['MAPS.BSA', 'BLOCKS.BSA', 'ARCH3D.BSA', 'CLIMATE.PAK', 'POLITIC.PAK'].every((f) => existsSync(join(ARENA2, f)));
