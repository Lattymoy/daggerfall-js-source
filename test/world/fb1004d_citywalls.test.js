// CITY-WALLS (FIELD BUGS 2026-10-04d, the Discord, 2026-10-03 23:09 UTC - before CITY-WALL merged: "small chunks of
// walls seem to be missing in some cities ... The missing walls have farms in them which should obviously be outside
// the walls. I was stuck inside invisible walls after investigating the hole in the wall"; "yeah just found some in
// ilessian hills"; "Aye finding them throughout Daggerfall as well"). The question handed over: is EVERY gap in every
// city's walls closed now (FIELD BUGS 2026-10-03c CITY-WALL stood the RMB Resource Pack's corner piece 53210 in), or do
// others remain? Measured here over the vendored pack, through the producers the hosts run (blockFromJson,
// layoutRmbBlock) and the stand-in's own law (CITY_WALL_FILL):
//   - every wall line of every one of Beautiful Cities' wall blocks (the 12 plain and the 388 composites with a wall) is
//     covered from block edge to block edge, or from its corner to the edge;
//   - every city's ring closes - the 374 cities whose grid the pack names whole close at exactly one width, the grid's
//     own; the other 36 keep cells of Daggerfall's own (a location file that sets only some names), and every one of
//     their 198 open ends lies against such a cell - MAPS.BSA names it (a classic wall block there closes it);
//   - and the farm half of a composite stands where its own farm block stands it: the nearest farm model's origin (a
//     building's or a misc piece's, the crop batches aside) is 171 units off a wall piece's line - a fence (518) six
//     composites lay along their wall, inside its outer face (a wall is 192 units each side of its line).
// Corners: the tower (444) stands 64 units in from where its two lines cross and reaches 448 units along each (CITY-WALL,
// read off Daggerfall's own corners, whose walls begin at the block's edge there). The 476 subrecords read by reference
// from WALLAA04's own first one ($c) stand as every one of the author's own copies of it stands - a 445 at (0, 0, -64),
// unturned, which the pack's edits of it never touch (they insert flats).
// With the player's ARENA2 (ARENA2_PATH) all of that is read, not assumed - and the "invisible walls" are found: a
// segment (445), a gate (446, 447) and the tower's two arms are a CORRIDOR, two long faces 384 units apart and a walk on
// top, open at both ends below the walk (the next piece's open end is what shuts it). A hole in a ring - the corner
// CITY-WALL shut - is a way INTO the wall, where every face is seen from behind: the renderer culls it (render/
// renderer.js, CULL_FACE BACK) and the collider, which reads no winding (player/collider.js), still holds the player -
// walls that stop you and do not draw, the only way out a hole like the one you came in by. Shut now: every open end
// of every piece of all 410 rings meets the next piece's, the stand-in's included (the 445's middle, the corridor
// running through it).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import zlib from 'node:zlib';

import { ROW_CODECS } from '../../src/formats/worldData/worldDataPack.js';
import { blockFromJson } from '../../src/formats/worldData/worldDataReplacement.js';
import { layoutRmbBlock } from '../../src/world/rmbLayout.js';
import { CITY_WALL_PIECE, CITY_WALL_MODEL, CITY_WALL_FILL } from '../../src/world/townStandIns.js';
import { GLOBAL_SCALE } from '../../src/world/meshReader.js';

const pack = JSON.parse(zlib.gunzipSync(readFileSync(new URL('../../vendor/beautiful-cities/WorldDataPack/beautiful-cities.pack.json.gz', import.meta.url))).toString('utf8'));
const P = (v) => (typeof v === 'string' ? JSON.parse(v) : v);
const nodes = pack.nodes.map(P);
const TOWER = 444, GATE = 446, SEGMENT = CITY_WALL_MODEL, HALF = 512;   // a segment (and a gate) is 1024 units, its middle on its origin
const TOWER_IN = 64, TOWER_REACH = 448;
const WALLAA04 = Object.keys(pack.classicNames).find((i) => pack.classicNames[i] === 'WALLAA04.RMB');
const BY_REFERENCE = { ModelId: String(SEGMENT), ModelIdNum: SEGMENT, ObjectType: 4, XPos: 0, YPos: 0, ZPos: -64, XRotation: 0, YRotation: 0, ZRotation: 0 };
let byReference = 0;
const unread = new Set();   // the classic buildings a farm reads by reference - their models are Daggerfall's own

