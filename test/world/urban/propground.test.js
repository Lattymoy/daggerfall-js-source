// PROP-GROUND (the owner, 2026-10-30: "Ever since we changed town lauouts and stuff props still sit on old textures";
// bible/03-World/Urban-Fabric.md sections 10 and 11): a prop's ground - the cell and the eight round a misc model or a flat
// of Daggerfall's, and the town map's furniture bytes - takes the surface round it under the street's own laws; a model
// with a face at a street face's height keeps it off that face; a flat stands on the street laid under it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fabricGrid, fabricPlan, propGround, chamferField, labelPieces, FABRIC, FABRIC_KIND as K, FABRIC_CELLS, FOOT_FACED } from '../../../src/world/urban/townFabric.js';
import { townFabricModel, fabricFaces, FABRIC_FACE, FABRIC_ROAD_Y, FABRIC_PAVE_Y, FABRIC_LAND_Y } from '../../../src/world/urban/townFabricModel.js';
import { fabricLift, footPlate, townFabricFor, _resetTownFabrics } from '../../../src/world/urban/townFabricStand.js';
import { URBAN_ARCHIVE, URBAN_STYLE_KEYS, URBAN_KINDS } from '../../../src/world/urban/urbanRecords.js';
import { LOCATION_TYPES } from '../../../src/formats/mapsFile.js';

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
const at = (x, z, o = {}) => ({ x: x * M + 0.8, z: z * M + 0.8, ...o });

test('PROP-GROUND the grid: a record\'s cell and the eight round it are its prop\'s, and so is the town map\'s furniture (250, 251) - never a building\'s byte or the water; a foot plate\'s cells are none, whichever record came first; a flags-faced model\'s are flagless (mutants: the prop marked over a house; the furniture unread; the furniture on the water; the plate unread; the flagless unread)', () => {
  // a house at town-map (20, 20) - grid (20, 43); the water the first ground tile, grid x 0..3, z 60..63; a misc model's
  // own byte (250) at grid (40, 30), a ground flat's (251) at (50, 30) and one on the water at (1, 62)
  const b = block({
    ground: (r, c) => (r === 0 && c < 4 ? 0 : 1),
    rects: [[20, 20, 20, 20, 18], [33, 33, 40, 40, 250], [33, 33, 50, 50, 251], [1, 1, 1, 1, 251]],
    records: [at(30, 10), at(21, 43), at(4, 61), at(40, 31), at(13, 26), at(12, 25, { id: 41712, plate: [12 * M + 0.1, 25 * M + 0.1, 13 * M + 0.5, 25 * M + 0.5] }), at(10, 5, { id: 43019 })],
  });
  const g = fabricGrid(1, 1, () => b), cell = (x, z) => z * g.W + x;
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) { assert.equal(g.prop[cell(30 + dx, 10 + dz)], 1); assert.equal(g.built[cell(30 + dx, 10 + dz)], 1); }
  assert.equal(g.prop[cell(30, 12)], 0);
  assert.equal(g.prop[cell(20, 43)], 0, 'the house\'s cell is the house\'s');
  assert.equal(g.prop[cell(22, 43)], 1);
  assert.equal(g.prop[cell(3, 61)], 0, 'the water');
  assert.equal(g.prop[cell(5, 61)], 1);
  assert.equal(g.prop[cell(40, 30)], 1, 'a misc model\'s own cell (250)');
  assert.equal(g.prop[cell(50, 30)], 1, 'a ground flat\'s own cell (251) - a lamp\'s');
  assert.equal(g.built[cell(50, 30)], 1, 'still built: no walk through it');
  assert.equal(g.prop[cell(1, 62)], 0, 'furniture on the water');
  for (const [x, z] of [[12, 25], [13, 25]]) { assert.equal(g.prop[cell(x, z)], 0, `the plate's cell ${x},${z}`); assert.equal(g.built[cell(x, z)], 1); }
  for (const [x, z] of [[11, 24], [12, 26], [13, 26], [11, 25]]) assert.equal(g.prop[cell(x, z)], 1, `round the plate ${x},${z}`);
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) { assert.equal(g.flagless[cell(10 + dx, 5 + dz)], 1); assert.equal(g.prop[cell(10 + dx, 5 + dz)], 1); }
  assert.equal(g.flagless[cell(30, 10)], 0);
});

