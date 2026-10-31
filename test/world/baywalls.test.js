// TOWN-SHAPES TS7 (2026-10-25, the owner: "Do all the open items"; bible/03-World/Town-Shapes.md TS7): the Bay's walled
// cities walled on their outline as the door reads them (their ring open, their wall's carrier in its corner, every
// building kept), the places past the Bay cloning them as they were; what stood at Daggerfall's gates - the two bulletin
// boards, Immersive Travel's carriage and driver - carried to each new gate and stood clear of its towers; a town's yards
// on its own ground.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { wallBayCity, unwalledLocation, outlineTownLocation, townOutlineBlockJson, TOWN_OUTLINE_BLOCK } from '../../src/world/townOutline.js';
import { townWall, townWallCells, townWallCellsOf, townWallBlockName, townWallBlockIndex, gateFurniture, townBlockedCells, townWalkShut, registerTownWall, GATE_CLEAR, WALL_MODELS } from '../../src/world/townWalls.js';
import { carriageRecordsOf, installImmersiveTravelGates, hasCarriageGate } from '../../src/world/immersiveTravelGates.js';
import { getNewDFBlockIndex, installWorldDataReplacement } from '../../src/formats/worldData/worldDataReplacement.js';
import { setLocationTiles } from '../../src/world/terrain/terrainTiles.js';
import { townGroundOf } from '../../src/world/merchantYards/merchantYardSites.js';
import { CityNavigation } from '../../src/world/city/cityNavigation.js';
import { isWallCarrier, townTiles, townShapeField, townRound, WALL_ROUND } from '../../src/world/townShape.js';

const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const ARENA2 = process.env.ARENA2_PATH;
const skipReal = !ARENA2 || !existsSync(join(ARENA2 ?? '', 'BLOCKS.BSA')) ? 'ARENA2_PATH not set or missing - real-data validation skipped' : false;
const RING = ['WALLAA02.RMB', 'WALLAA10.RMB', 'WALLAA03.RMB', 'WALLAA07.RMB', 'H.RMB', 'WALLAA05.RMB', 'WALLAA00.RMB', 'WALLAA08.RMB', 'WALLAA01.RMB'];
const city = (names, mapId = 4321) => ({ name: 'Bayton', mapTableData: { mapId }, exterior: { buildings: [], exteriorData: { width: 3, height: 3, blockNames: names.slice() } } });
const door = { getBlockByName: () => null, getBlockIndex: () => -1, checkName: (n) => n, readClassicBlock: () => null };
const inRound = (pts, x, y) => { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; };

