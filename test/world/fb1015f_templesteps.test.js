// FIELD BUGS 2026-10-15f TEMPLE-STEPS (Discord, 2026-10-11: "The entrance to The School of Julianos in Makehda is blocked.
// Seen this same problem before with another temple but forgot where." - a night screenshot of a temple behind a great
// dark stone wall, a pale stair crossing in front of it; 2026-10-13: "The Akatosh Chantry in Merdale also has some small
// issues").
//
// Makehda lays Beautiful Villages' TEMPASF1 (57 villages lay it), Kynareth's temples its TEMPASH4 (66): temples stood on
// the RMB Resource Pack's foundations (53170), their doors reached by landings (53160) and Daggerfall's stairs. Each
// prefab's MeshFilter names its mesh itself - a box of +-160 x +-80 x +-160 cm - so the FBX node it was exported on, and
// its Lcl Scaling of 125 and 250, is never instanced: the landing is 3.2 x 1.6 x 3.2 m, the foundation (prefab scale 2)
// 6.4 x 3.2 x 6.4, both centred. The stand-ins had read the node's scale: a 4 m landing 2 m high, a foundation 16 m
// square and 8 deep, sunk 2.4 m so its top cleared the door (AUDIT WD3 T1) - which buried the stairs and landings the
// author built up to the door under a 6 m wall of stone. The rocks had been the mesh without its prefab's scale (2 to 8),
// 143 of the 245 the packs lay wholly under the ground; the stalls at 1 where the prefab stands them at 0.75, 2.4 m off
// their origin. And Merdale's TEMPASD1: HILL-SEAT's pads (FIELD BUGS 2026-10-13e) banked over the temple's flight, by up to
// 1.25 m - now a pad buries nothing the author left in the open.
//
// No game data here: the packs' records are carried whole in the vendored packs (misc models for every block; TEMPASF1's
// subrecords too), built by the door's own converter and laid out by layoutRmbBlock; the stand-ins are the pipeline's
// (RMBRP_PIECES); a door is dfMeshToModel's own record off a synthetic mesh. The sweep over the player's own data is
// test/world/wd3_standins.test.js's (tools/townSolidsSweep.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import zlib from 'node:zlib';

import { ROW_CODECS } from '../../src/formats/worldData/worldDataPack.js';
import { blockFromJson } from '../../src/formats/worldData/worldDataReplacement.js';
import { layoutRmbBlock } from '../../src/world/rmbLayout.js';
import {
  RMBRP_PIECES, RMBRP_HILLS, RMBRP_ROCKS, RMBRP_ROCK_SCALE, RMBRP_STALLS, RMBRP_STALL_SCALE, RMBRP_BLOCK_CM, RMBRP_BLOCK_SCALE,
  blockHillSeat, blockHillPatch, doorApproach, doorApproachPoints, HILL_PATCH_SINK,
} from '../../src/world/townStandIns.js';
import { DOOR_APPROACH_M } from '../../src/world/curatedPlacements.js';
import { DOOR_CLEAR_M } from '../../tools/curatedPlacements.mjs';
import { MeshBuilder } from '../../src/world/detStandIns.js';
import { dfMeshToModel } from '../../src/world/meshReader.js';
import { trs } from '../../src/world/mat4.js';

const boxOf = (m) => {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < m.positions.length; i += 3) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], m.positions[i + k]); hi[k] = Math.max(hi[k], m.positions[i + k]); }
  return { lo, hi };
};
const r3 = (v) => v.map((x) => +x.toFixed(3) || 0);

