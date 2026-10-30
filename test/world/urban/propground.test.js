// PROP-GROUND (the owner, 2026-10-30: "Ever since we changed town lauouts and stuff props still sit on old textures";
// bible/03-World/Urban-Fabric.md section 10): a prop's clearance - the cell and the eight round a misc model or a flat of
// Daggerfall's - takes the surface round it: the setts, the flags or the cobbles are laid under it, where they had left
// a square of Daggerfall's old ground showing through the street.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fabricGrid, fabricPlan, propGround, labelPieces, FABRIC_KIND as K, FABRIC_CELLS } from '../../../src/world/urban/townFabric.js';
import { townFabricModel, FABRIC_ROAD_Y, FABRIC_PAVE_Y } from '../../../src/world/urban/townFabricModel.js';
import { URBAN_ARCHIVE, URBAN_STYLE_KEYS, URBAN_KINDS } from '../../../src/world/urban/urbanRecords.js';

const ARENA2 = process.env.ARENA2_PATH;
const skipReal = !ARENA2 || !existsSync(join(ARENA2 ?? '', 'BLOCKS.BSA')) ? 'ARENA2_PATH not set or missing - real-data validation skipped' : false;
const C = FABRIC_CELLS, M = 1.6;

/** A block of our own (urban3_fabric.test.js's shape): `rects` on its town map (rows from the north), its ground, its records. */
function block({ ground = () => 1, rects = [], records = [] } = {}) {
  const automap = new Uint8Array(C * C);
  for (const [r0, r1, c0, c1, b] of rects) for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) automap[r * C + c] = b;
  return { automap, ground: (tx, ty) => ground(ty * 4, tx * 4), records };
}
/** A record at the grid's cell (x, z - z from the south). */
const at = (x, z) => ({ x: x * M + 0.8, z: z * M + 0.8 });

test('PROP-GROUND the grid: a record\'s cell and the eight round it are its prop\'s - never a building\'s byte, a special\'s or the water under it (mutants: the prop marked over a house; the water a prop\'s)', () => {
  // a house at town-map (20, 20) - grid (20, 43); the water the first ground tile, grid x 0..3, z 60..63; a special's byte at grid (40, 30)
  const b = block({ ground: (r, c) => (r === 0 && c < 4 ? 0 : 1), rects: [[20, 20, 20, 20, 18], [33, 33, 40, 40, 251]], records: [at(30, 10), at(21, 43), at(4, 61), at(40, 31)] });
  const g = fabricGrid(1, 1, () => b), cell = (x, z) => z * g.W + x;
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) { assert.equal(g.prop[cell(30 + dx, 10 + dz)], 1); assert.equal(g.built[cell(30 + dx, 10 + dz)], 1); }
  assert.equal(g.prop[cell(30, 12)], 0);
  assert.equal(g.prop[cell(20, 43)], 0, 'the house\'s cell is the house\'s');
  assert.equal(g.prop[cell(22, 43)], 1);
  assert.equal(g.prop[cell(3, 61)], 0, 'the water');
  assert.equal(g.prop[cell(5, 61)], 1);
  assert.equal(g.prop[cell(40, 30)], 0, 'a special\'s byte');
  assert.equal(g.prop[cell(40, 31)], 1);
});

/** propGround over a row of kinds: 'm' main, 'p' pave, 'c' side, 'y' yard, 'o' a prop's cell, '#' a house. */
function row(s) {
  const map = { m: K.main, p: K.pave, c: K.side, y: K.yard, o: K.built, '#': K.built };
  const W = s.length, kind = Uint8Array.from(s, (ch) => map[ch]), prop = Uint8Array.from(s, (ch) => (ch === 'o' ? 1 : 0));
  return [...propGround({ W, H: 1, prop }, kind)];
}