test('TS7 a Bay city read: a ring of Daggerfall\'s wall blocks and only them opened, its south-west corner its wall\'s carrier on the door, its own grid kept, walled; once; a ring a mod rebuilt, a wall inside, a capital and no door each left as read; its template as it was (mutants: the ring unread; the corner open; the grid unkept; a composite taken; a template reader unwalled none)', async () => {
  installWorldDataReplacement();
  const loc = city(RING, 4321);
  assert.equal(wallBayCity(loc, null, door), true);
  const names = loc.exterior.exteriorData.blockNames;
  assert.deepEqual(names, [townWallBlockName(4321), TOWN_OUTLINE_BLOCK, TOWN_OUTLINE_BLOCK, TOWN_OUTLINE_BLOCK, 'H.RMB', TOWN_OUTLINE_BLOCK, TOWN_OUTLINE_BLOCK, TOWN_OUTLINE_BLOCK, TOWN_OUTLINE_BLOCK]);
  assert.deepEqual(loc.exterior.exteriorData.wallTook, RING);
  assert.deepEqual({ ...loc.outline }, { kept: 1, left: 8, walled: true, bay: true });
  assert.equal(getNewDFBlockIndex(townWallBlockName(4321)), townWallBlockIndex(4321), 'its carrier on the door');
  assert.equal(wallBayCity(loc, null, door), false, 'once');
  const again = city(RING, 4321);
  assert.equal(wallBayCity(again, null, door), true, 'read again: edited again, its wall registered once');
  assert.equal(wallBayCity(city(RING.map((n) => (n === 'WALLAA08.RMB' ? 'WALLAA08.FARMAA00.RMB' : n)), 4322), null, door), false, 'Beautiful Cities\' composite: its ring kept');
  assert.equal(wallBayCity(city(RING.map((n) => (n === 'H.RMB' ? 'WALLAA04.RMB' : n)), 4323), null, door), false, 'a wall inside');
  assert.equal(wallBayCity(city(RING.map((n) => (n === 'WALLAA05.RMB' ? 'H.RMB' : n)), 4324), null, door), false, 'a ring broken');
  assert.equal(wallBayCity({ ...city(RING, 4325), capital: true }, null, door), false, 'a capital');
  assert.equal(wallBayCity(city(RING, 4326), null, null), false, 'no door');
  const back = unwalledLocation(loc);
  assert.deepEqual(back.exterior.exteriorData.blockNames, RING);
  assert.equal(back.outline, undefined);
  assert.equal(back.exterior.exteriorData.wallTook, undefined);
  assert.equal(unwalledLocation(city(['H.RMB'])).name, 'Bayton');
  const plain = city(['H.RMB']);
  assert.equal(unwalledLocation(plain), plain, 'any other location itself');
  // the places past the Bay clone it as it was: every template reader, and the outline's own read
  const { arenaTemplates } = await import('../../src/world/arenaLocations.js');
  const { countryTemplates } = await import('../../src/world/tamrielCountry.js');
  const { capitalBase, cityBlockNames } = await import('../../src/world/tamrielCapitals.js');
  const row = { ...loc, mapTableData: { ...loc.mapTableData, locationType: 0 } };
  assert.deepEqual(arenaTemplates([row])['city-state'][0].exterior.exteriorData.blockNames, RING);
  assert.deepEqual(countryTemplates([{ ...row, mapTableData: { ...row.mapTableData, locationType: 2 } }]).get(2)[0].exterior.exteriorData.blockNames, RING);
  assert.deepEqual(capitalBase([row]).exterior.exteriorData.blockNames, RING);
  assert.deepEqual([...cityBlockNames([row]).keys()].sort(), ['H.RM']);
  assert.match(rd('src/world/townOutline.js'), /dfLocation = unwalledLocation\(dfLocation\);/);
  const served = (n) => (n === 'H.RMB' ? { rmbBlock: { fldHeader: { autoMapData: new Uint8Array(4096).fill(5), numBlockDataRecords: 0, buildingDataList: [] }, subRecords: [], misc3dObjectRecords: [], miscFlatObjectRecords: [] } } : null);
  const io = { classicOf: served, servedOf: served };
  const tmpl = { ...city(RING, 77), exterior: { buildings: [], exteriorData: { width: 3, height: 3, blockNames: RING.slice() } } };
  const edited = city(RING, 77);
  wallBayCity(edited, null, door);
  assert.deepEqual(outlineTownLocation({ ...edited, mapTableData: { mapId: 99 } }, io).exterior.exteriorData.blockNames, outlineTownLocation({ ...tmpl, mapTableData: { mapId: 99 } }, io).exterior.exteriorData.blockNames, 'a clone of it the clone of its template');
  // its wall made when first asked: a house in the middle, gates north and south (the walk grid's cells, the town map's)
  const houses = new Uint8Array(4096);
  for (let r = 8; r < 56; r++) for (let c = 8; c < 56; c++) houses[r * 64 + c] = 5;
  const gate = (z) => ({ rmbBlock: { subRecords: [{ xPos: 2048, zPos: z, yRotation: 0, exterior: { block3dObjectRecords: [{ modelIdNum: 446, xPos: 0, zPos: -64 }] } }], misc3dObjectRecords: [], miscFlatObjectRecords: [] } });
  const blocks = { 'H.RMB': { rmbBlock: { fldHeader: { autoMapData: houses }, misc3dObjectRecords: [], miscFlatObjectRecords: [], subRecords: [] } }, 'WALLAA08.RMB': gate(3584), 'WALLAA10.RMB': gate(512) };
  const lazy = city(RING, 4400);
  assert.equal(wallBayCity(lazy, null, { ...door, getBlockByName: (n) => blocks[n] ?? null }), true);
  const cells = townWallCellsOf(lazy);
  assert.ok(cells && cells.some(Boolean), 'its wall made when its cells are asked');
  assert.deepEqual([...cells], [...townWallCells(townWall(lazy, RING, (n) => blocks[n]?.rmbBlock ?? null), 3, 3)]);
  // the door edits every read with it, after the Arena's
  assert.match(rd('src/world/townOutline.js'), /registerPortBlock\(TOWN_OUTLINE_BLOCK, \(\) => townOutlineBlockJson\(\), TOWN_OUTLINE_BLOCK_INDEX\);\n\s+registerLocationEdit\(wallBayCity\);/);
});

