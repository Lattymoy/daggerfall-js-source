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

import { ROW_CODECS } from '../src/formats/worldDataPack.js';
import { blockFromJson } from '../src/formats/worldDataReplacement.js';
import { layoutRmbBlock } from '../src/world/rmbLayout.js';
import { RMBRP_HILLS, RMBRP_PIECES, blockHillSeat, hillMesh } from '../src/world/townStandIns.js';
import { RMBRP_HILL_SHAPES, SHAPE_BEARINGS, SHAPE_RINGS } from '../src/world/rmbrpHillShapes.js';

const drawn = (id) => (RMBRP_HILLS[id] ? RMBRP_PIECES[id]() : null);
const PACK = () => JSON.parse(zlib.gunzipSync(readFileSync(new URL('../vendor/beautiful-villages/WorldDataPack/beautiful-villages.pack.json.gz', import.meta.url))).toString('utf8'));

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

test('HILL-SHAPES: the report - Ipsham\'s TEMPASH3 stands its props on hill 52758\'s plateau, 4.13 m up, and the drawn hill is there (it was the mound\'s 0.7-1.2 m)', () => {
  const { models } = layoutRmbBlock(packMisc(PACK(), 'TEMPASH3.RMB'));
  assert.ok(models.some((m) => m.modelIdNum === 52758), 'the hill the block stands on');
  const seat = blockHillSeat(models, drawn);
  const props = models.filter((m) => m.modelIdNum === 40014);
  assert.equal(props.length, 2);
  for (const m of props) {
    const [x, y, z] = [m.matrix[12], m.matrix[13], m.matrix[14]];
    assert.ok(Math.abs(y - 4.13) < 0.01, 'authored on the plateau');
    assert.ok(Math.abs(seat.topAt(x, z) - y) < 0.15, `40014 at (${x.toFixed(1)}, ${z.toFixed(1)}): the hill drawn under it at ${seat.topAt(x, z).toFixed(2)}, its foot ${y.toFixed(2)}`);
  }
});

test('HILL-SHAPES: the report - TVRNAS03\'s gazebo (74088, its stepped base\'s foot 5.2 m under its origin) stands with its base IN hill 52025, as the author buried it, not over a mound', () => {
  const { models } = layoutRmbBlock(packMisc(PACK(), 'TVRNAS03.RMB'));
  const seat = blockHillSeat(models, drawn);
  const g = models.find((m) => m.modelIdNum === 74088);
  assert.ok(g, 'the gazebo');
  const [x, y, z] = [g.matrix[12], g.matrix[13], g.matrix[14]];
  const foot = y - 5.2;   // measured on the player's ARCH3D: the base's lowest vertex, 5.2 m under the model's origin
  assert.ok(seat.topAt(x, z) > foot + 1, `the hill under the gazebo's middle (${seat.topAt(x, z).toFixed(2)}) is over its foot (${foot.toFixed(2)}): no gap`);
});

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

test('HILL-SHAPES with ARENA2: Ipsham itself - Beautiful Villages\' grid stands TEMPASH3, and its three houses and its temple (127, 129, 201, 402) stand on the drawn hill to within 0.15 m under the middle of their footprints (they hung 4.1-4.2 m)', { skip: HAVE_ARENA2 ? false : 'ARENA2_PATH not set', timeout: 120000 }, async () => {
  const rd = (f) => new Uint8Array(readFileSync(join(ARENA2, f)));
  const { MapsFile } = await import('../src/formats/mapsFile.js');
  const { BlocksFile } = await import('../src/formats/blocksFile.js');
  const { Arch3dFile } = await import('../src/formats/arch3dFile.js');
  const { dfMeshToModel } = await import('../src/world/meshReader.js');
  const WDR = await import('../src/formats/worldDataReplacement.js');
  const { openWorldDataPack } = await import('../src/formats/worldDataPack.js');
  const { setValue } = await import('../src/systems/settings.js');
  const maps = new MapsFile(); maps.load(rd('MAPS.BSA'), rd('CLIMATE.PAK'), rd('POLITIC.PAK'));
  const blocks = new BlocksFile(); blocks.load(rd('BLOCKS.BSA'));
  const arch = new Arch3dFile(); arch.load(rd('ARCH3D.BSA')); arch.autoDiscard = false;
  const quiet = console.log; console.log = () => {};
  try {
    WDR._resetWorldDataReplacement();
    setValue('Enhancements', 'AssetInjection', 'True');
    WDR.installWorldDataReplacement(); WDR.bindWorldDataBlocks(blocks);
    WDR.registerWorldDataPack(openWorldDataPack(PACK(), { blocks }), () => true, { priority: 10 });
    const ipsham = maps.getLocation(33, 110);
    assert.equal(ipsham.name, 'Ipsham');
    assert.equal(maps.getRmbBlockName(ipsham, 0, 1), 'TEMPASH3.RMB', 'Beautiful Villages\' grid');
    const { models } = layoutRmbBlock(blocks.getBlockByName('TEMPASH3.RMB'), { enhanced: true });
    const seat = blockHillSeat(models, drawn);
    for (const id of [127, 129, 201, 402]) {
      const m = models.find((q) => q.modelIdNum === id), M = m.matrix;
      const p = dfMeshToModel(arch.getMesh(arch.getRecordIndex(id)), () => ({ width: 64, height: 64 })).positions;
      const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
      for (let k = 0; k < p.length; k += 3) for (let a = 0; a < 3; a++) {
        const w = M[a] * p[k] + M[4 + a] * p[k + 1] + M[8 + a] * p[k + 2] + M[12 + a];
        lo[a] = Math.min(lo[a], w); hi[a] = Math.max(hi[a], w);
      }
      const gaps = [];
      for (let u = 0; u <= 4; u++) for (let v = 0; v <= 4; v++) gaps.push(lo[1] - (seat.topAt(lo[0] + (hi[0] - lo[0]) * (0.25 + u / 8), lo[2] + (hi[2] - lo[2]) * (0.25 + v / 8)) ?? 0));
      gaps.sort((a, b) => a - b);
      assert.ok(lo[1] > 4, `${id}: authored on the plateau (${lo[1].toFixed(2)})`);
      assert.ok(Math.abs(gaps[12]) < 0.15, `${id}: the median gap under its middle ${gaps[12].toFixed(2)} m`);
    }
  } finally {
    console.log = quiet;
    WDR._resetWorldDataReplacement();
  }
});

