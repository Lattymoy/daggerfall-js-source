// TOWN-SHAPES TS4 (2026-10-25, the owner: "give other towns unique shapes. Its time to move away from perfect squares ...
// This needs to be perfection"; bible/03-World/Town-Shapes.md TS4): a city past the Bay walled on its own outline - its
// round's edge traced, Daggerfall's towers, walls and gates laid on it, a gate at each of its template's gates' bearings
// with a start marker outside it, the pieces one model of the town's own carried by its south-west cell, its ground its
// round and an apron.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { wallLine, traceRound, wallPieces, smoothRound, signedArea, townWall, townWallModel, townWallBlockJson, standTownWall, townWallBlockName, townWallBlockIndex, townWallModelId, isGateBlock, WALL_MODELS, TOWN_WALL } from '../../src/world/townWalls.js';
import { townRound, townShapeField, townTiles, isWallCarrier, tileDistance, WALL_ROUND } from '../../src/world/townShape.js';
import { outlineTownLocation, townOutlineBlockJson, TOWN_OUTLINE_BLOCK, TOWN_OUTLINE_BLOCK_INDEX } from '../../src/world/townOutline.js';
import { locationShapeField, setLocationTiles } from '../../src/world/terrain/terrainTiles.js';
import { blockFromJson, getNewDFBlockIndex } from '../../src/formats/worldData/worldDataReplacement.js';
import { hasCustomModel, customModelNeeds } from '../../src/world/customModels.js';

const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const ARENA2 = process.env.ARENA2_PATH;
const skipReal = !ARENA2 || !existsSync(join(ARENA2 ?? '', 'BLOCKS.BSA')) ? 'ARENA2_PATH not set or missing - real-data validation skipped' : false;
/** Whether (x, y) is inside a round (even-odd). */
function inRound(pts, x, y) {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}
/** A town of houses: a block of them with a notch out of a corner, and a second block across a lane narrower than two closes. */
function notchTown() {
  const W = 90, H = 70, occ = new Uint8Array(W * H);
  for (let y = 20; y < 50; y++) for (let x = 20; x < 60; x++) if (!(x > 45 && y > 38)) occ[y * W + x] = 1;
  for (let y = 24; y < 40; y++) for (let x = 64; x < 70; x++) occ[y * W + x] = 1;   // across a four-tile lane
  return { W, H, occ };
}

test('TS4 the round: every building inside its line, a lane under two closes the town\'s, its holes filled - the line traced whole (no step longer than a tile and a half), counter-clockwise, out past every house by its line (mutants: the gap open; a saddle\'s corners swapped; the cut on the grid)', () => {
  const { W, H, occ } = notchTown();
  const { inside, level } = townRound(occ, W, H);
  for (let i = 0; i < occ.length; i++) if (occ[i]) assert.equal(inside[i], 1, 'a house inside');
  assert.equal(inside[30 * W + 62], 1, 'the lane between the two blocks');
  assert.ok(level[30 * W + 40] > 0 && level[5 * W + 5] < 0);
  const line = wallLine(occ, W, H);
  assert.ok(line.length > 100);
  assert.ok(signedArea(line) > 0, 'counter-clockwise');
  for (let i = 0; i < line.length; i++) { const a = line[i], b = line[(i + 1) % line.length]; assert.ok(Math.hypot(b[0] - a[0], b[1] - a[1]) < 1.5, `whole at ${i}`); }
  for (let i = 0; i < occ.length; i++) if (occ[i]) assert.ok(inRound(line, (i % W) + 0.5, Math.floor(i / W) + 0.5), 'every house inside the line');
  const d = tileDistance(occ, W, H);
  for (const [x, y] of line) assert.ok(d[Math.floor(y) * W + Math.floor(x)] >= WALL_ROUND.line - 1.2, `the line out past the houses at (${x.toFixed(1)}, ${y.toFixed(1)})`);
  const hole = new Uint8Array(W * H);
  for (let y = 10; y < 40; y++) for (let x = 10; x < 40; x++) if (x < 14 || x > 35 || y < 14 || y > 35) hole[y * W + x] = 1;
  assert.equal(townRound(hole, W, H).inside[25 * W + 25], 1, 'a square inside a ring of houses wider than any close');
  assert.deepEqual(wallLine(new Uint8Array(16), 4, 4), []);
  // a saddle: two tiles inside on a diagonal - joined where the cell's middle is inside, apart where it is not
  const saddle = (hi, lo) => (x, y) => ((x === 2 && y === 1) || (x === 1 && y === 2) ? hi : lo);
  const joined = traceRound(saddle(1, -0.3), 4, 4), apart = traceRound(saddle(0.2, -1), 4, 4);
  assert.ok(inRound(joined, 2.5, 1.5) && inRound(joined, 1.5, 2.5), 'joined through the middle: one round round both');
  assert.ok(inRound(apart, 2.5, 1.5) !== inRound(apart, 1.5, 2.5), 'apart: a round round one');
  for (const r of [joined, apart]) for (let i = 0; i < r.length; i++) { const a = r[i], b = r[(i + 1) % r.length]; assert.ok(Math.hypot(b[0] - a[0], b[1] - a[1]) < 1.5, 'whole'); }
});