test('TS7 what stands at a gate: the template gate\'s own records - the game\'s block, Immersive Travel\'s while loaded - carried from its frame to the new gate\'s and turned with it, its start marker TS4\'s; each gate its nearest template gate, once (mutants: the frame unturned; the turn unread; the marker carried; the extra unread)', () => {
  // a template gate facing north at (38.4, 11.2) of its block at (0, 204.8); the new gate faces east at (300, 150)
  const wall = { middle: [150, 150], frames: [{ name: 'WALLAA08.RMB', block: [0, 204.8], at: [38.4, 216], out: [0, 1] }], pieces: [{ model: WALL_MODELS.gate, at: [300, 150], out: [1, 0], stretch: 1 }] };
  // a board 6.4 m west of the gate and 4 m inside it; a marker outside it
  const board = { modelId: '41739', modelIdNum: 41739, objectType: 0, xPos: (38.4 - 6.4) / 0.025, yPos: -55, zPos: (216 - 204.8 - 4) / 0.025 - 4096, xRotation: 0, yRotation: 100, zRotation: 0 };
  const marker = { position: 0, xPos: 1410, yPos: -4, zPos: -2977, textureArchive: 199, textureRecord: 10, factionID: 0, flags: 0 };
  const block = { name: 'WALLAA08.RMB', rmbBlock: { fldHeader: { numBlockDataRecords: 0, numMisc3dObjectRecords: 1, numMiscFlatObjectRecords: 1, buildingDataList: [], groundData: { groundTiles: [], groundScenery: [] }, autoMapData: new Uint8Array(4096) }, subRecords: [], misc3dObjectRecords: [board], miscFlatObjectRecords: [marker] } };
  const driver = { Position: 7, XPos: (38.4 + 2) / 0.025, YPos: -2, ZPos: (216 - 204.8 + 9) / 0.025 - 4096, TextureArchive: 184, TextureRecord: 25, FactionID: 8642, Flags: 0 };
  const f = gateFurniture(wall, (n) => (n === 'WALLAA08.RMB' ? block : null), (n) => (n === 'WALLAA08.RMB' ? { Misc3dObjectRecords: [], MiscFlatObjectRecords: [driver] } : null));
  assert.equal(f.models.length, 1);
  const at = (r) => [r.XPos * 0.025, (r.ZPos + 4096) * 0.025];
  // west (along -6.4) turns to north of an east gate; inside (-4) to its west
  assert.deepEqual(at(f.models[0]).map((v) => Math.round(v * 10) / 10), [296, 156.4]);
  assert.equal(f.models[0].YRotation, 100 - 512, 'turned a quarter clockwise with its gate');
  assert.equal(f.flats.length, 1, 'the start marker TS4\'s own, the driver carried');
  assert.equal(f.flats[0].FactionID, 8642);
  assert.deepEqual(at(f.flats[0]).map((v) => Math.round(v * 10) / 10), [309, 148], 'outside, two along: to the south');
  // two gates and two frames: each its nearest by bearing
  const two = { middle: [0, 0], frames: [{ name: 'A', block: [0, 0], at: [0, 100], out: [0, 1] }, { name: 'B', block: [0, 0], at: [100, 0], out: [1, 0] }], pieces: [{ model: WALL_MODELS.gate, at: [90, 10], out: [1, 0], stretch: 1 }, { model: WALL_MODELS.gate, at: [5, 95], out: [0, 1], stretch: 1 }] };
  const asked = [];
  // each a board 3 m inside its own gate
  const boardOf = (x, z, rot) => ({ rmbBlock: { misc3dObjectRecords: [{ modelId: '41739', modelIdNum: 41739, objectType: 0, xPos: x / 0.025, yPos: 0, zPos: z / 0.025 - 4096, xRotation: 0, yRotation: rot, zRotation: 0 }], miscFlatObjectRecords: [] } });
  const placed = gateFurniture(two, (n) => { asked.push(n); return n === 'A' ? boardOf(0, 97, 1000) : boardOf(97, 0, 2000); }, () => null).models;
  assert.deepEqual(asked.sort(), ['A', 'B']);
  const near = (m) => { const x = m.XPos * 0.025, z = (m.ZPos + 4096) * 0.025; return Math.hypot(x - 5, z - 95) < Math.hypot(x - 90, z - 10) ? 'north' : 'east'; };
  assert.deepEqual(placed.map((m) => [m.YRotation, near(m)]).sort(), [[1000, 'north'], [2000, 'east']], 'A\'s things at the gate by A, B\'s by B');
});