/** propGround over a grid of letters, its rows from the south: 'm' setts, 'p' flags, 'c' cobbles (a side street), 'y' a
 *  yard, '.' open ground, '#' a house, 'o' a prop's cell, 'f' a flagless prop's cell. Out: a prop's cell its surface's letter
 *  ('_' none), every other its own. */
function laid(rows, o = {}) {
  const code = { m: K.main, p: K.pave, c: K.side, y: K.yard, '.': K.open, '#': K.built, o: K.built, f: K.built };
  const H = rows.length, W = rows[0].length, s = rows.join('');
  const kind = Uint8Array.from(s, (ch) => code[ch]), prop = Uint8Array.from(s, (ch) => (ch === 'o' || ch === 'f' ? 1 : 0));
  const g = { W, H, prop, flagless: Uint8Array.from(s, (ch) => (ch === 'f' ? 1 : 0)), house: Uint8Array.from(s, (ch) => (ch === '#' ? 1 : 0)) };
  const u = propGround(g, kind, o), back = { [K.main]: 'm', [K.pave]: 'p', [K.side]: 'c', 0: '_' };
  return rows.map((r, z) => [...r].map((ch, x) => (ch === 'o' || ch === 'f' ? back[u[z * W + x]] : ch)).join(''));
}

test('PROP-GROUND the street under a prop: the nearest ground\'s surface, a house no source - then the street\'s laws: setts beside other ground or before a house the pavement\'s, the pavement\'s ring round the setts, no lone slab; a flagless cell never flags (mutants: a house a source; the walk one step deep; the kerb law, the ring, the slab law each unlaid; the house no kerb; the flagless unread)', () => {
  // a lamp in the setts: all setts
  assert.deepEqual(laid(['mmmmm', 'mooom', 'mooom', 'mooom', 'mmmmm']), ['mmmmm', 'mmmmm', 'mmmmm', 'mmmmm', 'mmmmm']);
  // the owner's sign: its clearance across the pavement before the shops and the setts - the pavement runs on through it
  assert.deepEqual(laid(['mmmmmmmm', 'mmmooomm', 'mmmooomm', 'pppooopp', '########']), ['mmmmmmmm', 'mmmmmmmm', 'mmmmmmmm', 'pppppppp', '########']);
  // at a yard's edge: the setts, the pavement, the yard's side Daggerfall's own
  assert.deepEqual(laid(['mmmmmmmm', 'mmmooomm', 'pppooopp', 'yyyoooyy', 'yyyyyyyy']), ['mmmmmmmm', 'mmmmmmmm', 'pppppppp', 'yyy___yy', 'yyyyyyyy']);
  // between the setts and a cobbled side street: a pavement between them
  assert.deepEqual(laid(['mmmooocc', 'mmmooocc', 'mmmooocc', 'mmmooocc']), ['mmmmpccc', 'mmmmpccc', 'mmmmpccc', 'mmmmpccc']);
  // reaching past the pavement onto open ground: the pavement's line unbroken, no sett notched into it, the rest bare
  assert.deepEqual(laid(['mmmmmmmm', 'pppooopp', '...ooo..', '...ooo..']), ['mmmmmmmm', 'pppppppp', '...___..', '...___..']);
  // three cells of pavement before a house is a lone slab - no pavement there, as the street's own law has it
  assert.deepEqual(laid(['#######', '#ooommm', '#ooommm', '#ooommm', '#######']), ['#######', '#mmmmmm', '#mmmmmm', '#mmmmmm', '#######']);
  // before a house front four cells and more: the pavement
  assert.deepEqual(laid(['mmmmmmmm', 'mmmmmmmm', 'mooooomm', '########']), ['mmmmmmmm', 'mmmmmmmm', 'mpppppmm', '########']);
  // a grave slab's ground (flags-faced) across the pavement's line: setts where flags would lie
  assert.deepEqual(laid(['mmmmmmm', 'pppfffp', 'pppfffp', '.......']), ['mmmmmmm', 'pppmmmp', 'pppmmmp', '.......']);
  // the pavement's line through a lamp: the flags run on, though the open ground past it is nearer than the pavement's end
  assert.deepEqual(laid(['mmmmmmmmm', 'mmmooommm', 'mmmooommm', 'pppoooppp', '.........']), ['mmmmmmmmm', 'mmmmmmmmm', 'mmmmmmmmm', 'ppppppppp', '.........']);
  // none reaches it: bare
  assert.deepEqual(laid(['###', '#o#', '###']), ['###', '#_#', '###']);
  // the laws' corners, each the least grid that moves one of them (tools/mutants/propground.json, found by search):
  assert.deepEqual(laid(['coo', '#p#']), ['ccc', '#p#'], 'a tie between cobbles and flags the cobbles\'');
  assert.deepEqual(laid(['o.po', 'oopp']), ['_.pp', 'pppp'], 'a tie between flags and none the flags\'');
  assert.deepEqual(laid(['cycp.', 'pcooc', 'omopo']), ['cycp.', 'pcmmc', 'mmmpc'], 'a row and a column that disagree: the shorter');
  assert.deepEqual(laid(['ooy', 'm#.']), ['mmy', 'm#.'], 'the ring round the setts, across a corner');
  assert.deepEqual(laid(['ooc.', 'mppp']), ['ppc.', 'mppp'], 'the ring takes cobbles beside the setts too');
  assert.deepEqual(laid(['poc', 'oym']), ['pcc', '_ym'], 'a dropped slab the cobbles round it');
  assert.deepEqual([...propGround({ W: 3, H: 1 }, Uint8Array.of(K.main, K.built, K.main))], [0, 0, 0], 'no props on the grid');
});