// ---- the packs' own records, as the door serves them ------------------------------------------------------------
const packs = Object.fromEntries(['beautiful-villages', 'beautiful-cities'].map((v) => [v, JSON.parse(zlib.gunzipSync(readFileSync(new URL(`../../vendor/${v}/WorldDataPack/${v}.pack.json.gz`, import.meta.url))).toString('utf8'))]));
const P = (v) => (typeof v === 'string' ? JSON.parse(v) : v);
function whole(pack, name, key) {
  const nodes = (pack._nodes ??= pack.nodes.map(P));
  const expand = (v) => {
    if (Array.isArray(v)) return v.map(expand);
    if (!v || typeof v !== 'object') return v;
    const keys = Object.keys(v);
    assert.ok(!keys.includes('$c') && !keys.includes('$o'), `${name}: a record carried whole, not read from the player's BLOCKS.BSA`);
    if (v.$n !== undefined) return expand(nodes[v.$n]);
    const k = keys.find((key) => ROW_CODECS[key]);
    if (k) return v[k].map((row) => (Array.isArray(row) || typeof row === 'number' ? ROW_CODECS[k](row) : expand(row)));
    return Object.fromEntries(keys.map((key) => [key, expand(v[key])]));
  };
  for (let n = `${name}.json`; n;) {
    const [, base, ops] = P(pack.files[n]);
    const op = ops.find((o) => o[0] === 's' && o[1].join('.') === `RmbBlock.${key}`);
    if (op) return expand(op[2]);
    n = base[0] === 'f' ? base[1] : null;
  }
  return [];
}
const BV = packs['beautiful-villages'];
const blockOf = (pack, name, subs = true) => layoutRmbBlock(blockFromJson({ Name: name, RmbBlock: { FldHeader: {}, SubRecords: subs ? whole(pack, name, 'SubRecords') : [], Misc3dObjectRecords: whole(pack, name, 'Misc3dObjectRecords'), MiscFlatObjectRecords: [] } }, 9300)).models;
const origin = (m) => [m.matrix[12], m.matrix[13], m.matrix[14]];
/** A stand-in's top over its origin, read off the built mesh (the placement's own scale is 1 for every one here). */
const topOver = (id) => boxOf(RMBRP_PIECES[id]()).hi[1];
const bottomUnder = (id) => boxOf(RMBRP_PIECES[id]()).lo[1];

test('TEMPLE-STEPS: the pack\'s two stone blocks are one mesh, +-160 x +-80 x +-160 cm, at each prefab\'s own scale (the platform 1, the foundation 2) and centred - the FBX node\'s Lcl Scaling (125, 250) never instanced', () => {
  assert.deepEqual([...RMBRP_BLOCK_CM], [320, 160, 320]);
  assert.deepEqual({ ...RMBRP_BLOCK_SCALE }, { 53160: 1, 53170: 2 });
  assert.deepEqual([boxOf(RMBRP_PIECES[53160]())].map(({ lo, hi }) => [r3(lo), r3(hi)])[0], [[-1.6, -0.8, -1.6], [1.6, 0.8, 1.6]], 'the landing: 3.2 x 1.6 x 3.2 m');
  assert.deepEqual([boxOf(RMBRP_PIECES[53170]())].map(({ lo, hi }) => [r3(lo), r3(hi)])[0], [[-3.2, -1.6, -3.2], [3.2, 1.6, 3.2]], 'the foundation: 6.4 x 3.2 x 6.4 m, no sink');
});

test('TEMPLE-STEPS: the author\'s own layout is the measure - TEMPASF1\'s landing tops meet the temple\'s step and the stair\'s foot, its foundations\' tops the temple\'s floor; TEMPASH4\'s foundations meet face to face, their feet the stair\'s foot', () => {
  const F1 = blockOf(BV, 'TEMPASF1.RMB');
  const temple = F1.find((m) => m.modelIdNum === 401), floor = origin(temple)[1];
  const landings = F1.filter((m) => m.modelIdNum === 53160).sort((a, b) => origin(b)[1] - origin(a)[1]);
  const stair = F1.find((m) => m.modelIdNum === 21728), foundations = F1.filter((m) => m.modelIdNum === 53170);
  assert.equal(landings.length, 2); assert.equal(foundations.length, 3);
  // Daggerfall's stair 21728 stands on its origin, its foot; the temple's floor is its origin, its door's step two units up
  assert.ok(Math.abs(origin(landings[0])[1] + topOver(53160) - (floor + 0.05)) < 0.01, `the upper landing's top ${(origin(landings[0])[1] + topOver(53160)).toFixed(3)} is the door's step (the floor ${floor.toFixed(3)} and two units)`);
  assert.ok(Math.abs(origin(landings[1])[1] + topOver(53160) - origin(stair)[1]) < 0.01, 'the lower landing\'s top is the stair\'s foot');
  for (const f of foundations) {
    const top = origin(f)[1] + topOver(53170);
    assert.ok(top - floor >= 0.02 && top - floor <= 0.051, `a foundation's top ${top.toFixed(3)} at the temple's floor ${floor.toFixed(3)} (the author's two units)`);
  }
  // TEMPASH4 (its subrecords are the player's own BLOCKS.BSA's; its misc models are carried whole)
  const H4 = blockOf(BV, 'TEMPASH4.RMB', false);
  const fh = H4.filter((m) => m.modelIdNum === 53170), sh = H4.find((m) => m.modelIdNum === 21728);
  assert.equal(fh.length, 5);
  for (const f of fh) assert.ok(Math.abs(origin(f)[1] + bottomUnder(53170) - origin(sh)[1]) < 0.01, 'each foundation\'s foot the stair\'s');
  const gaps = fh.map((f) => Math.min(...fh.filter((g) => g !== f).map((g) => Math.hypot(origin(g)[0] - origin(f)[0], origin(g)[2] - origin(f)[2]))));
  assert.ok(gaps.filter((d) => Math.abs(d - 2 * topOver(53170) * 2) < 0.05).length >= 2, `foundations tiled a foundation's width apart (6.4 m): ${gaps.map((d) => d.toFixed(2))}`);
});