/** A value of the pack with its nodes and rows read; WALLAA04's first subrecord's exterior, read by reference, stood as
 *  the author's own copies stand it (counted). */
function expand(v) {
  if (Array.isArray(v)) return v.map(expand);
  if (!v || typeof v !== 'object') return v;
  const keys = Object.keys(v);
  if (v.$c) {
    if (String(v.$c[0]) !== WALLAA04 || JSON.stringify(v.$c[1]) !== '["RmbBlock","SubRecords",0,"Exterior"]') { unread.add(JSON.stringify(v.$c)); return EMPTY(); }   // a farm's classic building: ARCH3D's, not a wall
    assert.ok(!v.$o || v.$o.every((op) => op[0] === 'i' && op[1][0] === 'BlockFlatObjectRecords'), 'its edits insert flats, never a model');
    byReference++;
    return { ...EMPTY(), Block3dObjectRecords: [BY_REFERENCE] };
  }
  if (v.$n !== undefined) return expand(nodes[v.$n]);
  const k = keys.find((key) => ROW_CODECS[key]);
  if (k) return v[k].map((row) => (Array.isArray(row) || typeof row === 'number' ? ROW_CODECS[k](row) : expand(row)));
  return Object.fromEntries(keys.map((key) => [key, expand(v[key])]));
}
/** A list as the file has it: the nearest whole one down its chain of bases, with every file's edits of it laid on in
 *  turn (a composite inserts its wall's entry into its farm's building list), or null where it is Daggerfall's own. */
function listOf(name, key, read = expand, readOne = expand) {
  const [, base, ops] = P(pack.files[`${name}.json`]);
  let list = null;
  const at = ops.findLastIndex((o) => o[0] === 's' && o[1].join('.') === key);
  if (at >= 0) list = read(ops[at][2]);
  else if (base[0] === 'f') list = listOf(base[1].replace('.json', ''), key, read, readOne);
  if (!list) return null;
  const k = key.split('.').length;
  for (const op of ops.slice(at + 1)) {
    const p = op[1];
    if (p.slice(0, k).join('.') !== key || p.length === k) continue;
    if (op[0] === 'i' && p.length === k + 1) list.splice(p[k], 0, readOne(op[2]));
    else if (op[0] === 'r' && p.length === k + 1) list.splice(p[k], 1);
    else if (op[0] === 's' && p.length === k + 1) list[p[k]] = readOne(op[2]);
    else if (op[0] === 's' && p.length > k + 1 && read === expand) { let o = list; for (const q of p.slice(k, -1)) o = o[q]; o[p[p.length - 1]] = expand(op[2]); }
    else assert.fail(`${name}: an edit of ${key} this reading does not lay (${op[0]} ${p.join('.')})`);
  }
  return list;
}
const EMPTY = () => ({ Header: {}, Block3dObjectRecords: [], BlockFlatObjectRecords: [], BlockSection3Records: [], BlockPeopleRecords: [], BlockDoorRecords: [] });
/** The subrecords as the exterior hosts lay them: each one's place and its exterior (its interior is a building's). */
const subrecords = (list) => list.map((ref) => {
  const sr = ref.$n !== undefined ? nodes[ref.$n] : ref;
  return { XPos: sr.XPos, ZPos: sr.ZPos, YRotation: sr.YRotation, Exterior: expand(sr.Exterior), Interior: EMPTY() };
});