test('PROP-GROUND the surface under a prop: each cell the nearest ground\'s outside its clearance, a tie a street\'s before none and the setts\' before the flags\'; a house no source; a clearance no ground reaches bare; a bare cell beside the setts the pavement\'s (mutants: a house a source of bare ground; the tie the flags\'; the walk one step deep; the ring unlaid)', () => {
  assert.deepEqual(row('moooooy'), [0, K.main, K.main, K.main, K.pave, 0, 0], 'split between the street and the yard, the middle the street\'s, the setts\' ring the pavement\'s');
  assert.deepEqual(row('mop'), [0, K.main, 0], 'the setts before the flags');
  assert.deepEqual(row('yop'), [0, K.pave, 0], 'a street before none');
  assert.deepEqual(row('yoy'), [0, 0, 0]);
  assert.deepEqual(row('#ooom'), [0, K.main, K.main, K.main, 0], 'a house is no ground');
  assert.deepEqual(row('#o#'), [0, 0, 0], 'none reaches it');
  assert.deepEqual(row('coooc'), [0, K.side, K.side, K.side, 0]);
  // a clearance in the setts at the pavement's edge: the row on the setts the setts', the rows on the pavement the flags'
  const W = 7, H = 7, kind = new Uint8Array(W * H), prop = new Uint8Array(W * H);
  for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) kind[z * W + x] = z < 3 ? K.main : K.pave;
  for (let z = 2; z <= 4; z++) for (let x = 2; x <= 4; x++) { kind[z * W + x] = K.built; prop[z * W + x] = 1; }
  const u = propGround({ W, H, prop }, kind);
  for (let x = 2; x <= 4; x++) { assert.equal(u[2 * W + x], K.main); assert.equal(u[3 * W + x], K.pave); assert.equal(u[4 * W + x], K.pave); }
  assert.equal(u[0], 0, 'a cell no prop\'s');
  assert.deepEqual([...propGround({ W, H }, kind)], new Array(W * H).fill(0), 'a grid with no props');
});

test('PROP-GROUND the plan: a prop\'s cells stay built (no walk, pavement or yard through them) and carry the surface round them; a prop in the main street stands on it (mutants: the plan\'s `under` unlaid)', () => {
  // urban3_fabric.test.js's town: Daggerfall's road along tile row 8 of two blocks, the main street along it - a well in it
  const road = (r) => ((r >> 2) === 8 ? 46 : null);
  const well = at(40, 30);   // on the road (grid z 28 to 31), between the houses
  const b0 = block({ ground: (r) => road(r) ?? 1, rects: [[10, 24, 8, 24, 18], [40, 54, 30, 50, 18]], records: [well] });
  const b1 = block({ ground: (r) => road(r) ?? 1, rects: [[12, 26, 10, 30, 19], [42, 56, 20, 44, 20]] });
  const g = fabricGrid(2, 1, (bx) => (bx === 0 ? b0 : b1)), W = g.W;
  const plan = fabricPlan(g, { ends: [[0, 30], [W, 30]], centre: [W / 2, 30], seed: 1 });
  assert.deepEqual([...plan.under], [...propGround(g, plan.kind)]);
  const cells = [];
  for (let i = 0; i < g.prop.length; i++) if (g.prop[i]) cells.push(i);
  assert.equal(cells.length, 9);
  for (const i of cells) {
    assert.equal(plan.kind[i], K.built, 'still built');
    assert.ok(plan.under[i] === K.main || plan.under[i] === K.pave, `the street under it (${plan.under[i]})`);
  }
  // its clearance's top row reaches the pavement's line, the open ground past it: the pavement runs on unbroken
  for (let x = 36; x <= 44; x++) assert.equal(plan.kind[31 * W + x] === K.built ? plan.under[31 * W + x] : plan.kind[31 * W + x], K.pave, `the pavement at ${x}`);
});

const faces = (m, archive, record) => {
  const sm = m.subMeshes.find((s) => s.textureArchive === archive && s.textureRecord === record);
  if (!sm) return [];
  const out = [];
  for (let t = sm.startIndex; t < sm.startIndex + sm.primitiveCount * 3; t += 3) out.push([0, 1, 2].map((k) => [0, 1, 2].map((a) => m.positions[m.indices[t + k] * 3 + a])));
  return out;
};
const area = (tri) => { const [a, b, c] = tri, u = b.map((v, i) => v - a[i]), v = c.map((w, i) => w - a[i]); return Math.hypot(u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]) / 2; };
const sum = (list) => list.reduce((s, t) => s + area(t), 0);