test('TS7 stood clear: a gate\'s things inside it moved further in together, those outside further out, by the least step clear of every wall and building cell; one that cannot go with its group its own nearest clear place, never across the wall (mutants: the group unmoved; the side unread; the fallback unlaid)', () => {
  const wall = { middle: [51.2, 0], frames: [{ name: 'G', block: [0, 0], at: [51.2, 51.2], out: [0, 1] }], pieces: [{ model: WALL_MODELS.gate, at: [51.2, 51.2], out: [0, 1], stretch: 1 }] };
  const rec = (a, b) => ({ ModelId: '41739', ModelIdNum: 41739, ObjectType: 0, XPos: (51.2 + a) / 0.025, YPos: 0, ZPos: (51.2 + b) / 0.025 - 4096, XRotation: 0, YRotation: 0, ZRotation: 0 });
  const extra = () => ({ Misc3dObjectRecords: [rec(-3, -5), rec(3, -5), rec(0, 6)], MiscFlatObjectRecords: [] });
  // the blocked cells: rows 28 to 35 (44.8 to 57.6 m north - the wall about 51.2) the whole way along
  const W = 64, H = 64, cells = new Uint8Array(W * H);
  for (let gz = 28; gz <= 35; gz++) for (let gx = 0; gx < W; gx++) cells[gz * W + gx] = 1;
  const f = gateFurniture(wall, null, extra, { cells, W, H });
  const z = f.models.map((r) => (r.ZPos + 4096) * 0.025);
  const x = f.models.map((r) => r.XPos * 0.025);
  const lo = 44.8 - GATE_CLEAR.model, hi = 57.6 + GATE_CLEAR.model;
  assert.ok(z[0] <= lo + 0.03 && z[0] > lo - GATE_CLEAR.step, `the inside pair clear, further in by the least step (${z[0].toFixed(2)})`);
  assert.equal(z[0], z[1], 'moved together');
  assert.deepEqual([x[0], x[1]], [48.2, 54.2], 'along as they stood');
  assert.ok(z[2] >= hi - 0.03 && z[2] < hi + GATE_CLEAR.step, `the outside one further out (${z[2].toFixed(2)})`);
  // a house behind one of the pair: it alone finds its own place, still inside
  for (let gz = 0; gz < 27; gz++) for (let gx = 0; gx < 32; gx++) cells[gz * W + gx] = 1;
  const g = gateFurniture(wall, null, extra, { cells, W, H });
  const free = (r) => { const px = r.XPos * 0.025, pz = (r.ZPos + 4096) * 0.025; for (let gz = 0; gz < H; gz++) for (let gx = 0; gx < W; gx++) if (cells[gz * W + gx] && Math.hypot(Math.max(gx * 1.6, Math.min(px, (gx + 1) * 1.6)) - px, Math.max(gz * 1.6, Math.min(pz, (gz + 1) * 1.6)) - pz) < GATE_CLEAR.model) return false; return true; };
  assert.ok(g.models.every(free), 'every one clear');
  assert.ok(g.models.slice(0, 2).every((r) => (r.ZPos + 4096) * 0.025 < 51.2), 'the pair still inside');
  assert.deepEqual(gateFurniture(wall, null, extra).models.map((r) => (r.ZPos + 4096) * 0.025).map((v) => Math.round(v * 10) / 10), [46.2, 46.2, 57.2], 'nothing blocked: where they were carried');
  // the blocked cells: the wall's and every town-map byte of its blocks but the ground flats'
  const bytes = new Uint8Array(4096);
  bytes[10 * 64 + 5] = 0x10; bytes[11 * 64 + 5] = 0xfb;
  const b = townBlockedCells({ exterior: { exteriorData: { width: 1, height: 1, blockNames: ['B.RMB'] } } }, { pieces: [] }, () => ({ fldHeader: { autoMapData: bytes } }));
  assert.equal(b.cells[(63 - 10) * 64 + 5], 1, 'a building\'s byte, on the walk grid\'s row');
  assert.equal(b.cells[(63 - 11) * 64 + 5], 0, 'a ground flat\'s none');
  assert.equal(b.cells.filter(Boolean).length, 1);
});