/** A block's wall: its pieces as spans on axis-aligned lines in the block's frame (classic units), and its farm's models. */
const walls = new Map();
function wallOf(name) {
  if (walls.has(name)) return walls.get(name);
  let w = null;
  if (pack.files[`${name}.json`]) {
    const subs = listOf(name, 'RmbBlock.SubRecords', subrecords, (v) => subrecords([v])[0]);
    const types = (listOf(name, 'RmbBlock.FldHeader.BuildingDataList') ?? []).map((b) => b?.BuildingType);
    const block = blockFromJson({ Name: name, RmbBlock: { FldHeader: {}, SubRecords: subs ?? [], Misc3dObjectRecords: listOf(name, 'RmbBlock.Misc3dObjectRecords') ?? [], MiscFlatObjectRecords: [] } }, 9300);
    const { models } = layoutRmbBlock(block);
    const u = (v) => Math.round((v / GLOBAL_SCALE) * 1000) / 1000;
    const spans = [], farm = [];
    const span = (m, x0, x1, z) => {   // the piece's local run x0..x1 on its local line z, classic units
      const at = (x) => [u(m[0] * x * GLOBAL_SCALE + m[8] * z * GLOBAL_SCALE + m[12]), u(m[2] * x * GLOBAL_SCALE + m[10] * z * GLOBAL_SCALE + m[14])];
      const [p, q] = [at(x0), at(x1)];
      if (p[1] === q[1]) return { axis: 'x', c: p[1], a: Math.min(p[0], q[0]), b: Math.max(p[0], q[0]) };
      assert.equal(p[0], q[0], `${name}: a wall piece on an axis`);
      return { axis: 'z', c: p[0], a: Math.min(p[1], q[1]), b: Math.max(p[1], q[1]) };
    };
    for (const placed of models) {
      const m = placed.matrix, id = placed.modelIdNum;
      if (id === SEGMENT || id === GATE) spans.push(span(m, -HALF, HALF, 0));
      else if (id === CITY_WALL_PIECE) spans.push(span(m, CITY_WALL_FILL.x - CITY_WALL_FILL.length / 2, CITY_WALL_FILL.x + CITY_WALL_FILL.length / 2, CITY_WALL_FILL.z));
      else if (id === TOWER) {
        const [tx, tz] = [u(placed.recordAt[0]), u(placed.recordAt[2])];
        const cx = Math.abs(tx - 448) < Math.abs(tx - 3648) ? 448 : 3648, cz = Math.abs(tz - 448) < Math.abs(tz - 3648) ? 448 : 3648;
        assert.deepEqual([Math.abs(tx - cx), Math.abs(tz - cz)], [TOWER_IN, TOWER_IN], `${name}: the tower 64 units in from its crossing`);
        const dx = Math.sign(tx - cx), dz = Math.sign(tz - cz);
        spans.push({ axis: 'x', c: cz, a: Math.min(cx, cx + TOWER_REACH * dx), b: Math.max(cx, cx + TOWER_REACH * dx) });
        spans.push({ axis: 'z', c: cx, a: Math.min(cz, cz + TOWER_REACH * dz), b: Math.max(cz, cz + TOWER_REACH * dz) });
      } else if (id < 53211 || id > 53214) {
        const t = placed.recordIndex === undefined ? 'misc' : types[placed.recordIndex];
        if (t !== 23 && t !== 'Town23') farm.push({ id, at: [u(m[12]), u(m[14])], name });
      }
    }
    if (name.split('.').length > 2) assert.equal(types.length, (subs ?? []).length, `${name}: a building entry for every subrecord`);   // a composite
    w = spans.length ? { spans, farm } : null;
  }
  walls.set(name, w);
  return w;
}

const union = (iv) => {
  const out = [];
  for (const [a, b] of [...iv].sort((p, q) => p[0] - q[0])) {
    if (out.length && a <= out[out.length - 1][1] + 1e-3) out[out.length - 1][1] = Math.max(out[out.length - 1][1], b);
    else out.push([a, b]);
  }
  return out;
};
/** A grid's ring at a width: its lines' covered runs, and every run's end no other line meets. */
function ringOf(names, width) {
  const lines = new Map();
  names.forEach((nm, i) => {
    const w = nm ? wallOf(nm) : null;
    if (!w) return;
    const bx = (i % width) * 4096, bz = Math.floor(i / width) * 4096;
    for (const s of w.spans) {
      const k = `${s.axis}${s.c + (s.axis === 'x' ? bz : bx)}`, o = s.axis === 'x' ? bx : bz;
      if (!lines.has(k)) lines.set(k, []);
      lines.get(k).push([s.a + o, s.b + o]);
    }
  });
  const runs = [...lines].map(([k, iv]) => ({ axis: k[0], c: Number(k.slice(1)), iv: union(iv) }));
  const meets = (axis, c, p) => runs.some((r) => r.axis === axis && Math.abs(r.c - c) < 1e-3 && r.iv.some(([a, b]) => p >= a - 1e-3 && p <= b + 1e-3));
  const free = [];
  for (const r of runs) for (const [a, b] of r.iv) for (const e of [a, b]) if (!meets(r.axis === 'x' ? 'z' : 'x', e, r.c)) free.push(r.axis === 'x' ? [e, r.c] : [r.c, e]);
  return free;
}
function cities() {
  const out = [];
  for (const [file, entry] of Object.entries(pack.files)) {
    if (!file.startsWith('location-')) continue;
    const [, base, ops] = P(entry);
    let names = null, width = null, whole = true;
    for (const op of ops) {
      const p = op[1].join('.');
      if (p === 'Exterior.ExteriorData.BlockNames' && op[0] === 's') names = op[2];
      if (p === 'Exterior.ExteriorData.Width' && op[0] === 's') width = op[2];
      if (p === 'Exterior.ExteriorData.BlockNames' && op[0] === 'sr') {
        whole = false; names = [];
        for (let i = 0; i < op[2].length; i += 2) op[2][i + 1].forEach((n, k) => { names[op[2][i] + k] = n; });
      }
    }
    out.push({ name: base[3], names: Array.from(names, (n) => n ?? null), width, whole });
  }
  return out;
}