test('TS4 the pieces: a gate at each gate\'s bearing, towers at every chord\'s end, every piece out from the middle, its length stretched little; a gate too near the last passed over; no gate one run round (mutants: the normal turned in; the run uncounted; gates unspaced; a crowded gate dropped)', () => {
  const R = 150, n = 360, ring = Array.from({ length: n }, (_, i) => /** @type {[number, number]} */ ([R * Math.cos((2 * Math.PI * i) / n), R * Math.sin((2 * Math.PI * i) / n)]));
  const gates = [[0, 200], [200, 0], [0, -200], [-200, 0]];
  const pieces = wallPieces(ring, [0, 0], gates);
  const gp = pieces.filter((p) => p.model === WALL_MODELS.gate);
  assert.equal(gp.length, 4);
  for (const g of gates) {
    const b = Math.atan2(g[1], g[0]);
    assert.ok(gp.some((p) => Math.abs(Math.atan2(Math.sin(Math.atan2(p.at[1], p.at[0]) - b), Math.cos(Math.atan2(p.at[1], p.at[0]) - b))) < (TOWN_WALL.piece / R)), `a gate at bearing ${(b * 180 / Math.PI).toFixed(0)}`);
  }
  for (const p of pieces) {
    assert.ok(p.out[0] * p.at[0] + p.out[1] * p.at[1] > 0, 'out from the middle');
    if (p.model !== WALL_MODELS.tower) assert.ok(p.stretch > 0.8 && p.stretch < 1.2, `stretched little (${p.stretch.toFixed(3)})`);
  }
  const towers = pieces.filter((p) => p.model === WALL_MODELS.tower), walls = pieces.filter((p) => p.model === WALL_MODELS.wall);
  assert.ok(Math.abs(walls.length - (2 * Math.PI * R - 4 * TOWN_WALL.piece) / TOWN_WALL.piece) <= 4, `the round's lengths (${walls.length})`);
  assert.ok(Math.abs(towers.length - (walls.length / TOWN_WALL.run + 4)) <= 3, `a tower every ${TOWN_WALL.run} lengths and either side of each gate (${towers.length})`);
  const crowded = wallPieces(ring, [0, 0], [[0, 200], [5, 200]]).filter((p) => p.model === WALL_MODELS.gate);
  assert.equal(crowded.length, 2, 'two gates a length apart: both');
  assert.ok(Math.hypot(crowded[0].at[0] - crowded[1].at[0], crowded[0].at[1] - crowded[1].at[1]) > TOWN_WALL.piece * (TOWN_WALL.run + 1), 'the second slid on along the wall');
  const tiny = Array.from({ length: 60 }, (_, i) => /** @type {[number, number]} */ ([40 * Math.cos((2 * Math.PI * i) / 60), 40 * Math.sin((2 * Math.PI * i) / 60)]));
  assert.ok(wallPieces(tiny, [0, 0], gates).filter((p) => p.model === WALL_MODELS.gate).length < 4, 'no room round a small round: the last passed over');
  const none = wallPieces(ring, [0, 0], []);
  assert.equal(none.filter((p) => p.model === WALL_MODELS.gate).length, 0);
  assert.ok(none.filter((p) => p.model === WALL_MODELS.wall).length > 30, 'one run round');
  assert.equal(smoothRound([[0, 0], [4, 0], [4, 4], [0, 4]]).length, 16);
});