test('HILL-SHAPES with ARENA2: over every block of both packs that stands a hill, no classic model the author stood up on one hangs a metre over the drawn hill (AUDIT FB1005 T4: the record\'s whole-pack claim, pinned - five blocks\' did before, up to 7.55 m)', { skip: HAVE_ARENA2 ? false : 'ARENA2_PATH not set', timeout: 300000 }, async () => {
  const rd = (f) => new Uint8Array(readFileSync(join(ARENA2, f)));
  const { MapsFile } = await import('../src/formats/mapsFile.js');
  const { BlocksFile } = await import('../src/formats/blocksFile.js');
  const { Arch3dFile } = await import('../src/formats/arch3dFile.js');
  const { dfMeshToModel } = await import('../src/world/meshReader.js');
  const WDR = await import('../src/formats/worldDataReplacement.js');
  const { openWorldDataPack } = await import('../src/formats/worldDataPack.js');
  const { setValue } = await import('../src/systems/settings.js');
  const maps = new MapsFile(); maps.load(rd('MAPS.BSA'), rd('CLIMATE.PAK'), rd('POLITIC.PAK'));
  const blocks = new BlocksFile(); blocks.load(rd('BLOCKS.BSA'));
  const arch = new Arch3dFile(); arch.load(rd('ARCH3D.BSA')); arch.autoDiscard = false;
  const quiet = console.log; console.log = () => {};
  const hung = [];
  let blocksWithHills = 0, placed = 0;
  try {
    WDR._resetWorldDataReplacement();
    setValue('Enhancements', 'AssetInjection', 'True');
    WDR.installWorldDataReplacement(); WDR.bindWorldDataBlocks(blocks);
    const names = new Set();
    for (const [v, priority] of [['beautiful-villages', 10], ['beautiful-cities', 20]]) {
      const raw = JSON.parse(zlib.gunzipSync(readFileSync(new URL(`../vendor/${v}/WorldDataPack/${v}.pack.json.gz`, import.meta.url))).toString('utf8'));
      for (const n of Object.keys(raw.files)) if (n.endsWith('.RMB.json')) names.add(n.slice(0, -5));
      WDR.registerWorldDataPack(openWorldDataPack(raw, { blocks }), () => true, { priority });
    }
    for (let r = 0; r < maps.regionCount; r++) {   // the packs' new blocks are named by the towns that stand them
      for (let l = 0; l < (maps.baseLocationCount(r) ?? 0); l++) {
        const loc = maps.getLocation(r, l), ex = loc?.exterior?.exteriorData;
        if (ex) for (let y = 0; y < ex.height; y++) for (let x = 0; x < ex.width; x++) blocks.checkName(maps.getRmbBlockName(loc, x, y));
      }
    }
    const models = new Map();
    const positions = (id) => { if (!models.has(id)) { const i = arch.getRecordIndex(id); models.set(id, i < 0 ? null : dfMeshToModel(arch.getMesh(i), () => ({ width: 64, height: 64 })).positions); } return models.get(id); };
    for (const name of [...names].sort()) {
      let b = null;
      try { b = blocks.getBlockByName(name); } catch { b = null; }
      if (!b?.rmbBlock) continue;
      const { models: laid } = layoutRmbBlock(b, { enhanced: true });
      const seat = blockHillSeat(laid, drawn);
      if (!seat) continue;
      blocksWithHills++;
      for (const m of laid) {
        if (RMBRP_HILLS[m.modelIdNum]) continue;
        const p = positions(m.modelIdNum);
        if (!p) continue;
        const M = m.matrix, lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
        for (let k = 0; k < p.length; k += 3) for (let a = 0; a < 3; a++) { const w = M[a] * p[k] + M[4 + a] * p[k + 1] + M[8 + a] * p[k + 2] + M[12 + a]; lo[a] = Math.min(lo[a], w); hi[a] = Math.max(hi[a], w); }
        const mid = [(lo[0] + hi[0]) / 2, (lo[2] + hi[2]) / 2];
        if (lo[1] < 0.5 || seat.topAt(mid[0], mid[1]) === null) continue;   // on the plane, or on no hill
        placed++;
        const gaps = [];
        for (let u = 0; u <= 4; u++) for (let v = 0; v <= 4; v++) gaps.push(lo[1] - Math.max(0, seat.topAt(lo[0] + (hi[0] - lo[0]) * (0.25 + u / 8), lo[2] + (hi[2] - lo[2]) * (0.25 + v / 8)) ?? 0));
        gaps.sort((a, b2) => a - b2);
        if (gaps[12] > 1) hung.push(`${name} ${m.modelIdNum} ${gaps[12].toFixed(2)} m`);
      }
    }
  } finally {
    console.log = quiet;
    WDR._resetWorldDataReplacement();
  }
  assert.ok(blocksWithHills >= 20 && placed > 20, `${blocksWithHills} blocks stand hills, ${placed} models up on them`);
  assert.deepEqual(hung, [], 'none hangs');
});