test('CITY-WALLS the blocks: every wall line of every wall block of Beautiful Cities is covered edge to edge (a corner\'s from its crossing); the author\'s own segments and gates stand at (0, 0, -64), the towers at (48, 0, -50)', () => {
  const blocks = Object.keys(pack.files).filter((n) => /^WALLAA\d\d(\..+)?\.RMB\.json$/.test(n)).map((n) => n.replace('.json', ''));
  let lines = 0, covered = 0;
  for (const name of blocks) {
    const w = wallOf(name);
    assert.ok(w, `${name}: stands a wall`);
    const byLine = new Map();
    for (const s of w.spans) { const k = `${s.axis}${s.c}`; if (!byLine.has(k)) byLine.set(k, []); byLine.get(k).push([s.a, s.b]); }
    for (const [k, iv] of byLine) {
      lines++;
      const run = union(iv);
      const ends = run.flatMap(([a, b]) => [a, b]);
      assert.equal(run.length, 1, `${name} line ${k}: one run, no hole (${JSON.stringify(run)})`);
      assert.ok(ends.every((e) => [0, 4096, 448, 3648].includes(e)), `${name} line ${k}: from an edge or a crossing to an edge (${ends})`);
      assert.ok(ends.includes(0) || ends.includes(4096), `${name} line ${k}: reaches the block's edge`);
      covered++;
    }
  }
  assert.deepEqual([blocks.length, lines, covered], [400, 628, 628]);
  assert.equal(byReference, 476, 'the segments read from WALLAA04 by reference');
  // the author's own copies, the law the 476 are stood by
  for (const n of nodes) {
    for (const row of n?.Block3dObjectRecords?.$m ?? []) {
      if (row[0] === SEGMENT || row[0] === GATE) assert.deepEqual(row.slice(2, 8), [0, 0, -64, 0, 0, 0], 'a segment or a gate on its subrecord\'s line, unturned');
      if (row[0] === TOWER) assert.deepEqual(row.slice(2, 8), [48, 0, -50, 0, 0, 0], 'a corner tower');
    }
  }
});

test('CITY-WALLS the rings: every city\'s ring closes - 374 at exactly one width, the grid\'s own; the 36 that keep cells of Daggerfall\'s own are open only against those cells (198 ends) - and the corner piece is what closes them (mutants: the stand-in\'s law)', () => {
  let closed = 0, against = 0, partial = 0;
  for (const c of cities()) {
    const n = c.names.length;
    const widths = [];
    for (let w = 1; w <= 8; w++) {
      if (c.width && w !== c.width) continue;
      if (c.whole ? n % w || n / w > 8 : Math.ceil(n / w) > 8) continue;
      widths.push([w, ringOf(c.names, w)]);
    }
    widths.sort((p, q) => p[1].length - q[1].length);
    const [[w, free], second] = widths;
    if (!free.length) {
      closed++;
      assert.ok(!second || second[1].length > 0, `${c.name}: closes at one width only`);
      continue;
    }
    partial++;
    for (const [x, z] of free) {
      const cells = [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]].map(([dx, dz]) => [Math.floor((x + dx) / 4096), Math.floor((z + dz) / 4096)]);
      assert.ok(cells.some(([cx, cz]) => cx >= 0 && cx < w && cz >= 0 && !c.names[cz * w + cx]), `${c.name}: an open end at (${x}, ${z}) against no cell of Daggerfall's own`);
      against++;
    }
  }
  assert.deepEqual([closed, partial, against], [374, 36, 198]);
});