test('TS4 the model: each piece turned so its local +z is its outward normal and its +x along the line (no mirror), stretched along its length, at its centre (mutants: the turn mirrored; the stretch unread)', () => {
  // one triangle in the piece's frame: its face toward +z (outside), a corner at the piece's +x end
  const tri = { positions: Float32Array.from([12.8, 0, 4.8, -12.8, 0, 4.8, 12.8, 10, 4.8]), normals: Float32Array.from([0, 0, 1, 0, 0, 1, 0, 0, 1]), uvs: new Float32Array(6), indices: Uint32Array.from([0, 2, 1]), subMeshes: [{ textureArchive: 317, textureRecord: 2, startIndex: 0, primitiveCount: 1 }] };
  const m = townWallModel([{ model: WALL_MODELS.wall, at: [100, 50], out: [1, 0], stretch: 1.1 }], () => tri);
  const p = (v) => [...m.positions.slice(v * 3, v * 3 + 3)].map((x) => Math.round(x * 1000) / 1000);
  // out east: local +z -> +x; local +x -> u = (w.z, -w.x) = (0, -1): south
  assert.deepEqual(p(0), [104.8, 0, 50 - 12.8 * 1.1]);
  assert.deepEqual(p(1), [104.8, 0, 50 + 12.8 * 1.1]);
  assert.deepEqual([...m.normals.slice(0, 3)].map((x) => Math.round(x * 1000) / 1000), [1, 0, 0]);
  // the winding still faces its normal: the triangle (0, 2, 1) wound toward its +z in the piece's frame, toward +x here
  const [a, b, c] = [0, 1, 2].map((k) => p(m.indices[k]));
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  assert.ok(u[1] * v[2] - u[2] * v[1] > 0, 'no mirror: the face keeps its side');
  assert.equal(m.subMeshes[0].textureArchive, 317);
});