test('TEMPLE-STEPS: every rock at its prefab\'s scale (2 to 8) over its mesh\'s own box - no further out - and the packs\' 245 rocks stand out of the ground they were laid on (143 had stood wholly under it)', () => {
  assert.deepEqual({ ...RMBRP_ROCK_SCALE }, {
    53006: 6, 53012: 5, 53014: 4, 53017: 6, 53020: 4, 53023: 2, 53029: 6, 53030: 8, 53031: 6, 53032: 3, 53033: 4, 53035: 4,
    53036: 6, 53037: 4, 53038: 4, 53039: 4, 53040: 3, 53042: 4, 53054: 8, 53064: 6, 53083: 6, 53085: 8, 53086: 4,
  });
  assert.deepEqual(Object.keys(RMBRP_ROCK_SCALE), Object.keys(RMBRP_ROCKS));
  // 53086's box sits a fifth of its width off its origin: the boulder with it
  const [x0, x1, , , z0, z1] = RMBRP_ROCKS[53086].map((v) => v * 4), b = boxOf(RMBRP_PIECES[53086]());
  assert.ok(Math.abs((b.lo[0] + b.hi[0]) / 2 - (x0 + x1) / 2) < 0.6 && b.lo[0] < -3 && b.hi[0] < x1 + 1e-5 && b.lo[2] >= z0 - 1e-5 && b.hi[2] <= z1 + 1e-5, `53086 over ${[x0, x1]} x ${[z0, z1]}`);
  // every rock the two packs lay, against the ground the block draws under it (its hills, or its plane)
  let rocks = 0, buried = 0;
  for (const pack of Object.values(packs)) {
    for (const f of Object.keys(pack.files)) {
      if (!f.endsWith('.RMB.json')) continue;
      const laid = blockOf(pack, f.slice(0, -5), false), seat = blockHillSeat(laid);
      for (const m of laid) {
        if (!RMBRP_ROCKS[m.modelIdNum]) continue;
        rocks++;
        const M = m.matrix, top = M[13] + boxOf(RMBRP_PIECES[m.modelIdNum]()).hi[1] * Math.hypot(M[4], M[5], M[6]);
        if (top < Math.max(seat?.topAt(M[12], M[14]) ?? 0, 0) + 0.02) buried++;
      }
    }
  }
  assert.equal(rocks, 245);
  assert.equal(buried, 2, `${buried} wholly under the drawn ground - where a stand-in hill's median stands over the pack's own`);
});

test('TEMPLE-STEPS: a stall is the pack\'s mesh as Unity imports it (x mirrored: its high back on -x, its counter at the origin) at its prefab\'s 0.75', () => {
  assert.equal(RMBRP_STALL_SCALE, 0.75);
  for (const id of Object.keys(RMBRP_STALLS)) {
    const { lo, hi } = boxOf(RMBRP_PIECES[id]());
    // PIN MOVED (FIELD BUGS 2026-10-16b STALL-SHAPE): the pack's second mesh (53113 on, ext_city_stall014-025) its own -
    // the frame 0.2 m back, 0.206 up and 0.066 across, no counter (test/world/fb1016b_stallshape.test.js holds its shape)
    assert.deepEqual([r3(lo), r3(hi)], Number(id) >= 53113 ? [[-2.213, 0, -1.811], [-0.062, 3.454, 1.85]] : [[-2.063, 0, -1.86], [0.3, 3.3, 1.8]], id);
  }
});