test('CITY-WALLS the farms: no model of a composite\'s farm half - a building, a fence, a rock, a chimney, the crop batches aside - has its origin within 171 units of a wall piece\'s line; the nearest, a fence (518) six composites lay along their wall 171 units off its line, inside its outer face (how far the farms\' meshes reach in is read with ARENA2, below)', () => {
  let nearest = Infinity;
  const at = new Set();
  let farms = 0;
  for (const name of Object.keys(pack.files).filter((n) => /^WALLAA\d\d\..+\.RMB\.json$/.test(n)).map((n) => n.replace('.json', ''))) {
    const w = wallOf(name);
    for (const f of w.farm) {
      farms++;
      let d = Infinity;
      for (const s of w.spans) {
        const [along, across] = s.axis === 'x' ? f.at : [f.at[1], f.at[0]];
        d = Math.min(d, Math.hypot(along - Math.max(s.a, Math.min(s.b, along)), across - s.c));
      }
      if (d < nearest - 1e-6) { nearest = d; at.clear(); }
      if (Math.abs(d - nearest) < 1e-6) at.add(`${f.name} ${f.id}`);
    }
  }
  assert.ok(farms > 2000, `${farms} farm models`);
  assert.equal(Math.round(nearest), 171);
  assert.deepEqual([...at].sort(), ['WALLAA06.FARMAA00.RMB 518', 'WALLAA06.FARMBA00.RMB 518', 'WALLAA12.FARMAA00.RMB 518', 'WALLAA12.FARMBA00.RMB 518', 'WALLAA13.FARMAA00.RMB 518', 'WALLAA13.FARMBA00.RMB 518']);
});

// ---- with the player's ARENA2: the pieces as Daggerfall draws them, and every ring as the game lays it out ------------
const ARENA2 = process.env.ARENA2_PATH;
const HAVE_ARENA2 = !!ARENA2 && ['BLOCKS.BSA', 'MAPS.BSA', 'ARCH3D.BSA', 'CLIMATE.PAK', 'POLITIC.PAK'].every((f) => existsSync(join(ARENA2, f)));
const WALKWAY = 258;   // the walk along a wall's top, classic units: below it a piece is its two long faces and air
const ACROSS = 192;    // a wall piece's two long faces, each side of its line
const BODY = 192;      // the tower's body, 384 square on its crossing; its arms run on beyond it