test('TS7 the carriages and the boards on the carrier: the mod\'s records on a gate while it is loaded, none else; a city walled on its outline a carriage town; the carrier\'s JSON its markers, then what stands at its gates (mutants: the switch unread; the carrier no carriage town; the furniture unlaid)', () => {
  let on = false;
  installImmersiveTravelGates(() => on);   // OWN-WORK2: our stand, on every gate
  assert.equal(carriageRecordsOf('WALLAA08.RMB'), null, 'the mod not loaded');
  on = true;
  assert.equal(carriageRecordsOf('wallaa08.rmb').Misc3dObjectRecords[0].ModelIdNum, 41214);
  assert.equal(carriageRecordsOf('WALLAA07.RMB'), null, 'no gate');
  assert.equal(hasCarriageGate({ exterior: { exteriorData: { blockNames: [townWallBlockName(5), 'H.RMB'] } } }), true);
  assert.equal(hasCarriageGate({ exterior: { exteriorData: { blockNames: ['H.RMB'] } } }), false);
  // the carrier: its markers first, then the gates' things
  const src = rd('src/world/townWalls.js');
  assert.match(src, /json\.RmbBlock\.MiscFlatObjectRecords = \[\.\.\.markers\.map\([^\n]+\), \.\.\.\(furniture\?\.flats \?\? \[\]\)\];/);
  // PIN MOVED (AUDIT CAPITAL-CARRIAGES L2): and its things outside each gate on its ground, off its roads (townGateOutside)
  assert.match(src, /return townWallBlockJson\(name, modelId, wall\?\.markers \?\? \[\], open, wall \? gateFurniture\(wall, classicOf, carriageRecordsOf, townBlockedCells\(dfLocation, wall, rmbOf\), townGateOutside\(dfLocation, wall, townPaths\(dfLocation\), rmbOf\)\) : null\);/);
});