test('PROP-GROUND the model: the setts and the flags laid over a prop\'s cells by the surface under them, a kerb\'s face between its flags and its setts, none onto its bare ground (mutants: `under` unread; a kerb read off the plan\'s kind)', () => {
  // 5 x 4: z 0 setts; z 1 setts round three prop cells laid in setts; z 2 flags round two prop cells laid in flags and one
  // bare; z 3 flags
  const W = 5, H = 4, kind = new Uint8Array(W * H), under = new Uint8Array(W * H);
  for (let x = 0; x < W; x++) { kind[x] = K.main; kind[W + x] = K.main; kind[2 * W + x] = K.pave; kind[3 * W + x] = K.pave; }
  for (const x of [1, 2, 3]) { kind[W + x] = K.built; under[W + x] = K.main; kind[2 * W + x] = K.built; under[2 * W + x] = x < 3 ? K.pave : 0; }
  const plan = { W, H, kind, under, fences: [], gates: [], walls: [], dead: [], props: [], shut: new Uint8Array(W * H), paths: [], ends: [], centre: -1, counts: {} };
  const k = URBAN_STYLE_KEYS.indexOf('granite') * 8, m = townFabricModel(plan, 'granite');
  const setts = faces(m, URBAN_ARCHIVE, k + URBAN_KINDS.setts), flags = faces(m, URBAN_ARCHIVE, k + URBAN_KINDS.flags);
  const level = (y) => (t) => t.every((v) => Math.abs(v[1] - y) < 1e-6);
  assert.ok(setts.every(level(FABRIC_ROAD_Y)));
  assert.ok(Math.abs(sum(setts) - 10 * M * M) < 1e-3, `the setts over ten cells (${(sum(setts) / M / M).toFixed(2)})`);
  const tops = flags.filter(level(FABRIC_PAVE_Y)), kerbs = flags.filter((t) => !level(FABRIC_PAVE_Y)(t));
  assert.ok(Math.abs(sum(tops) - 9 * M * M) < 1e-3, `the flags over nine (${(sum(tops) / M / M).toFixed(2)})`);
  // z 2's four onto the setts below, its two ends, z 3's five onto the grid's edge and its two ends - none onto the bare cell
  assert.ok(Math.abs(sum(kerbs) - 13 * M * FABRIC_PAVE_Y) < 1e-3, `thirteen kerbs' faces (${(sum(kerbs) / M / FABRIC_PAVE_Y).toFixed(2)})`);
  // a plan made before `under` (a kept plan's shape) lays as it did
  const old = townFabricModel({ ...plan, under: undefined }, 'granite');
  assert.ok(Math.abs(sum(faces(old, URBAN_ARCHIVE, k + URBAN_KINDS.setts)) - 7 * M * M) < 1e-3);
});