test('CITY-WALLS with ARENA2: the wall is a corridor - ARCH3D\'s segment and gates 1024 x 384 x 434, open at both ends below the walk, the segment nothing below it but its two long faces; Daggerfall\'s own corner towers reach 448 along each line from the crossing, their arms the same two faces, nothing on their ends; WALLAA04\'s first subrecord (the 476 read by reference) a 445 at (0, 0, -64); through the port\'s door all 410 rings shut, every open end met - the 1,266 corner pieces\' among them, each the 445\'s middle (384 x 322); no farm mesh more than 50 units into a wall', { skip: HAVE_ARENA2 ? false : 'ARENA2_PATH not set' }, async () => {
  const W = await import('../../src/formats/worldData/worldDataReplacement.js');
  const { _resetLayoutPins } = await import('../../src/systems/layoutPins.js');
  const { setValue } = await import('../../src/systems/settings/settings.js');
  const { BlocksFile } = await import('../../src/formats/blocksFile.js');
  const { MapsFile } = await import('../../src/formats/mapsFile.js');
  const { Arch3dFile } = await import('../../src/formats/arch3dFile.js');
  const { openWorldDataPack } = await import('../../src/formats/worldData/worldDataPack.js');
  const { dfMeshToModel } = await import('../../src/world/meshReader.js');
  const { layoutLocation } = await import('../../src/world/locationLayout.js');
  const { installTownStandIns, _resetTownStandIns } = await import('../../src/world/townStandIns.js');
  const { customModelFor, classicModelIdOf, hasCustomModel, _resetCustomModels } = await import('../../src/world/customModels.js');
  const bytes = (f) => new Uint8Array(readFileSync(join(ARENA2, f)));
  const blocks = new BlocksFile(); assert.ok(blocks.load(bytes('BLOCKS.BSA')));
  const arch = new Arch3dFile(); assert.ok(arch.load(bytes('ARCH3D.BSA')));
  const meshes = new Map();
  const classicModel = (id) => {
    if (!meshes.has(id)) { const i = arch.getRecordIndex(id); meshes.set(id, i < 0 ? null : dfMeshToModel(arch.getMesh(i), () => ({ width: 64, height: 64 }))); }
    return meshes.get(id);
  };
  const u = (v) => Math.round((v / GLOBAL_SCALE) * 100) / 100 + 0;   // classic units to the hundredth (float32 metres), never -0
  /** A mesh's faces, three points each in classic units - placed by M (a block's frame) when it is given. */
  const tris = (m, M = null) => {
    const out = [];
    for (let t = 0; t < m.indices.length; t += 3) {
      out.push([0, 1, 2].map((k) => {
        const i = m.indices[t + k] * 3, p = [m.positions[i], m.positions[i + 1], m.positions[i + 2]];
        return M ? [0, 1, 2].map((c) => u(M[c] * p[0] + M[4 + c] * p[1] + M[8 + c] * p[2] + M[12 + c])) : p.map(u);
      }));
    }
    return out;
  };
  const boxOf = (pts) => [[0, 1, 2].map((k) => Math.min(...pts.map((p) => p[k]))), [0, 1, 2].map((k) => Math.max(...pts.map((p) => p[k])))];
  /** A face's area seen down an axis: one lying across the axis has some, a fan's sliver along an edge none. */
  const areaDown = (t, k) => { const [a, b] = [0, 1, 2].filter((c) => c !== k); return Math.abs((t[1][a] - t[0][a]) * (t[2][b] - t[0][b]) - (t[2][a] - t[0][a]) * (t[1][b] - t[0][b])) / 2; };

  // the pieces: the segment and the gates, open at both ends below the walk - the segment, below it, its two long faces
  for (const id of [SEGMENT, GATE, 447]) {
    const T = tris(classicModel(id));
    assert.deepEqual(boxOf(T.flat()), [[-HALF, 0, -ACROSS], [HALF, 434, ACROSS]], `${id}: 1024 x 434 x 384 on its origin`);
    const ends = T.filter((t) => t.every((p) => Math.abs(p[0]) === HALF) && areaDown(t, 0) > 0);
    assert.ok(ends.length && ends.every((t) => t.every((p) => p[1] >= WALKWAY)), `${id}: its ends shut above the walk, open below it`);
  }
  const below = tris(classicModel(SEGMENT)).filter((t) => t.some((p) => p[1] < WALKWAY));
  assert.ok(below.length && below.every((t) => t.every((p) => Math.abs(p[2]) === ACROSS)), 'the segment below its walk: two long faces, nothing between');
  // what the 476 read by reference: WALLAA04's first subrecord as BLOCKS.BSA holds it (past the door)
  const w04 = blocks.readClassicBlock(blocks.getBlockIndex('WALLAA04.RMB')).rmbBlock.subRecords[0].exterior.block3dObjectRecords;
  const R = BY_REFERENCE;
  assert.deepEqual(w04.map((o) => [o.modelIdNum, o.objectType, o.xPos, o.yPos, o.zPos, o.xRotation, o.yRotation, o.zRotation]), [[R.ModelIdNum, R.ObjectType, R.XPos, R.YPos, R.ZPos, R.XRotation, R.YRotation, R.ZRotation]]);
  // Daggerfall's own corners: the tower 64 in from its crossing, reaching 448 along each line and no further; below the
  // walk each arm is two long faces 384 apart, as a segment, and nothing stands on its end - the corridor runs on
  for (const name of ['WALLAA00.RMB', 'WALLAA01.RMB', 'WALLAA02.RMB', 'WALLAA03.RMB']) {
    const tower = layoutRmbBlock(blocks.readClassicBlock(blocks.getBlockIndex(name))).models.find((p) => p.modelIdNum === TOWER);
    const T = tris(classicModel(TOWER), tower.matrix);
    const [tx, tz] = [u(tower.recordAt[0]), u(tower.recordAt[2])];
    const cx = Math.abs(tx - 448) < Math.abs(tx - 3648) ? 448 : 3648, cz = Math.abs(tz - 448) < Math.abs(tz - 3648) ? 448 : 3648;
    assert.deepEqual([Math.abs(tx - cx), Math.abs(tz - cz)], [TOWER_IN, TOWER_IN], `${name}: the tower 64 units in from its crossing`);
    for (const [k, c, d, kk, cc] of [[0, cx, Math.sign(tx - cx), 2, cz], [2, cz, Math.sign(tz - cz), 0, cx]]) {
      const along = (p) => (p[k] - c) * d;
      assert.equal(Math.max(...T.flat().map(along)), TOWER_REACH, `${name}: the arm reaches 448 from the crossing, no further`);
      assert.equal(T.filter((t) => t.every((p) => along(p) === TOWER_REACH) && areaDown(t, k) > 0).length, 0, `${name}: nothing on the arm's end`);
      const arm = T.filter((t) => t.some((p) => p[1] < WALKWAY) && t.every((p) => along(p) >= BODY) && !t.every((p) => along(p) === BODY));
      assert.ok(arm.length && arm.every((t) => t.every((p) => Math.abs(p[kk] - cc) === ACROSS)), `${name}: the arm below the walk, two long faces`);
      assert.deepEqual([...new Set(arm.flat().map((p) => p[kk] - cc))].sort((a, b) => a - b), [-ACROSS, ACROSS], `${name}: 384 apart`);
    }
  }

  // every ring as the game lays it out: the port's door over the player's MAPS.BSA and BLOCKS.BSA, both packs served
  const log = console.log;
  try {
    W._resetWorldDataReplacement(); _resetLayoutPins(); _resetCustomModels(); _resetTownStandIns();
    setValue('Enhancements', 'AssetInjection', 'True');
    W.installWorldDataReplacement(); W.bindWorldDataBlocks(blocks);
    let cities = null;
    for (const [v, priority] of [['beautiful-villages', 10], ['beautiful-cities', 20]]) {
      const p = openWorldDataPack(JSON.parse(zlib.gunzipSync(readFileSync(new URL(`../../vendor/${v}/WorldDataPack/${v}.pack.json.gz`, import.meta.url))).toString('utf8')), { blocks });
      W.registerWorldDataPack(p, () => true, { priority });
      if (v === 'beautiful-cities') cities = p;
    }
    W.latchWorldDataDoor(); W.quietLocationOverrides(true);
    const maps = new MapsFile(); assert.ok(maps.load(bytes('MAPS.BSA'), bytes('CLIMATE.PAK'), bytes('POLITIC.PAK')));
    installTownStandIns(() => true);
    const meshOf = (id) => (hasCustomModel(id) ? customModelFor(id, { classicModel }) : classicModel(classicModelIdOf(id)));
    const PIECES = new Set([TOWER, SEGMENT, GATE, 447, CITY_WALL_PIECE]);
    console.log = () => {};   // the door names every block it serves
    let rings = 0, shut = 0, fills = 0;
    const open = [], badFill = [];
    for (const file of cities.names()) {
      const key = file.match(/^location-(\d+)-(\d+)\.json$/);
      if (!key) continue;
      const loc = maps.getLocation(Number(key[1]), Number(key[2]));
      const pieces = [];
      for (const b of layoutLocation(loc, maps, blocks).blocks) {
        for (const p of b.layout.models) {
          if (!PIECES.has(p.modelIdNum)) continue;
          const [lo, hi] = boxOf(tris(meshOf(p.modelIdNum), p.matrix).flat());
          const ox = b.x * 4096, oz = b.y * 4096;
          pieces.push({ id: p.modelIdNum, lo: [lo[0] + ox, lo[1], lo[2] + oz], hi: [hi[0] + ox, hi[1], hi[2] + oz], k: Math.abs(p.matrix[0]) > Math.abs(p.matrix[2]) ? 0 : 2, at: b.blockName });
        }
      }
      rings++;
      const met = (x, z, not) => pieces.some((q) => q !== not && x >= q.lo[0] && x <= q.hi[0] && z >= q.lo[2] && z <= q.hi[2]);
      let free = 0;
      for (const p of pieces) {
        if (p.id === TOWER) continue;   // its arms' ends: met by the pieces on its lines, as Daggerfall's corners show above
        const { k } = p, kk = 2 - k, mid = (p.lo[kk] + p.hi[kk]) / 2;
        for (const [e, s] of [[p.lo[k], -1], [p.hi[k], 1]]) {   // two units past each end, on its line
          const pt = []; pt[k] = e + 2 * s; pt[kk] = mid;
          if (!met(pt[0], pt[2], p)) { free++; open.push(`${loc.name} ${p.at} ${p.id}`); }
        }
        if (p.id === CITY_WALL_PIECE) {
          fills++;
          if (p.hi[kk] - p.lo[kk] !== 2 * ACROSS || p.lo[1] !== 0 || p.hi[1] !== 322) badFill.push(`${loc.name} ${p.at}`);
        }
      }
      if (!free) shut++;
    }
    console.log = log;
    assert.deepEqual([rings, shut, open.length], [410, 410, 0], open.slice(0, 5).join('; '));
    assert.deepEqual([fills, badFill.length], [1266, 0], badFill.slice(0, 5).join('; '));

    // the farm halves (the author's farm blocks laid beside his walls): how far their meshes reach into a segment, a gate
    // or a corner piece, across its line - a house's corner, a fence, a pen, a chimney; the deepest the house (215) of
    // WALLAA06/12/13.FARMAA01, 50 units in. Daggerfall Unity stands every one the same (the same law, the same pack)
    const local = (M, q) => { const d = [0, 1, 2].map((c) => q[c] * GLOBAL_SCALE - M[12 + c]); return [0, 1, 2].map((r) => u(M[4 * r] * d[0] + M[4 * r + 1] * d[1] + M[4 * r + 2] * d[2])); };
    const overlap = (a, b) => [0, 1, 2].every((c) => a[0][c] < b[1][c] && b[0][c] < a[1][c]);
    let deepest = 0, farms = 0;
    const deep = new Map();
    console.log = () => {};
    for (const file of cities.names()) {
      if (!/^WALLAA\d\d\..+\.RMB\.json$/.test(file)) continue;
      const name = file.replace('.json', '');
      const dfBlock = W.getDFBlockReplacementData(blocks.getBlockIndex(name), name);   // the door's own read (BlocksFile.getBlock's)
      const types = dfBlock.rmbBlock.fldHeader.buildingDataList.map((bd) => bd.buildingType);
      const { models } = layoutRmbBlock(dfBlock);
      const walls = models.filter((p) => p.modelIdNum !== TOWER && PIECES.has(p.modelIdNum)).map((p) => ({ M: p.matrix, own: boxOf(tris(meshOf(p.modelIdNum)).flat()), placed: boxOf(tris(meshOf(p.modelIdNum), p.matrix).flat()) }));
      for (const p of models) {
        if (PIECES.has(p.modelIdNum) || (p.recordIndex !== undefined && types[p.recordIndex] === 23)) continue;   // the wall's own (Town23)
        const mesh = meshOf(p.modelIdNum);
        if (!mesh) continue;
        farms++;
        const T = tris(mesh, p.matrix), box = boxOf(T.flat());
        for (const w of walls) {
          if (!overlap(box, w.placed)) continue;
          for (const t of T) {
            for (let i = 0; i <= 8; i++) {
              for (let j = 0; j <= 8 - i; j++) {
                const q = local(w.M, [0, 1, 2].map((c) => ((8 - i - j) * t[0][c] + i * t[1][c] + j * t[2][c]) / 8));
                const [lo, hi] = w.own;
                if (![0, 1, 2].every((c) => q[c] > lo[c] && q[c] < hi[c])) continue;
                const depth = Math.min(q[2] - lo[2], hi[2] - q[2]), at = `${name} ${p.modelIdNum}`;
                deepest = Math.max(deepest, depth);
                deep.set(at, Math.max(deep.get(at) ?? 0, depth));
              }
            }
          }
        }
      }
    }
    console.log = log;
    assert.ok(farms > 2000, `${farms} farm models`);
    assert.equal(Math.round(deepest), 50);
    assert.deepEqual([...deep].filter(([, d]) => d > deepest - 1).map(([at]) => at).sort(), ['WALLAA06.FARMAA01.RMB 215', 'WALLAA12.FARMAA01.RMB 215', 'WALLAA13.FARMAA01.RMB 215']);
  } finally {
    console.log = log;
    W._resetWorldDataReplacement(); _resetLayoutPins(); _resetCustomModels(); _resetTownStandIns();
  }
});