test('TS7 the ground under a carrier never read for the terrain (its wall made when it is laid out), a town\'s walk shut to its ground and its wall, and its yards placed on what that leaves (mutants: the carrier read; the yards unshut)', () => {
  const tile = { textureRecord: 2, tileBitfield: 2 };
  const plainBlock = { rmbBlock: { fldHeader: { groundData: { groundTiles: Array.from({ length: 16 }, () => Array.from({ length: 16 }, () => tile)) }, autoMapData: new Uint8Array(4096) }, misc3dObjectRecords: [], miscFlatObjectRecords: [] } };
  const names = [townWallBlockName(9), 'P.RMB'];
  const read = [];
  setLocationTiles({ capital: true, mapTableData: { locationType: 2 }, exterior: { exteriorData: { width: 2, height: 1, blockNames: names } } }, { getRmbBlockName: (l, x) => names[x] }, { checkName: (n) => n, getBlockIndex: (n) => names.indexOf(n), getBlock: (i) => { read.push(i); return plainBlock; } }, new Uint8Array(128 * 128));
  assert.deepEqual(read, [1], 'the carrier never read');
  // the walk shut: off the ground, and on the wall
  const loc = city(RING, 7777);
  wallBayCity(loc, null, door);
  const nav = new CityNavigation(3, 3);
  nav.grid.fill(7 << 4);
  const ground = new Uint8Array(128 * 128).fill(1);
  townWalkShut({ ...loc, outline: undefined }, ground)(nav);
  assert.ok(nav.grid.every((v) => v === 7 << 4), 'on its ground, no wall of its own: none shut');
  const off = new Uint8Array(128 * 128);
  townWalkShut({ ...loc, outline: undefined }, off)(nav);
  assert.ok(nav.grid.every((v) => v === 0), 'off its ground: all shut');
  // the yards: the shut taken
  let shut = 0;
  const layout = { width: 1, height: 1, blocks: [{ x: 0, y: 0, dfBlock: plainBlock }] };
  const g = townGroundOf(layout, {}, (n) => { shut++; n.grid.fill(0); });
  assert.equal(shut, 1);
  assert.ok(g.blocked.every((v) => v === 1), 'nothing left to place on');
  assert.match(rd('src/scenes/pixelBuild.js'), /townPlacesFor\(dfLocation, lefaySpot, climate\?\.people, loc, yardShut, \(\) => breather\.breathe\(\)\)/);   // PIN MOVED (IC-STUTTER): and the build's breather   // PIN MOVED (FB1028): the yards' own shut
  assert.match(rd('src/scenes/world.js'), /const g = await stepsBreathing\(townGroundSteps\(yl, measures, shut, townYardsOf\(dfLocation\)\), breathe\);/);   // PIN MOVED (IC-PROPS): and what the town tells its yards' law - its fabric's ways, a capital's own yards; PIN MOVED (IC-STUTTER): a step at a time
  assert.equal(typeof registerTownWall, 'function');
});