test('PROP-GROUND the plan: a prop\'s cells stay built and carry the surface the laws lay, over the main streets\' own walks; a well in the main street\'s road leaves its pavement unbroken (mutants: the plan\'s `under` unlaid; the walks unpassed)', () => {
  // urban3_fabric.test.js's town: Daggerfall's road along tile row 8 of two blocks, the main street along it - a well in it
  const road = (r) => ((r >> 2) === 8 ? 46 : null);
  const b0 = block({ ground: (r) => road(r) ?? 1, rects: [[10, 24, 8, 24, 18], [40, 54, 30, 50, 18]], records: [at(40, 30)] });
  const b1 = block({ ground: (r) => road(r) ?? 1, rects: [[12, 26, 10, 30, 19], [42, 56, 20, 44, 20]] });
  const g = fabricGrid(2, 1, (bx) => (bx === 0 ? b0 : b1)), W = g.W;
  const plan = fabricPlan(g, { ends: [[0, 30], [W, 30]], centre: [W / 2, 30], seed: 1 });
  const walk = new Uint8Array(W * g.H);
  for (const p of plan.paths) for (const i of p) walk[i] = 1;
  assert.deepEqual([...plan.under], [...propGround(g, plan.kind, { walk, nearHouse: chamferField(g.house, W, g.H) })]);
  const cells = [];
  for (let i = 0; i < g.prop.length; i++) if (g.prop[i]) cells.push(i);
  assert.equal(cells.length, 9);
  for (const i of cells) { assert.equal(plan.kind[i], K.built, 'still built'); assert.ok(plan.under[i] === K.main || plan.under[i] === K.pave, `the street under it (${plan.under[i]})`); }
  for (let x = 36; x <= 44; x++) assert.equal(plan.kind[31 * W + x] === K.built ? plan.under[31 * W + x] : plan.kind[31 * W + x], K.pave, `the pavement at ${x}`);
  // a sett on no walk, a lone slab of the props' laid back onto it: the main streets' island law, run with their walks,
  // makes the three the pavement's; without the walks it never runs
  const isle = ['p.mo', 'pp.o', 'o.op'];
  assert.deepEqual(laid(isle, { walk: new Uint8Array(12) }), ['p.mp', 'pp.p', '_._p']);
  assert.deepEqual(laid(isle), ['p.mm', 'pp.m', '_._p']);
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
/** A plan as planSteps mints its street: the letters' kinds, `under` propGround's. */
function planOf(rows) {
  const code = { m: K.main, p: K.pave, c: K.side, '.': K.open, '#': K.built, o: K.built };
  const H = rows.length, W = rows[0].length, s = rows.join(''), kind = Uint8Array.from(s, (ch) => code[ch]);
  const under = propGround({ W, H, prop: Uint8Array.from(s, (ch) => (ch === 'o' ? 1 : 0)), house: Uint8Array.from(s, (ch) => (ch === '#' ? 1 : 0)) }, kind);
  return { W, H, kind, under, fences: [], gates: [], walls: [], dead: [], props: [], shut: new Uint8Array(W * H), paths: [], ends: [], centre: -1, counts: {} };
}

test('PROP-GROUND the model: setts, cobbles and flags laid over a prop\'s cells by the surface under them, a city\'s cobbles alone; a kerb from the flags down to the face laid past them - the setts, a prop\'s cobbles - or to the land, none onto a prop\'s bare ground (mutants: `under` unread; the cobbles read off the plan\'s kind; a kerb read off the plan\'s kind; a kerb onto cobbles hung; every kerb\'s foot hung)', () => {
  const k = URBAN_STYLE_KEYS.indexOf('granite') * 8, level = (y) => (t) => t.every((v) => Math.abs(v[1] - y) < 1e-6);
  const kerb = (road, land) => M * (road * (FABRIC_PAVE_Y - FABRIC_ROAD_Y) + land * (FABRIC_PAVE_Y - FABRIC_LAND_Y));
  const read = (m) => {
    const flags = faces(m, URBAN_ARCHIVE, k + URBAN_KINDS.flags);
    return { setts: sum(faces(m, URBAN_ARCHIVE, k + URBAN_KINDS.setts)) / M / M, cobbles: sum(faces(m, URBAN_ARCHIVE, k + URBAN_KINDS.cobbles)) / M / M, flags: sum(flags.filter(level(FABRIC_PAVE_Y))) / M / M, kerbs: sum(flags.filter((t) => !level(FABRIC_PAVE_Y)(t))) };
  };
  // between the setts and a cobbled side street (the laws' case): the prop's cells setts, flags, cobbles
  const cob = planOf(['mmmooocc', 'mmmooocc', 'mmmooocc', 'mmmooocc']);
  const city = read(townFabricModel(cob, 'granite', { cobbles: true }));
  assert.ok(Math.abs(city.setts - 16) < 1e-6 && Math.abs(city.flags - 4) < 1e-6 && Math.abs(city.cobbles - 12) < 1e-6, JSON.stringify(city));
  assert.ok(Math.abs(city.kerbs - kerb(8, 2)) < 1e-6, `a city's kerbs onto the setts and the prop's cobbles, its two ends to the land (${city.kerbs})`);
  const hamlet = read(townFabricModel(cob, 'granite', { cobbles: false }));
  assert.ok(hamlet.cobbles === 0 && Math.abs(hamlet.kerbs - kerb(4, 6)) < 1e-6, `a hamlet's side street Daggerfall's: its kerbs to the land (${hamlet.kerbs})`);
  // past the pavement onto open ground: no kerb onto the prop's bare cells, to the land onto the open ground
  const notch = read(townFabricModel(planOf(['mmmmmmmm', 'pppooopp', '...ooo..', '...ooo..']), 'granite'));
  assert.ok(Math.abs(notch.setts - 8) < 1e-6 && Math.abs(notch.flags - 8) < 1e-6 && Math.abs(notch.kerbs - kerb(8, 7)) < 1e-6, JSON.stringify(notch));
});

test('PROP-GROUND the faces and the lift: each cell\'s face as the model lays it (setts where the style lays a carriageway, cobbles on a city\'s side streets, flags), kept with the fabric; a flat stands on the face its cell is laid with, the land elsewhere (mutants: the planks\' setts; a hamlet\'s cobbles; the lift unread; the lift\'s faces swapped; the kept faces a hamlet\'s)', async () => {
  const F = FABRIC_FACE, p = planOf(['mpc.o', 'mpc.o']);
  p.under[4] = K.side; p.under[9] = K.pave;
  assert.deepEqual([...fabricFaces(p, 'granite', true).faces], [F.road, F.flags, F.road, F.none, F.road, F.road, F.flags, F.road, F.none, F.flags]);
  assert.deepEqual([...fabricFaces(p, 'granite', false).faces], [F.road, F.flags, F.none, F.none, F.none, F.road, F.flags, F.none, F.none, F.flags], 'a hamlet lays no cobbles');
  assert.deepEqual([...fabricFaces(p, 'planks', true).faces].slice(0, 5), [F.none, F.flags, F.none, F.none, F.none], 'the planks lay neither');
  const fab = { plan: { W: 5, H: 2 }, faces: fabricFaces(p, 'granite', true).faces }, near = (a, b) => Math.abs(a - b) < 1e-9;
  assert.ok(near(fabricLift(fab, 0.8, 0.8), 0.05) && near(fabricLift(fab, 1.6 + 0.8, 0.8), 0.13) && near(fabricLift(fab, 4 * 1.6 + 0.1, 1.6 + 1), 0.13));
  assert.equal(fabricLift(fab, 3 * 1.6 + 0.8, 0.8), 0, 'open ground: the land');
  assert.equal(fabricLift(fab, -0.1, 0.8), 0); assert.equal(fabricLift(fab, 0.8, 2 * 1.6 + 0.1), 0); assert.equal(fabricLift(null, 0.8, 0.8), 0);
  assert.ok(near(FABRIC_ROAD_Y - FABRIC_LAND_Y, 0.05) && near(FABRIC_LAND_Y, -2 * 0.025), 'the land 2 x 0.025 under the origin (scenes/pixelBuild.js locLocal)');
  // kept with the fabric: a city's faces lay its cobbles
  _resetTownFabrics();
  // Daggerfall's road along tile row 8 (the main street) and down tile column 3 of each block, far from it (a side street)
  const autoMapData = new Uint8Array(64 * 64), groundTiles = Array.from({ length: 16 }, (_, tx) => Array.from({ length: 16 }, (_, ty) => ({ textureRecord: ty === 8 || tx === 3 ? 46 : 1 })));
  const blocks = [0, 1].map((x) => ({ x, y: 0, blockName: 'RESIAA0' + x + '.RMB', dfBlock: { rmbBlock: { fldHeader: { autoMapData, groundData: { groundTiles } }, misc3dObjectRecords: [], miscFlatObjectRecords: [] } } }));
  const loc = { name: 'T', arena: { province: 'Skyrim' }, mapTableData: { mapId: 0xa7000777, locationType: LOCATION_TYPES.TownCity }, exterior: { exteriorData: { width: 2, height: 1, blockNames: ['RESIAA00.RMB', 'RESIAA01.RMB'] } } };
  const f = await townFabricFor(loc, blocks, { px: 1, py: 1 });
  assert.deepEqual([...f.faces], [...fabricFaces(f.plan, f.style, true).faces]);
  assert.ok([...f.plan.kind].some((kk, i) => kk === K.side && f.faces[i] === F.road), 'its side streets cobbled');
  _resetTownFabrics();
});

test('PROP-GROUND the host: the pixel build stands every block flat but the nature\'s - its misc flats, its StaticNPCs, its town horses and people, its animals\' and springs\' places - on the street its fabric lays (mutants: a flat unlifted; a StaticNPC unlifted)', () => {
  const pb = readFileSync(new URL('../../../src/scenes/pixelBuild.js', import.meta.url), 'utf8');
  assert.ok(pb.includes('const lift = fabricLift(fabric, b.originX + flat.x, b.originZ + flat.z);'));
  assert.equal(pb.split('blockY + flat.y + lift').length - 1, 4, 'the animals, the springs, the stand flats, the drawn flats');
  assert.equal((pb.match(/blockY \+ flat\.y(?! \+ lift)/g) ?? []).length, 0, 'no block flat stood on the land past it');
  assert.ok(pb.includes('y: blockY + npc.y + fabricLift(fabric, b.originX + npc.x, b.originZ + npc.z),'));
  assert.ok(pb.includes('locLocal[1] + flat.y + off'), 'the nature\'s flats keep their ground (NATURE-GROUND)');
});

test('PROP-GROUND a foot plate where its block stands it: the box round its rectangle turned and placed as RMBLayout places the model (mutants: the plate unturned)', () => {
  const r = (yRotation) => ({ modelIdNum: 41712, xPos: 1600, yPos: -4, zPos: -2000, xRotation: 0, yRotation, zRotation: 0 });
  const [x0, z0, x1, z1] = FOOT_FACED.road[41712], ox = 40, oz = (-2000 + 4096) * 0.025, near = (a, b) => a.every((v, i) => Math.abs(v - b[i]) < 1e-3);
  assert.ok(near(footPlate(r(0)), [ox + x0, oz + z0, ox + x1, oz + z1]));
  assert.ok(near(footPlate(r(512)), [ox - z1, oz + x0, ox - z0, oz + x1]), `a quarter turn (512 - ROTATION_DIVISOR's 90 degrees): ${footPlate(r(512))}`);
  assert.ok(near(footPlate(r(1024)), [ox - x1, oz - z1, ox - x0, oz - z0]), 'a half turn');
  assert.equal(footPlate({ ...r(0), modelIdNum: 41818 }), null);
});

test('PROP-GROUND with ARENA2: the foot-faced models measured again over every RMB block\'s misc models, each foot plate under its rectangle; over the cities and hamlets past the Bay and the capitals but the Imperial City, no prop whose ground the street closes round left bare - a lamp\'s own cell among them - and no lone flags; the Bay\'s towns dress none (mutants: the furniture unread; the slab law unlaid; the walks unpassed)', { skip: skipReal }, async () => {
  const { BlocksFile } = await import('../../../src/formats/blocksFile.js');
  const { MapsFile } = await import('../../../src/formats/mapsFile.js');
  const { Arch3dFile } = await import('../../../src/formats/arch3dFile.js');
  const { dfMeshToModel } = await import('../../../src/world/meshReader.js');
  const { patchSeams } = await import('../../../src/world/arch3dSeams.js');
  const { miscModelMatrix } = await import('../../../src/world/rmbLayout.js');
  const { arenaTemplates } = await import('../../../src/world/arenaLocations.js');
  const { outlineTownLocation } = await import('../../../src/world/townOutline.js');
  const { fabricBlockOf, fabricEnds, fabricTown } = await import('../../../src/world/urban/townFabricStand.js');
  const capitals = await import('../../../src/world/tamrielCapitals.js');
  const bytes = (n) => new Uint8Array(readFileSync(join(ARENA2, n)));
  const blocks = new BlocksFile(); blocks.load(bytes('BLOCKS.BSA'));
  const arch = new Arch3dFile(); arch.load(bytes('ARCH3D.BSA'));
  // the foot-faced models: an up face within 2 cm of a street face where the blocks place them
  const meshes = new Map(), mesh = (id) => { if (!meshes.has(id)) { const i = arch.getRecordIndex(id); meshes.set(id, i < 0 ? null : dfMeshToModel(patchSeams(id, arch.getMesh(i)), () => ({ width: 64, height: 64 }))); } return meshes.get(id); };
  const road = new Set(), flags = new Set();
  let plates = 0;
  for (let b = 0; b < blocks.count; b++) {
    const name = blocks.getBlockName(b);
    if (!/\.RMB$/i.test(name ?? '')) continue;
    for (const r of blocks.getBlockByName(name)?.rmbBlock?.misc3dObjectRecords ?? []) {
      const m = mesh(r.modelIdNum);
      if (!m) continue;
      const T = miscModelMatrix(r), P = m.positions, I = m.indices, plate = footPlate(r);
      const tf = (k) => [0, 1, 2].map((a) => T[a] * P[k * 3] + T[4 + a] * P[k * 3 + 1] + T[8 + a] * P[k * 3 + 2] + T[12 + a]);
      for (let t = 0; t < I.length; t += 3) {
        const v = [tf(I[t]), tf(I[t + 1]), tf(I[t + 2])], u = v[1].map((q, a) => q - v[0][a]), w = v[2].map((q, a) => q - v[0][a]);
        const n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]], L = Math.hypot(...n);
        if (L < 1e-6 || n[1] / L < 0.9 || Math.max(...v.map((p) => p[1])) - Math.min(...v.map((p) => p[1])) > 0.01) continue;
        if (Math.abs(v[0][1] - FABRIC_ROAD_Y) <= 0.02) {
          road.add(r.modelIdNum);
          assert.ok(plate && v.every((p) => p[0] >= plate[0] - 0.01 && p[0] <= plate[2] + 0.01 && p[2] >= plate[1] - 0.01 && p[2] <= plate[3] + 0.01), `${name} ${r.modelIdNum}: its plate under its rectangle`);
          plates++;
        } else if (Math.abs(v[0][1] - FABRIC_PAVE_Y) <= 0.02) flags.add(r.modelIdNum);
      }
    }
  }
  assert.deepEqual([...road].sort(), Object.keys(FOOT_FACED.road).map(Number).sort());
  assert.deepEqual([...flags].sort(), [...FOOT_FACED.flags].sort());
  assert.ok(plates > 20, `${plates} plate faces`);
  // the towns: every piece of a prop's ground (its clearance, its furniture's bytes on land) whose every side is a laid
  // street laid whole, and every piece of flags with a prop's cell in it a walk
  const maps = new MapsFile(); maps.load(bytes('MAPS.BSA'), bytes('CLIMATE.PAK'), bytes('POLITIC.PAK')); maps.autoDiscard = false;
  const rows = [];
  for (let r = 0; r < 62; r++) { const reg = maps.getRegion(r); if (!reg) continue; for (let l = 0; l < reg.locationCount; l++) { const loc = maps.getLocation(r, l); if (loc) rows.push(loc); } }
  const gridOf = (ed) => fabricGrid(ed.width, ed.height, (bx, by) => { const name = ed.blockNames[by * ed.width + bx]; return fabricBlockOf({ blockName: name, dfBlock: blocks.getBlockByName(blocks.checkName(name)) }); });
  const tally = { holes: 0, furniture: 0, lamps: 0, islands: 0, towns: 0 };
  const judge = (g, plan, cobbles, name) => {
    const n = g.W * g.H, laidK = (kk) => kk === K.main || kk === K.pave || (cobbles && kk === K.side);
    const surf = Uint8Array.from(plan.kind, (kk, i) => (kk === K.built && plan.under[i]) || kk);
    const { id, sizes } = labelPieces(g.W, g.H, g.prop), sides = sizes.map(() => ({ laid: 0, other: 0 }));
    for (let i = 0; i < n; i++) {
      if (id[i] < 0) continue;
      const x = i % g.W;
      for (const j of [x > 0 ? i - 1 : -1, x < g.W - 1 ? i + 1 : -1, i - g.W, i + g.W]) if (j >= 0 && j < n && plan.kind[j] !== K.built) sides[id[i]][laidK(plan.kind[j]) ? 'laid' : 'other']++;
    }
    for (let i = 0; i < n; i++) {
      if (id[i] < 0 || !sides[id[i]].laid || sides[id[i]].other) continue;
      assert.ok(laidK(surf[i]), `${name}: a prop's cell ${i} bare in the street`);
      tally.holes++;
    }
    const pv = labelPieces(g.W, g.H, Uint8Array.from(surf, (kk) => (kk === K.pave ? 1 : 0))), box = pv.sizes.map(() => [Infinity, Infinity, -Infinity, -Infinity, false]);
    for (let i = 0; i < n; i++) { const b = box[pv.id[i]]; if (!b) continue; const x = i % g.W, z = (i - x) / g.W; b[0] = Math.min(b[0], x); b[1] = Math.min(b[1], z); b[2] = Math.max(b[2], x); b[3] = Math.max(b[3], z); if (g.prop[i]) b[4] = true; }
    for (const b of box) if (b[4]) assert.ok(Math.max(b[2] - b[0], b[3] - b[1]) + 1 >= FABRIC.paveLeast, `${name}: a lone flag of a prop's`);
    tally.towns++;
  };
  const furnitureLaid = (g, plan, ed) => {
    for (let by = 0; by < ed.height; by++) for (let bx = 0; bx < ed.width; bx++) {
      const name = ed.blockNames[by * ed.width + bx], b = fabricBlockOf({ blockName: name, dfBlock: blocks.getBlockByName(blocks.checkName(name)) });
      if (!b) continue;
      for (let ay = 0; ay < 64; ay++) for (let ax = 0; ax < 64; ax++) { const i = (by * 64 + 63 - ay) * g.W + bx * 64 + ax; if ((b.automap[ay * 64 + ax] === 250 || b.automap[ay * 64 + ax] === 251) && plan.under[i]) tally.furniture++; }
      for (const f of blocks.getBlockByName(blocks.checkName(name)).rmbBlock.miscFlatObjectRecords ?? []) {
        const i = (by * 64 + Math.floor(((f.zPos + 4096) * 0.025) / M)) * g.W + bx * 64 + Math.floor((f.xPos * 0.025) / M);
        if (f.textureArchive === 210 && (f.textureRecord === 28 || f.textureRecord === 29) && plan.under[i]) tally.lamps++;
      }
    }
  };
  // the plan's props read over its main streets' own walks (the island law's)
  const walked = (g, plan) => {
    const walk = new Uint8Array(g.W * g.H);
    for (const p of plan.paths) for (const i of p) walk[i] = 1;
    assert.deepEqual([...plan.under], [...propGround(g, plan.kind, { walk, nearHouse: chamferField(g.house, g.W, g.H) })]);
    if (plan.paths.length && [...propGround(g, plan.kind, { nearHouse: chamferField(g.house, g.W, g.H) })].some((v, i) => v !== plan.under[i])) tally.islands++;
  };
  const t = arenaTemplates(rows), io = { classicOf: (nm) => blocks.readClassicBlock(blocks.getBlockIndex(blocks.checkName(nm))), servedOf: (nm) => blocks.getBlockByName(nm) };
  // every 23rd city and 61st hamlet, and Stoking (hamlet 410): one of four towns of 1,007 whose props the island law moves
  const sample = [];
  for (const [kind, every] of [['city-state', 23], ['town', 61]]) for (let j = 0; j < t[kind].length; j += every) sample.push([kind, j]);
  for (const [kind, j] of [...sample, ['town', 410]]) {
    const tpl = t[kind][j], mapId = ((0xa7 << 20) | (500000 + j)) >>> 0;
    const loc = outlineTownLocation({ ...tpl, mapTableData: { ...tpl.mapTableData, mapId } }, io), ed = loc.exterior.exteriorData, g = gridOf(ed);
    const { mains, ends, centre } = fabricEnds(loc, g.W, g.H), plan = fabricPlan(g, { ends, centre, mains, seed: mapId });
    judge(g, plan, kind === 'city-state', tpl.name);
    furnitureLaid(g, plan, ed);
    walked(g, plan);
  }
  for (let k = 1; k < capitals.CAPITALS.length; k++) {
    const cap = capitals.CAPITALS[k];
    const loc = capitals.synthesizeCapitalLocation({ cap, k }, { base: capitals.capitalBase(rows), names: capitals.cityBlockNames(rows), blockOf: (nm) => blocks.getBlockByName(nm) ?? null, px: 1000, py: 1000 });
    const ed = loc.exterior.exteriorData, g = gridOf(ed), { mains, ends, centre } = fabricEnds(loc, g.W, g.H);
    const plan = fabricPlan(g, { ends, centre, mains, seed: (loc.mapTableData?.mapId ?? 0) >>> 0 });
    judge(g, plan, true, cap.name);
    furnitureLaid(g, plan, ed);
  }
  assert.ok(tally.towns >= 26 && tally.holes > tally.towns * 20, JSON.stringify(tally));
  assert.ok(tally.furniture > 1000 && tally.lamps > 50, `the furniture's own cells laid (${JSON.stringify(tally)})`);
  assert.ok(tally.islands > 0, `the island law moves a town's props (${tally.islands})`);
  // the Bay's towns are Daggerfall's: no fabric, their props on the ground their blocks lay
  const bay = maps.getLocationByName('Daggerfall', 'Newcester');
  assert.ok(bay?.exterior?.exteriorData);
  assert.equal(fabricTown(bay), false);
});