// ---- HILL-SEAT x TEMPLE-STEPS: a pad buries nothing the author left in the open -----------------------------------
// A hill of the test's own: a mesa 4 m high to x = +-10, its flanks falling to under the plane at x = +-22 (a median's
// slope, under half the pad's bank's); a house 8 m square and 6 high standing on its east edge, from x = 8 to 16, its
// base on the plateau - so the drawn top falls away under its east half and HILL-SEAT pads it.
const HILL_ID = 9100;
const MESA = (() => {
  const m = new MeshBuilder(), xs = [-22, -10, 10, 22], ys = [-0.5, 4, 4, -0.5];
  for (let i = 0; i < 3; i++) m.quad([302, 2], [xs[i], ys[i], -30], [xs[i + 1], ys[i + 1], -30], [xs[i + 1], ys[i + 1], 30], [xs[i], ys[i], 30], [0, 1, 0]);
  return m.build();
})();
const drawn = (id) => (id === HILL_ID ? MESA : null);
const mesaTop = (x) => (Math.abs(x) <= 10 ? 4 : 4 - (4.5 * (Math.abs(x) - 10)) / 12);
const boxMesh = (w, h, d = w) => { const m = new MeshBuilder(); m.box([302, 1], [0, h / 2, 0], [w, h, d]); return m.build(); };
const HOUSE = { modelIdNum: 9001, matrix: trs(12, 4, 0, 0, 0, 0) }, HOUSE_MESH = boxMesh(8, 6);
const HILL = { modelIdNum: HILL_ID, matrix: trs(0, 0, 0, 0, 0, 0) };
const ID = trs(0, 0, 0, 0, 0, 0);
/** The pads' top over (x, z), or null. */
const padTop = (patch, x, z) => (patch ? blockHillSeat([{ modelIdNum: 1, matrix: ID }], () => patch).topAt(x, z) : null);
/** A building of the test's own with one door, through the mesh reader (dfMeshToModel's door record): a 4 m wall-box,
 *  its door 1.25 m wide on its -x face, facing -x, its foot on the origin. */
function doorHouse() {
  const pt = (x, y, z) => ({ x: x / 0.025, y: -y / 0.025, z: z / 0.025, nx: -1, ny: 0, nz: 0, u: 0, v: 0 });
  const wall = { points: [pt(2, 0, -2), pt(2, 3, -2), pt(2, 3, 2), pt(2, 0, 2)] };
  const door = { points: [pt(-2, 0, -0.625), pt(-2, 2.25, -0.625), pt(-2, 2.25, 0.625), pt(-2, 0, 0.625)] };
  return dfMeshToModel({ totalVertices: 8, totalTriangles: 4, subMeshes: [{ textureArchive: 19, textureRecord: 0, totalTriangles: 2, planes: [wall] }, { textureArchive: 74, textureRecord: 0, totalTriangles: 2, planes: [door] }] }, () => ({ width: 1, height: 1 }));
}

test('TEMPLE-STEPS: a door\'s approach is the mesh reader\'s own door record laid by its placement - its step at the door\'s foot, out along the record\'s normal, level, its width - and the points HILL-HOUSE\'s rule reads: the step and every quarter metre to 4 m out, at the middle and a hand\'s breadth in from each jamb', () => {
  assert.equal(DOOR_APPROACH_M, 4); assert.equal(DOOR_CLEAR_M, DOOR_APPROACH_M, 'HILL-HOUSE\'s tool reads the one home');
  const model = doorHouse();
  assert.equal(model.doors.length, 1);
  const a = doorApproach(model.doors[0], trs(20, 0.3, 5, 0, 90, 0));
  assert.deepEqual(r3(a.foot), [20, 0.3, 7], 'the step: the door\'s foot, turned with the house');
  assert.deepEqual(r3(a.out), [0, 0, 1], 'out of the door: the record\'s -x, turned a quarter to +z');
  assert.ok(Math.abs(a.half - 0.625) < 1e-6);
  const pts = doorApproachPoints(a);
  assert.equal(pts.length, 17 * 3);
  assert.deepEqual(r3(pts[0]), [20.525, 7, 0]); assert.deepEqual(r3(pts[pts.length - 1]), [19.475, 11, 4]);
});