test('TS7 with ARENA2: every one of the Bay\'s walled cities walled on its outline - four gates, closed, no house under it; at each gate its two boards inside and Immersive Travel\'s carriage and driver outside, every one clear of the wall and the houses and on the town\'s ground (mutants: the clearing unread; the frames unread)', { skip: skipReal }, async () => {
  const { BlocksFile } = await import('../../src/formats/blocksFile.js');
  const { MapsFile } = await import('../../src/formats/mapsFile.js');
  const bytes = (n) => new Uint8Array(readFileSync(join(ARENA2, n)));
  const blocks = new BlocksFile(); blocks.load(bytes('BLOCKS.BSA'));
  const maps = new MapsFile(); maps.load(bytes('MAPS.BSA'), bytes('CLIMATE.PAK'), bytes('POLITIC.PAK')); maps.autoDiscard = false;
  installImmersiveTravelGates(() => true);   // OWN-WORK2: our stand
  const classicOf = (n) => { const i = blocks.getBlockIndex(blocks.checkName(n)); return i < 0 ? null : blocks.readClassicBlock(i); };
  const rmbOf = (n) => (isWallCarrier(n) || n === TOWN_OUTLINE_BLOCK ? null : blocks.getBlockByName(n)?.rmbBlock ?? null);
  let n = 0;
  for (let r = 0; r < 62; r++) {
    const reg = maps.getRegion(r);
    if (!reg) continue;
    for (let l = 0; l < reg.locationCount; l += 2) {
      const loc = maps.getLocation(r, l);
      if (!loc?.exterior?.exteriorData?.blockNames?.some((x) => /^WALLAA/.test(x))) continue;
      assert.ok(wallBayCity(loc, maps, door), `${loc.name}: walled on its outline`);
      const wall = townWall(loc, loc.exterior.exteriorData.wallTook, rmbOf);
      assert.equal(wall.pieces.filter((p) => p.model === WALL_MODELS.gate).length, 4, `${loc.name}: its four gates`);
      // each gate's frame: Daggerfall's gate model 1.6 m in from its subrecord, facing out of its side of the ring
      const sides = { 'WALLAA08.RMB': [0, 1], 'WALLAA09.RMB': [1, 0], 'WALLAA10.RMB': [0, -1], 'WALLAA11.RMB': [-1, 0] };
      for (const fr of wall.frames) {
        assert.deepEqual(fr.out.map((v) => Math.round(v * 1e9) / 1e9 + 0), sides[fr.name], `${loc.name}: ${fr.name} faces out`);
        const g = wall.gates[wall.frames.indexOf(fr)];
        assert.ok(Math.abs(fr.at[0] - (g[0] - 1.6 * fr.out[0])) < 1e-6 && Math.abs(fr.at[1] - (g[1] - 1.6 * fr.out[1])) < 1e-6, `${loc.name}: its gate's origin`);
      }
      const blocked = townBlockedCells(loc, wall, rmbOf), cells = townWallCells(wall, loc.exterior.exteriorData.width, loc.exterior.exteriorData.height);
      const { width: w, height: h } = loc.exterior.exteriorData, W = w * 64, H = h * 64;
      for (let i = 0; i < cells.length; i++) if (cells[i]) assert.ok(blocked.cells[i], 'the wall\'s cells blocked');
      const T = 16, PAD = 12, occ = townTiles(w, h, (bx, by) => rmbOf(loc.exterior.exteriorData.blockNames[by * w + bx])), PW = w * T + 2 * PAD, PH = h * T + 2 * PAD, padded = new Uint8Array(PW * PH);
      for (let y = 0; y < h * T; y++) padded.set(occ.subarray(y * w * T, (y + 1) * w * T), (y + PAD) * PW + PAD);
      const field = townShapeField(townRound(padded, PW, PH).inside, PW, PH, loc.mapTableData.mapId >>> 0, { core: WALL_ROUND.apron });
      const f = gateFurniture(wall, classicOf, carriageRecordsOf, blocked);
      const at = (rec) => [rec.XPos * 0.025, (rec.ZPos + 4096) * 0.025];
      assert.equal(f.models.filter((m) => m.ModelIdNum === 41739).length, 8, `${loc.name}: two boards a gate`);
      assert.equal(f.flats.filter((t) => t.FactionID === 8642).length, 4, `${loc.name}: a driver a gate`);
      for (const m of f.models) {
        const [x, z] = at(m);
        if (m.ModelIdNum === 41739) assert.ok(inRound(wall.line, x, z), `${loc.name}: a board inside`);
        if (m.ModelIdNum === 41214) assert.ok(!inRound(wall.line, x, z), `${loc.name}: a carriage outside`);
        const gx = Math.floor(x / 1.6), gz = Math.floor(z / 1.6);
        assert.ok(!(gx >= 0 && gz >= 0 && gx < W && gz < H && blocked.cells[gz * W + gx]), `${loc.name}: ${m.ModelIdNum} clear`);
        const bx = Math.floor(gx / 64), by = Math.floor(gz / 64), byte = rmbOf(loc.exterior.exteriorData.blockNames[by * w + bx])?.fldHeader?.autoMapData?.[(63 - (gz % 64)) * 64 + (gx % 64)] ?? 0;
        assert.ok(!byte || byte === 0xfb, `${loc.name}: ${m.ModelIdNum} on no house`);
        assert.ok(field[(Math.floor(z / 6.4) + PAD) * PW + Math.floor(x / 6.4) + PAD] > 0, `${loc.name}: on its ground`);
      }
      // closed on its walk grid
      let s0 = (H >> 1) * W + (W >> 1);
      while (cells[s0]) s0++;
      const seen = new Uint8Array(W * H), stack = [s0];
      seen[s0] = 1;
      while (stack.length) {
        const i = stack.pop(), x = i % W, y = (i - x) / W;
        assert.ok(x > 0 && y > 0 && x < W - 1 && y < H - 1, `${loc.name}: its wall open`);
        for (const k of [i - 1, i + 1, i - W, i + W]) if (!seen[k] && !cells[k]) { seen[k] = 1; stack.push(k); }
      }
      n++;
    }
  }
  assert.ok(n > 150, `${n} cities`);
});