test('TS4 the ground: a walled city past the Bay stands on its round - every tile of it and its apron the town\'s own (coded 1: kept on water too) - its carrier\'s model and markers shaping none; an unwalled town as before (mutants: the round unread; the apron uncoded; the carrier shaping)', () => {
  const occ = new Uint8Array(60 * 60);
  for (let y = 20; y < 40; y++) for (let x = 20; x < 40; x++) occ[y * 60 + x] = 1;
  const f = townShapeField(occ, 60, 60, 7, { core: 3 });
  assert.equal(f[30 * 60 + 18], 1, 'two tiles out: the core');
  assert.ok(f[30 * 60 + 15] !== 1, 'five out: the margin, coded its distance');
  // a walled loc: one block of houses (its whole middle) in a 3 x 3 grid, its ring open, its corner the carrier
  const houses = new Uint8Array(4096);
  for (let r = 8; r < 56; r++) for (let c = 8; c < 56; c++) houses[r * 64 + c] = 5;
  const rmbs = { H: { fldHeader: { autoMapData: houses }, misc3dObjectRecords: [], miscFlatObjectRecords: [] }, C: { fldHeader: { autoMapData: new Uint8Array(4096) }, misc3dObjectRecords: [{ xPos: 0, zPos: -4096 }], miscFlatObjectRecords: [{ xPos: 40000, zPos: -4096 }] } };
  const names = ['TESW1.RMB', TOWN_OUTLINE_BLOCK, TOWN_OUTLINE_BLOCK, TOWN_OUTLINE_BLOCK, 'H.RMB', TOWN_OUTLINE_BLOCK, TOWN_OUTLINE_BLOCK, TOWN_OUTLINE_BLOCK, TOWN_OUTLINE_BLOCK];
  const loc = (walled) => ({ name: 'W', mapTableData: { mapId: 1, locationType: 0 }, exterior: { exteriorData: { width: 3, height: 3, blockNames: names } }, ...(walled ? { outline: { kept: 1, left: 8, walled: true } } : {}) });
  const rmbOf = (bx, by) => { const n = names[by * 3 + bx]; return n === 'H.RMB' ? rmbs.H : null; };
  const walled = locationShapeField(loc(true), rmbOf, { x: 40, y: 40 }), open = locationShapeField(loc(false), rmbOf, { x: 40, y: 40 });
  const count = (a, f2) => a.reduce((s2, v) => s2 + (f2(v) ? 1 : 0), 0);
  assert.ok(count(walled, (v) => v === 1) > count(open, (v) => v === 1) * 1.3, 'the round and its apron the town\'s own');
  assert.ok(count(walled, (v) => v > 0) >= count(open, (v) => v > 0), 'and no less ground');
  // six tiles out from the houses (town tile 12 of the block's 18..29): the wall's line two and a half out, its apron to seven
  assert.equal(walled[(40 + 12) + (40 + 24) * 128], 1, 'six out: on the walled city\'s own ground');
  assert.notEqual(open[(40 + 12) + (40 + 24) * 128], 1, 'an unwalled town\'s margin there');
  // the carrier's records shape none (setLocationTiles reads past it)
  const block = (n) => ({ name: n, rmbBlock: { ...(n === 'H.RMB' ? rmbs.H : n.startsWith('TESW') ? rmbs.C : { fldHeader: { autoMapData: new Uint8Array(4096) }, misc3dObjectRecords: [], miscFlatObjectRecords: [] }), fldHeader: { ...(n === 'H.RMB' ? rmbs.H.fldHeader : { autoMapData: new Uint8Array(4096) }), groundData: { groundTiles: Array.from({ length: 16 }, () => Array.from({ length: 16 }, () => ({ textureRecord: 2, tileBitfield: 2 }))) } } } });
  const file = { checkName: (n) => n, getBlockIndex: (n) => names.indexOf(n), getBlock: (i) => block(names[i]) };
  const rect = setLocationTiles(loc(true), { getRmbBlockName: (l, bx, by) => names[by * 3 + bx] }, file, new Uint8Array(128 * 128));
  const tp = { x: 64 - 24, y: 64 - 24 };
  assert.equal(rect.shape[(tp.x + 1) + (tp.y + 1) * 128], 0, 'the carrier\'s corner is no ground of the town\'s');
  assert.ok(isWallCarrier('TESWAPT3.RMB') && !isWallCarrier('TESAOPEN.RMB') && !isWallCarrier('WALLAA02.RMB'));
});