test('PROP-GROUND with ARENA2: over the cities and the hamlets past the Bay as they are cloned, and the capitals but the Imperial City - no prop wholly in the street left on bare ground, and every one of them had been; the Bay\'s towns dress none (mutants: `under` unlaid; a house a source)', { skip: skipReal }, async () => {
  const { BlocksFile } = await import('../../../src/formats/blocksFile.js');
  const { MapsFile } = await import('../../../src/formats/mapsFile.js');
  const { arenaTemplates } = await import('../../../src/world/arenaLocations.js');
  const { outlineTownLocation } = await import('../../../src/world/townOutline.js');
  const { fabricBlockOf, fabricEnds, fabricTown } = await import('../../../src/world/urban/townFabricStand.js');
  const capitals = await import('../../../src/world/tamrielCapitals.js');
  const bytes = (n) => new Uint8Array(readFileSync(join(ARENA2, n)));
  const blocks = new BlocksFile(); blocks.load(bytes('BLOCKS.BSA'));
  const maps = new MapsFile(); maps.load(bytes('MAPS.BSA'), bytes('CLIMATE.PAK'), bytes('POLITIC.PAK')); maps.autoDiscard = false;
  const rows = [];
  for (let r = 0; r < 62; r++) { const reg = maps.getRegion(r); if (!reg) continue; for (let l = 0; l < reg.locationCount; l++) { const loc = maps.getLocation(r, l); if (loc) rows.push(loc); } }
  const gridOf = (ed) => fabricGrid(ed.width, ed.height, (bx, by) => { const name = ed.blockNames[by * ed.width + bx]; return fabricBlockOf({ blockName: name, dfBlock: blocks.getBlockByName(blocks.checkName(name)) }); });
  /** A plan's props wholly in its laid streets (every ground beside them a street's): their cells, and those left bare. */
  const holes = (g, plan, cobbles) => {
    const laid = (k) => k === K.main || k === K.pave || (cobbles && k === K.side);
    const { id, sizes } = labelPieces(g.W, g.H, Uint8Array.from(plan.kind, (k, i) => (k === K.built && g.prop[i] ? 1 : 0)));
    const street = sizes.map(() => ({ laid: 0, other: 0 }));
    for (let i = 0; i < id.length; i++) {
      if (id[i] < 0) continue;
      const x = i % g.W;
      for (const j of [x > 0 ? i - 1 : -1, x < g.W - 1 ? i + 1 : -1, i - g.W, i + g.W]) if (j >= 0 && j < id.length && plan.kind[j] !== K.built) street[id[i]][laid(plan.kind[j]) ? 'laid' : 'other']++;
    }
    let cells = 0, bare = 0;
    for (let i = 0; i < id.length; i++) if (id[i] >= 0 && street[id[i]].laid && !street[id[i]].other) { cells++; if (!laid(plan.under[i])) bare++; }
    return { cells, bare };
  };
  const t = arenaTemplates(rows), io = { classicOf: (n) => blocks.readClassicBlock(blocks.getBlockIndex(blocks.checkName(n))), servedOf: (n) => blocks.getBlockByName(n) };
  let towns = 0, cells = 0;
  for (const [kind, every] of [['city-state', 23], ['town', 61]]) {
    for (let j = 0; j < t[kind].length; j += every) {
      const tpl = t[kind][j], mapId = ((0xa7 << 20) | (500000 + j)) >>> 0;
      const loc = outlineTownLocation({ ...tpl, mapTableData: { ...tpl.mapTableData, mapId } }, io), g = gridOf(loc.exterior.exteriorData);
      const { mains, ends, centre } = fabricEnds(loc, g.W, g.H);
      const h = holes(g, fabricPlan(g, { ends, centre, mains, seed: mapId }), kind === 'city-state');
      assert.equal(h.bare, 0, `${tpl.name}: ${h.bare} of ${h.cells} cells bare`);
      cells += h.cells; towns++;
    }
  }
  assert.ok(towns >= 20 && cells > towns * 20, `${cells} cells of props wholly in the streets of ${towns} towns`);
  for (let k = 1; k < capitals.CAPITALS.length; k++) {
    const cap = capitals.CAPITALS[k];
    const loc = capitals.synthesizeCapitalLocation({ cap, k }, { base: capitals.capitalBase(rows), names: capitals.cityBlockNames(rows), blockOf: (n) => blocks.getBlockByName(n) ?? null, px: 1000, py: 1000 });
    const g = gridOf(loc.exterior.exteriorData), { mains, ends, centre } = fabricEnds(loc, g.W, g.H);
    const h = holes(g, fabricPlan(g, { ends, centre, mains, seed: 1, outWalls: false }), true);
    assert.ok(h.cells > 100, `${cap.name}: ${h.cells} cells`);
    assert.equal(h.bare, 0, `${cap.name}: ${h.bare} of ${h.cells} bare`);
  }
  // the Bay's towns are Daggerfall's: no fabric, their props on the ground their blocks lay
  const bay = maps.getLocationByName('Daggerfall', 'Newcester');
  assert.ok(bay?.exterior?.exteriorData);
  assert.equal(fabricTown(bay), false);
});