test('TS7 with ARENA2: a town past the Bay\'s yards on its own ground - every yard of every sixth city and town on its outline\'s tiles with its walk shut, where some stood partly off it without (mutant: the yards unshut)', { skip: skipReal }, async () => {
  const { BlocksFile } = await import('../../src/formats/blocksFile.js');
  const { MapsFile } = await import('../../src/formats/mapsFile.js');
  const { bindWorldDataBlocks } = await import('../../src/formats/worldData/worldDataReplacement.js');
  const { installTownOutline } = await import('../../src/world/townOutline.js');
  const { standTownWall } = await import('../../src/world/townWalls.js');
  const { locationShapeField, getLocationTerrainTileOrigin } = await import('../../src/world/terrain/terrainTiles.js');
  const { layoutLocation } = await import('../../src/world/locationLayout.js');
  const { yardSitesOn } = await import('../../src/world/merchantYards/merchantYardSites.js');
  const { arenaTemplates } = await import('../../src/world/arenaLocations.js');
  const bytes = (n) => new Uint8Array(readFileSync(join(ARENA2, n)));
  const blocks = new BlocksFile(); blocks.load(bytes('BLOCKS.BSA'));
  const maps = new MapsFile(); maps.load(bytes('MAPS.BSA'), bytes('CLIMATE.PAK'), bytes('POLITIC.PAK')); maps.autoDiscard = false;
  installWorldDataReplacement(); bindWorldDataBlocks(blocks); installTownOutline();
  const rows = [];
  for (let r = 0; r < 62; r++) { const reg = maps.getRegion(r); if (!reg) continue; for (let l = 0; l < reg.locationCount; l++) { const loc = maps.getLocation(r, l); if (loc) rows.push(unwalledLocation(loc)); } }
  const T = arenaTemplates(rows);
  const io = { classicOf: (n) => blocks.readClassicBlock(blocks.getBlockIndex(blocks.checkName(n))), servedOf: (n) => blocks.getBlockByName(n) };
  let yards = 0, offWithout = 0;
  for (const kind of ['city-state', 'town']) {
    for (let j = 0; j < T[kind].length; j += 6) {
      const t = T[kind][j], mapId = ((0xa7 << 20) | (500000 + j + (kind === 'town' ? 5000 : 0))) >>> 0;
      const loc = outlineTownLocation({ ...t, mapTableData: { ...t.mapTableData, mapId } }, io);
      if (loc.outline?.walled) standTownWall(loc, t.exterior.exteriorData.blockNames, io, townOutlineBlockJson);
      const yl = layoutLocation(loc, maps, blocks), ed = loc.exterior.exteriorData;
      const shape = locationShapeField(loc, (bx, by) => { const nm = ed.blockNames[by * ed.width + bx]; return isWallCarrier(nm) ? null : blocks.getBlockByName(nm)?.rmbBlock ?? null; });
      const ground = new Uint8Array(128 * 128);
      for (let i = 0; i < ground.length; i++) ground[i] = shape?.[i] ? 1 : 0;
      const o = getLocationTerrainTileOrigin(loc);
      const off = (s) => { for (let gy = s.gy; gy < s.gy + s.nz; gy++) for (let gx = s.gx; gx < s.gx + s.nx; gx++) if (!ground[(o.x + (gx >> 2)) + (o.y + (gy >> 2)) * 128]) return true; return false; };
      for (const s of yardSitesOn(townGroundOf(yl, {}, townWalkShut(loc, ground)))) { yards++; assert.ok(!off(s), `${t.name}: its ${s.kind} on its ground`); }
      offWithout += yardSitesOn(townGroundOf(yl, {})).filter(off).length;
    }
  }
  assert.ok(yards > 300, `${yards} yards`);
  assert.ok(offWithout > 0, 'without the shut some stood off it');
});