test('TS4 standing a wall: the outlined city\'s south-west cell its carrier, the carrier on the door at its index (open ground, the wall\'s model at its corner, its markers), the model registered on the player\'s ARCH3D pieces; once a city; the host stands it for a walled clone (mutants: the corner open; the host unwired; the markers unlaid)', () => {
  const json = townWallBlockJson('TESWX.RMB', 3500001, [[10, 20]], townOutlineBlockJson);
  const b = blockFromJson(json, 1500001);
  assert.deepEqual(b.rmbBlock.misc3dObjectRecords.map((m) => [m.modelIdNum, m.xPos, m.zPos]), [[3500001, 0, -4096]]);
  assert.deepEqual(b.rmbBlock.miscFlatObjectRecords.map((f) => [f.textureArchive, f.textureRecord, f.xPos, f.zPos]), [[199, 10, 400, 800 - 4096]]);
  assert.ok(b.rmbBlock.fldHeader.groundData.groundTiles.flat().every((t) => t.textureRecord >= 56), 'open ground');
  assert.equal(townWallBlockName(((0xa7 << 20) | 500007) >>> 0), 'TESWAPT3.RMB');
  assert.deepEqual([townWallBlockIndex(((0xa7 << 20) | 500007) >>> 0), townWallModelId(((0xa7 << 20) | 500007) >>> 0)], [1500007, 3500007]);
  assert.ok(townWallBlockIndex(0xfffff) > TOWN_OUTLINE_BLOCK_INDEX);
  assert.deepEqual([isGateBlock('WALLAA08.RMB'), isGateBlock('WALLAA11.RMB'), isGateBlock('WALLAA04.RMB')], [true, true, false]);
  // a synthetic walled city stood: one block of houses in the middle of a 3 x 3 ring, its gates on two sides
  const houses = new Uint8Array(4096);
  for (let r = 8; r < 56; r++) for (let c = 8; c < 56; c++) houses[r * 64 + c] = 5;
  const gate = (z) => ({ subRecords: [{ xPos: 2048, zPos: z, exterior: { block3dObjectRecords: [{ modelIdNum: 446 }] } }] });
  const served = { 'H.RMB': { rmbBlock: { fldHeader: { autoMapData: houses }, misc3dObjectRecords: [], miscFlatObjectRecords: [], subRecords: [] } }, 'WALLAA08.RMB': { rmbBlock: gate(3584) }, 'WALLAA10.RMB': { rmbBlock: gate(512) } };
  const template = ['WALLAA02.RMB', 'WALLAA10.RMB', 'WALLAA03.RMB', 'WALLAA07.RMB', 'H.RMB', 'WALLAA05.RMB', 'WALLAA00.RMB', 'WALLAA08.RMB', 'WALLAA01.RMB'];
  const mapId = ((0xa7 << 20) | 500321) >>> 0;
  const loc = { name: 'Walled', mapTableData: { mapId }, exterior: { exteriorData: { width: 3, height: 3, blockNames: [townWallBlockName(mapId), ...template.slice(1).map((n) => (n === 'H.RMB' ? n : TOWN_OUTLINE_BLOCK))] } }, outline: { kept: 1, left: 8, walled: true } };
  const wall = standTownWall(loc, template, (n) => served[n] ?? null, townOutlineBlockJson);
  assert.ok(wall, 'stood');
  assert.equal(wall.gates.length, 2);
  assert.equal(wall.pieces.filter((p) => p.model === WALL_MODELS.gate).length, 2);
  assert.equal(wall.markers.length, 2);
  for (const m of wall.markers) assert.ok(!inRound(wall.line, m[0], m[1]), 'a marker outside the wall, where Daggerfall stands them');
  for (let r = 8; r < 56; r += 6) for (let c = 8; c < 56; c += 6) assert.ok(inRound(wall.line, 102.4 + (c + 0.5) * 1.6, 102.4 + (63 - r + 0.5) * 1.6), 'every house inside');
  assert.equal(getNewDFBlockIndex(townWallBlockName(mapId)), townWallBlockIndex(mapId));
  assert.ok(hasCustomModel(townWallModelId(mapId)));
  assert.deepEqual([...customModelNeeds(townWallModelId(mapId))].sort(), [444, 445, 446]);
  assert.equal(standTownWall(loc, template, (n) => served[n] ?? null, townOutlineBlockJson), null, 'once a city');
  const h = rd('src/scenes/tamrielPlacesHost.js');
  assert.match(h, /const loc = outlineTownLocation\(synthesizeArenaLocation\([^\n]+\n\s+if \(loc\.outline\?\.walled\) standTownWall\(loc, template\.exterior\.exteriorData\.blockNames, blockOf, townOutlineBlockJson\);/);   // PIN MOVED (TS7): its blocks both ways - what stands at its gates the game's own
  assert.match(rd('src/world/townOutline.js'), /const open = \(i\) => \(walled && i === 0 \? townWallBlockName\(seed\) : TOWN_OUTLINE_BLOCK\);/);
});

test('TS4 with ARENA2: every city past the Bay walled on its outline - every kept building inside its wall, a gate at each of its template\'s four, a marker outside each on the town\'s ground, the wall on the town\'s ground (mutants: the gates unread; the apron unlaid)', { skip: skipReal }, async () => {
  const { BlocksFile } = await import('../../src/formats/blocksFile.js');
  const { MapsFile } = await import('../../src/formats/mapsFile.js');
  const { arenaTemplates } = await import('../../src/world/arenaLocations.js');
  const bytes = (n) => new Uint8Array(readFileSync(join(ARENA2, n)));
  const blocks = new BlocksFile(); blocks.load(bytes('BLOCKS.BSA'));
  const maps = new MapsFile(); maps.load(bytes('MAPS.BSA'), bytes('CLIMATE.PAK'), bytes('POLITIC.PAK')); maps.autoDiscard = false;
  const rows = [];
  for (let r = 0; r < 62; r++) { const reg = maps.getRegion(r); if (!reg) continue; for (let l = 0; l < reg.locationCount; l++) { const loc = maps.getLocation(r, l); if (loc) rows.push(loc); } }
  const cities = arenaTemplates(rows)['city-state'];
  const io = { classicOf: (n) => blocks.readClassicBlock(blocks.getBlockIndex(blocks.checkName(n))), servedOf: (n) => blocks.getBlockByName(n) };
  const rmbOf = (n) => (isWallCarrier(n) || n === TOWN_OUTLINE_BLOCK ? null : blocks.getBlockByName(n)?.rmbBlock ?? null);
  for (let j = 0; j < cities.length; j += 9) {
    const t = cities[j], mapId = ((0xa7 << 20) | (500000 + j)) >>> 0;
    const loc = outlineTownLocation({ ...t, mapTableData: { ...t.mapTableData, mapId } }, io);
    const wall = townWall(loc, t.exterior.exteriorData.blockNames, rmbOf);
    assert.ok(wall, t.name);
    assert.equal(wall.pieces.filter((p) => p.model === WALL_MODELS.gate).length, 4, `${t.name}: its four gates`);
    const ed = loc.exterior.exteriorData;
    const occ = townTiles(ed.width, ed.height, (bx, by) => rmbOf(ed.blockNames[by * ed.width + bx]));
    const W = ed.width * 16;
    for (let i = 0; i < occ.length; i += 7) if (occ[i]) assert.ok(inRound(wall.line, ((i % W) + 0.5) * 6.4, (Math.floor(i / W) + 0.5) * 6.4), `${t.name}: a building inside`);
    // the ground: the round and its apron, as the terrain stamps it
    const PAD = 12, PW = W + 2 * PAD, PH = ed.height * 16 + 2 * PAD, padded = new Uint8Array(PW * PH);
    for (let y = 0; y < ed.height * 16; y++) padded.set(occ.subarray(y * W, (y + 1) * W), (y + PAD) * PW + PAD);
    const field = townShapeField(townRound(padded, PW, PH).inside, PW, PH, mapId, { core: WALL_ROUND.apron });
    const on = ([x, z]) => field[(Math.floor(z / 6.4) + PAD) * PW + Math.floor(x / 6.4) + PAD] === 1;
    for (const m of wall.markers) { assert.ok(!inRound(wall.line, m[0], m[1]), `${t.name}: a marker outside`); assert.ok(on(m), `${t.name}: on the town's own ground`); }
    for (const p of wall.pieces) assert.ok(on(p.at), `${t.name}: its wall on its ground`);
  }
});