test('TEMPLE-STEPS: a pad\'s bank falls under what the author left in the open beside it - a crate over the hill\'s flank stays HILL_PATCH_SINK clear of it, where the bank had stood over it - still facing up, its edge under the ground', () => {
  // the crate hung by its author 1.1 m over the flank (so it takes no pad of its own), 1.5 m past the house's east wall
  const crate = { modelIdNum: 9002, matrix: trs(18, 2.3, 0, 0, 0, 0) }, CRATE = boxMesh(1, 0.5);
  const meshOf = (p) => (p === HOUSE ? HOUSE_MESH : p === crate ? CRATE : null);
  const bare = blockHillPatch(blockHillSeat([HILL, HOUSE], drawn), [HILL, HOUSE], meshOf, drawn);
  const yielded = blockHillPatch(blockHillSeat([HILL, HOUSE, crate], drawn), [HILL, HOUSE, crate], meshOf, drawn);
  assert.ok(bare && yielded, 'the house is padded either way');
  assert.equal(blockHillPatch(blockHillSeat([HILL, crate], drawn), [HILL, crate], meshOf, drawn), null, 'the crate itself takes none');
  const corners = [];
  for (let i = 0; i < CRATE.positions.length; i += 3) corners.push([CRATE.positions[i] + 18, CRATE.positions[i + 1] + 2.3, CRATE.positions[i + 2]]);
  const open = corners.filter(([x, y]) => y > mesaTop(x) + HILL_PATCH_SINK);
  assert.ok(open.length >= 4, 'the crate\'s top stands out of the drawn hill');
  assert.ok(open.some(([x, y, z]) => (padTop(bare, x, z) ?? -Infinity) > y), 'the bank, falling a metre a metre, had stood over the crate');
  for (const [x, y, z] of open) assert.ok((padTop(yielded, x, z) ?? -Infinity) <= y - HILL_PATCH_SINK + 1e-6, `the pad clear of the crate at (${x}, ${y.toFixed(2)}, ${z})`);
  for (let i = 0; i < yielded.normals.length; i += 3) assert.ok(yielded.normals[i + 1] > 0, 'every face up');
  for (let i = 0; i < yielded.positions.length; i += 3) {
    const [x, y] = [yielded.positions[i], yielded.positions[i + 1]];
    if (x > 16.5) assert.ok(y <= Math.max(mesaTop(x), 0) + 1e-6 || Math.abs(y - 3.95) < 1e-6, 'past the crest, each vertex a toe under the drawn ground');
  }
});

test('TEMPLE-STEPS: a pad gives way to a door - another house\'s step and the four metres before it, read off the mesh the host draws (its door record), keep the bank HILL_PATCH_SINK under its foot; and where the pad\'s own top would cover what the author left in the open, the house gets none', () => {
  const B = { modelIdNum: 9003, matrix: trs(23, 0.3, 0, 0, 0, 0) }, B_MESH = doorHouse();   // its door at x = 21 facing -x, towards the house
  const doorless = { ...B_MESH, doors: [] };
  const run = (mesh) => blockHillPatch(blockHillSeat([HILL, HOUSE, B], drawn), [HILL, HOUSE, B], (p) => (p === HOUSE ? HOUSE_MESH : p === B ? mesh : null), drawn);
  const approach = doorApproachPoints(doorApproach(B_MESH.doors[0], B.matrix));
  assert.ok(approach.every(([x]) => x <= 21 + 1e-6 && x >= 17 - 1e-6), 'the approach runs west from the door to x = 17');
  const blind = run(doorless), seeing = run(B_MESH);
  assert.ok(blind && seeing);
  assert.ok(approach.some(([x, z]) => (padTop(blind, x, z) ?? -Infinity) > 0.3), 'told no door, the bank stands over its approach');
  for (const [x, z] of approach) assert.ok((padTop(seeing, x, z) ?? -Infinity) <= 0.3 - HILL_PATCH_SINK + 1e-6, `the bank under the step's level at (${x.toFixed(2)}, ${z.toFixed(2)})`);
  // a crate the author stood against the house's east wall, its top under the pad's: no pad at all
  const crate = { modelIdNum: 9002, matrix: trs(16.1, 3, 0, 0, 0, 0) }, CRATE = boxMesh(0.2, 0.9);
  assert.equal(blockHillPatch(blockHillSeat([HILL, HOUSE, crate], drawn), [HILL, HOUSE, crate], (p) => (p === HOUSE ? HOUSE_MESH : p === crate ? CRATE : null), drawn), null);
  assert.ok(RMBRP_HILLS[52758] && !RMBRP_HILLS[HILL_ID], 'the hill here is the test\'s own');
});
