// TOWN-SHAPES TS6 (2026-10-25, the owner: "Its time to move away from perfect squares ... This needs to be perfection";
// bible/03-World/Town-Shapes.md TS6): the trees, the walkers and the town map follow a town's outline - the woods kept off
// its own ground and four tiles past it (not a square cut about it), its people on its ground and never through a wall past
// the Bay, the wall on its town map; and a wall's chord never cut in across a tight bulge onto a house.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { natureCleared, outlineDistance, natureStandsAt, layoutNature, placesPull, NATURE_CLEARANCE } from '../../src/world/terrain/terrainNature.js';
import { jungleLayout } from '../../src/world/terrain/jungleNature.js';
import { setLocationTiles, getLocationTerrainTileOrigin } from '../../src/world/terrain/terrainTiles.js';
import { HEIGHTMAP_DIMENSION, MAX_TERRAIN_HEIGHT, SCALED_BEACH_ELEVATION } from '../../src/world/terrain/terrainSampler.js';
import { shutOffGround, isWallCarrier } from '../../src/world/townShape.js';
import { CityNavigation } from '../../src/world/city/cityNavigation.js';
import { townWall, townWallCells, townWallCellsOf, wallOnTownMap, shutTownWall, standTownWall, wallPieces, townWallBlockName, WALL_BYTE, WALL_MODELS, TOWN_WALL } from '../../src/world/townWalls.js';
import { outlineTownLocation, townOutlineBlockJson, TOWN_OUTLINE_BLOCK } from '../../src/world/townOutline.js';

const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const ARENA2 = process.env.ARENA2_PATH;
const skipReal = !ARENA2 || !existsSync(join(ARENA2 ?? '', 'BLOCKS.BSA')) ? 'ARENA2_PATH not set or missing - real-data validation skipped' : false;
const D = 128, H = HEIGHTMAP_DIMENSION;
/** Level grass over the beach, a pixel of it. */
const level = () => new Float32Array(H * H).fill((SCALED_BEACH_ELEVATION / MAX_TERRAIN_HEIGHT) * 1.6);
const grass = () => new Uint8Array(D * D).fill(2);
/** A town's rect and outline: a band of ground (x 20..107, y 60..67) - long past its rect one way, narrow inside it the
 *  other - in a rect of x 50..77, y 30..97. */
function bandTown() {
  const shape = new Uint8Array(D * D);
  for (let y = 60; y < 68; y++) for (let x = 20; x < 108; x++) shape[x + y * D] = 1;
  return { xMin: 50, xMax: 78, yMin: 30, yMax: 98, shape };
}
const inGrown = (r, x, y) => x >= r.xMin - NATURE_CLEARANCE && x < r.xMax + NATURE_CLEARANCE && y >= r.yMin - NATURE_CLEARANCE && y < r.yMax + NATURE_CLEARANCE;

test('TS6 the clearing: a town whose rect carries its outline keeps nature within four tiles of it, round, and its square past that is the land\'s; a rect without one keeps its rect and four (DFU\'s) (mutants: the outline unread; the clearance unread)', () => {
  const town = bandTown(), d = outlineDistance(town.shape);
  assert.equal(d[30 + 63 * D], 0, 'on its outline');
  assert.equal(natureCleared(town, 64, 64 - 4 - 4), true, 'four tiles off it: cleared');
  assert.equal(natureCleared(town, 64, 60 - 5), false, 'five off it, inside its rect: the land\'s');
  assert.equal(natureCleared(town, 52, 35), false, 'the rect\'s corner, far from its ground');
  assert.equal(natureCleared(town, 111, 63), true, 'its ground past its rect, and four past that');
  assert.equal(natureCleared(town, 112, 63), false);
  assert.equal(natureCleared(town, 110, 57), false, 'three and three off its corner: round, not square');
  const plain = { xMin: 50, xMax: 78, yMin: 30, yMax: 98 };
  assert.equal(natureCleared(plain, 52, 35), true, 'DFU\'s rect');
  assert.equal(natureCleared(plain, 46, 26), true, 'and its four');
  assert.equal(natureCleared(plain, 45, 26), false);
  assert.equal(natureCleared(plain, 81, 101), true, 'max-exclusive past the four: 78 + 4');
  assert.equal(natureCleared(plain, 82, 101), false);
  assert.equal(outlineDistance(town.shape), d, 'once a shape');
  // the gathering nodes' question (PROF1) asks the same
  assert.ok(natureStandsAt(level(), grass(), town, 52, 35), 'a patch in the square off the town');
  assert.equal(natureStandsAt(level(), grass(), town, 64, 58), null, 'none by its ground');
  assert.equal(natureStandsAt(level(), grass(), plain, 52, 35), null, 'none in DFU\'s rect');
});

test('TS6 DFU\'s scatter round a town: every flat past its rect DFU\'s own stream (none moved), but those on its ground or four past it; its square off the clearing laid on each tile\'s own dice, as DFU\'s law there; none on the clearing (mutants: the square unlaid; the clearing past the rect unkept)', () => {
  const town = bandTown(), plain = { xMin: town.xMin, xMax: town.xMax, yMin: town.yMin, yMax: town.yMax };
  const opts = (rect) => ({ mapPixelX: 300, mapPixelY: 200, rawWorldHeight: 90, climateType: 1, locationRect: rect });
  const shaped = layoutNature(level(), grass(), opts(town)), dfu = layoutNature(level(), grass(), opts(plain));
  const tileOf = (f) => [Math.round(f.x / 6.4), Math.round(f.z / 6.4)];
  const key = (f) => `${f.record}:${f.x}:${f.z}`;
  const shapedOut = shaped.filter((f) => !inGrown(plain, ...tileOf(f))).map(key);
  const dfuOut = dfu.filter((f) => !natureCleared(town, ...tileOf(f))).map(key);
  assert.ok(dfuOut.length > 1000);
  assert.deepEqual(shapedOut, dfuOut, 'past the rect: DFU\'s stream, less the clearing');
  assert.ok(dfu.some((f) => natureCleared(town, ...tileOf(f)) && !inGrown(plain, ...tileOf(f))), 'DFU stood flats on the band past its rect');
  for (const f of shaped) assert.equal(natureCleared(town, ...tileOf(f)), false, 'no flat on the clearing');
  const square = shaped.filter((f) => inGrown(plain, ...tileOf(f)));
  assert.ok(square.length > 300, `the square off the clearing the land's (${square.length})`);
  assert.equal(dfu.filter((f) => inGrown(plain, ...tileOf(f))).length, 0, 'DFU\'s rect bare');
});

test('TS6 the woods round a town: the forests\' clearing its outline\'s, their fields drawn back from its outline (not its rect); the jungle\'s the same (mutants: the forests\' clearing the rect\'s; the pull from the rect; the jungle\'s clearing the rect\'s)', () => {
  const town = bandTown();
  const forests = { archive: 504, pois: [{ ...town, hide: false }], paths: null };
  const flats = layoutNature(level(), grass(), { mapPixelX: 300, mapPixelY: 200, rawWorldHeight: 90, climateType: 1, locationRect: town, forests });
  const tileOf = (f) => [Math.floor(f.x / 6.4), Math.floor(f.z / 6.4)];
  for (const f of flats) assert.equal(natureCleared(town, ...tileOf(f)), false, 'no tree of the woods on its clearing');
  assert.ok(flats.some((f) => inGrown(town, ...tileOf(f))), 'its square off the clearing wooded as the land');
  // the pull: the rect's corner lies 25 tiles from the band - past the fields' near, under their far
  const p = { ...town, hide: false };
  assert.ok(placesPull([p], 52, 35) > -0.5, `the rect's corner barely drawn back (${placesPull([p], 52, 35).toFixed(3)})`);
  assert.ok(placesPull([p], 64, 56) < -0.99 * Math.min(1, 1), 'by its ground: fields');
  assert.ok(placesPull([{ xMin: 50, xMax: 78, yMin: 30, yMax: 98, hide: false }], 52, 35) < -0.99, 'a rect\'s corner: fields, as before');
  // the jungle, wholly over the pixel
  const jungle = jungleLayout([], level(), grass(), { mapPixelX: 400, mapPixelY: 100, rawWorldHeight: 80, climateType: 400, locationRect: town, jungle: { nine: [3, 3, 3, 3, 3, 3, 3, 3, 3], pois: [{ ...town, hide: false }], paths: null, net: null } });
  assert.ok(jungle.flats.length > 0);
  for (const f of jungle.flats) assert.equal(natureCleared(town, ...tileOf(f)), false, 'no jungle on its clearing');
  assert.ok(jungle.flats.some((f) => inGrown(town, ...tileOf(f))), 'the jungle in its square off the clearing');
});

test('TS6 the walkers on the town\'s ground: a walk grid cell is its tile\'s - four a tile, the grid\'s south-west tile its origin, its rows as the stamp lays its ground - and shut where the tile is none of the town\'s (mutants: the origin unread; the rows turned)', () => {
  // a 2 x 1 town: one water tile in its west block at the ground grid's [3][2] - the stamp lays it at (o.x + 3, o.y + 13)
  const tiles = (water) => Array.from({ length: 16 }, (_, tx) => Array.from({ length: 16 }, (_, ty) => ({ textureRecord: water && tx === 3 && ty === 2 ? 0 : 2, tileBitfield: water && tx === 3 && ty === 2 ? 0 : 2 })));
  const blocksOf = [tiles(true), tiles(false)].map((g) => ({ rmbBlock: { fldHeader: { groundData: { groundTiles: g }, autoMapData: new Uint8Array(4096) }, misc3dObjectRecords: [], miscFlatObjectRecords: [] } }));
  const loc = { capital: true, mapTableData: { locationType: 2 }, exterior: { exteriorData: { width: 2, height: 1, blockNames: ['A.RMB', 'B.RMB'] } } };
  const tm = new Uint8Array(D * D);
  setLocationTiles(loc, { getRmbBlockName: (l, x) => (x === 0 ? 'A.RMB' : 'B.RMB') }, { checkName: (n) => n, getBlockIndex: (n) => (n === 'A.RMB' ? 0 : 1), getBlock: (i) => blocksOf[i] }, tm);
  const o = getLocationTerrainTileOrigin(loc);
  assert.equal(tm[(o.x + 3) + (o.y + 13) * D], 0xff, 'the stamp: its water tile');
  const nav = new CityNavigation(2, 1);
  blocksOf.forEach((b, i) => nav.setBlockData(i, 0, b.rmbBlock.fldHeader.autoMapData, (tx, ty) => b.rmbBlock.fldHeader.groundData.groundTiles[tx][ty].textureRecord));
  const shut = [];
  for (let gy = 0; gy < nav.height; gy++) for (let gx = 0; gx < nav.width; gx++) if (!nav.weightAt(gx, gy)) shut.push([gx >> 2, gy >> 2]);
  assert.equal(shut.length, 16);
  assert.ok(shut.every(([x, y]) => x === 3 && y === 13), 'the walk grid\'s water cells the stamp\'s tile');
  // the town's ground: its east block's west half, and the water tile; shut elsewhere
  const ground = new Uint8Array(D * D);
  for (let y = 0; y < 16; y++) for (let x = 16; x < 24; x++) ground[(o.x + x) + (o.y + y) * D] = 1;
  ground[(o.x + 3) + (o.y + 13) * D] = 1;
  shutOffGround(nav, ground, o);
  for (let gy = 0; gy < nav.height; gy++) for (let gx = 0; gx < nav.width; gx++) {
    const tx = gx >> 2, ty = gy >> 2, on = tx >= 16 && tx < 24;
    assert.equal(nav.weightAt(gx, gy) > 0, on, `cell ${gx},${gy}`);
  }
  // the host shuts the walk grid off the town's ground and its wall, the terrain job handing the ground back
  const pb = rd('src/scenes/pixelBuild.js');
  // PIN MOVED (TS7): one shut, the walkers' and the yards' (world/townWalls.js townWalkShut)
  // PIN MOVED (URBANIZER U3): the town's own shut first, then its fabric's fences and walls (world/urban/townFabricStand.js fabricWalkShut)
  assert.match(pb, /const walkShut = dfLocation \? fabricWalkShut\(townWalkShut\(dfLocation, townGround, paths\), dfLocation\) : null;/);   // PIN MOVED (TS10): and the paths its terrain painted
  assert.match(pb, /walkShut\?\.\(nav\);/);
  assert.match(rd('src/world/townWalls.js'), /const origin = getLocationTerrainTileOrigin\(dfLocation\);\n\s+if \(ground\) shutOffGround\(nav, ground, origin\);\n\s+if \(paths\) paveOnGrid\(nav, paths, origin\);\n\s+shutTownWall\(nav, yards \? townWallYardCellsOf\(dfLocation\) : townWallCellsOf\(dfLocation\)\);/);   // PIN MOVED (TS10): the painted paths paved between; PIN MOVED (FB1028): the yards' wall #1184's
  assert.match(pb, /beach, roadside, townGround, arenaRoads, bridges, meets, settlement \} = await terrainGen\.generate\(/);   // PIN MOVED (FB1029 ACROSS-EDGE): and the town meets. PIN MOVED (ROAD-LOOK): and the pixel's bridges
  assert.match(rd('src/world/terrain/terrainGen.js'), /townGround: locationRect\?\.mask \?\? null,/);
});

test('TS6 the wall\'s cells: each length its stretched length by its thickness, a tower its square, turned to its line - on the town map in Daggerfall\'s wall byte (a copy: the walk grid\'s bytes untouched) and shut to the walkers; a city stood this session answers its own, once (mutants: the length and thickness swapped; the turn unread; the map\'s rows unturned; the bytes written in place)', () => {
  const along = townWallCells({ pieces: [{ model: WALL_MODELS.wall, at: [51.2, 51.2], out: [0, 1], stretch: 1 }] }, 1, 1);
  const across = townWallCells({ pieces: [{ model: WALL_MODELS.wall, at: [51.2, 51.2], out: [1, 0], stretch: 1 }] }, 1, 1);
  const tower = townWallCells({ pieces: [{ model: WALL_MODELS.tower, at: [51.2, 51.2], out: [0, 1], stretch: 1 }] }, 1, 1);
  const box = (c) => { let x0 = 64, x1 = 0, y0 = 64, y1 = 0; c.forEach((v, i) => { if (v) { x0 = Math.min(x0, i % 64); x1 = Math.max(x1, i % 64); y0 = Math.min(y0, i >> 6); y1 = Math.max(y1, i >> 6); } }); return [x1 - x0 + 1, y1 - y0 + 1]; };
  assert.deepEqual(box(along), [16, 6], 'a length east-west: 25.6 m by 9.6');
  assert.deepEqual(box(across), [6, 16], 'turned');
  assert.deepEqual(box(tower), [6, 6], 'a tower its body, 9.6 m square (PIN MOVED, TS8: 16.8 m was the corner tower with its stubs)');
  // on the town map: the block's row r the walk grid's 63 - r
  const own = new Uint8Array(4096);
  const blocks = [{ x: 0, y: 0, autoMap: own }];
  const cells = new Uint8Array(2 * 4096);
  cells[10 * 128 + 5] = 1;   // walk row 10, column 5: block 0
  const [b] = wallOnTownMap(blocks, cells, 2);
  assert.notEqual(b.autoMap, own, 'a copy');
  assert.equal(own.some(Boolean), false, 'the cache untouched');
  assert.equal(b.autoMap[(63 - 10) * 64 + 5], WALL_BYTE);
  assert.equal(b.autoMap.filter(Boolean).length, 1);
  assert.equal(wallOnTownMap([{ x: 1, y: 0, autoMap: own }], cells, 2)[0].autoMap, own, 'a block it crosses none of as it was');
  assert.equal(wallOnTownMap(blocks, null, 2), blocks, 'no wall: the blocks as they were');
  assert.equal(WALL_BYTE, 0x18);
  const nav = new CityNavigation(2, 1);
  nav.grid.fill(7 << 4);
  shutTownWall(nav, cells);
  assert.equal(nav.weightAt(5, 10), 0);
  assert.equal(nav.weightAt(6, 10), 7);
  // a city stood: its cells once; a town with no wall of its own none
  const houses = new Uint8Array(4096);
  for (let r = 8; r < 56; r++) for (let c = 8; c < 56; c++) houses[r * 64 + c] = 5;
  const gate = (z) => ({ subRecords: [{ xPos: 2048, zPos: z, exterior: { block3dObjectRecords: [{ modelIdNum: 446 }] } }] });
  const served = { 'H.RMB': { rmbBlock: { fldHeader: { autoMapData: houses }, misc3dObjectRecords: [], miscFlatObjectRecords: [], subRecords: [] } }, 'WALLAA08.RMB': { rmbBlock: gate(3584) }, 'WALLAA10.RMB': { rmbBlock: gate(512) } };
  const template = ['WALLAA02.RMB', 'WALLAA10.RMB', 'WALLAA03.RMB', 'WALLAA07.RMB', 'H.RMB', 'WALLAA05.RMB', 'WALLAA00.RMB', 'WALLAA08.RMB', 'WALLAA01.RMB'];
  const mapId = ((0xa7 << 20) | 500977) >>> 0;
  const loc = { name: 'Walled', mapTableData: { mapId }, exterior: { exteriorData: { width: 3, height: 3, blockNames: [townWallBlockName(mapId), ...template.slice(1).map((n) => (n === 'H.RMB' ? n : TOWN_OUTLINE_BLOCK))] } }, outline: { kept: 1, left: 8, walled: true } };
  assert.equal(townWallCellsOf(loc), null, 'not stood yet');
  const wall = standTownWall(loc, template, (n) => served[n] ?? null, townOutlineBlockJson);
  const mine = townWallCellsOf(loc);
  assert.deepEqual([...mine], [...townWallCells(wall, 3, 3)]);
  assert.equal(townWallCellsOf(loc), mine, 'once');
  for (let r = 8; r < 56; r++) for (let c = 8; c < 56; c++) assert.equal(mine[(64 + 63 - r) * 192 + 64 + c], 0, 'no house under it');
  assert.equal(townWallCellsOf({ ...loc, outline: undefined }), null, 'a town with no wall of its own');
  assert.match(rd('src/scenes/exteriorAutomapToggle.js'), /blocks: wallOnTownMap\(b\.locBlocks\.map\(\(bl\) => \(\{ x: bl\.x, y: bl\.y, autoMap: bl\.dfBlock\?\.rmbBlock\?\.fldHeader\?\.autoMapData, landmark: arenaTownLandmark\(bl\.dfBlock\) \}\)\), townWallCellsOf\(dfLoc\), dfLoc\.exterior\.exteriorData\.width\),/);
});

test('TS6 a wall\'s chord across a tight bulge: laid a length at a time, so no length\'s middle stands more than TOWN_WALL.sag inside the line; a gentle round keeps its chords of two (mutants: the cut unread; the cut measured outward)', () => {
  // a round of 150 m with a bulge 14 m high over 60 degrees of it - its sides tight
  const n = 720, ring = Array.from({ length: n }, (_, i) => {
    const a = (2 * Math.PI * i) / n, bump = Math.abs(a - Math.PI / 2) < Math.PI / 6 ? 14 * Math.cos((a - Math.PI / 2) * 3) ** 2 : 0;
    return /** @type {[number, number]} */ ([(150 + bump) * Math.cos(a), (150 + bump) * Math.sin(a)]);
  });
  const inside = (pts, x, y) => { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; };
  const depth = (pts, [x, y]) => {
    if (!inside(pts, x, y)) return 0;
    let best = Infinity;
    for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length], dx = q[0] - p[0], dy = q[1] - p[1], t = Math.max(0, Math.min(1, ((x - p[0]) * dx + (y - p[1]) * dy) / (dx * dx + dy * dy))); best = Math.min(best, Math.hypot(p[0] + dx * t - x, p[1] + dy * t - y)); }
    return best;
  };
  const worst = (pieces) => Math.max(...pieces.filter((p) => p.model === WALL_MODELS.wall).map((p) => depth(ring, p.at)));
  const gates = [[0, -200]];
  const kept = wallPieces(ring, [0, 0], gates), loose = wallPieces(ring, [0, 0], gates, { sag: Infinity });
  assert.ok(worst(loose) > TOWN_WALL.sag, `chords of two cut in across the bulge (${worst(loose).toFixed(2)} m)`);
  assert.ok(worst(kept) <= TOWN_WALL.sag, `none past ${TOWN_WALL.sag} m (${worst(kept).toFixed(2)})`);
  const towers = (ps) => ps.filter((p) => p.model === WALL_MODELS.tower).length;
  assert.ok(towers(kept) > towers(loose), 'more towers there');
  const round = Array.from({ length: 360 }, (_, i) => /** @type {[number, number]} */ ([150 * Math.cos((2 * Math.PI * i) / 360), 150 * Math.sin((2 * Math.PI * i) / 360)]));
  assert.equal(towers(wallPieces(round, [0, 0], gates)), towers(wallPieces(round, [0, 0], gates, { sag: Infinity })), 'a gentle round as it was');
});

test('TS6 with ARENA2: every third city past the Bay - its wall closed on its walk grid (the middle never reaches the grid\'s edge), no cell of a house under it (mutants: the chords uncut; a tower\'s square unlaid)', { skip: skipReal }, async () => {
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
  let n = 0;
  for (let j = 0; j < cities.length; j += 3) {
    const t = cities[j], mapId = ((0xa7 << 20) | (500000 + j)) >>> 0;
    const loc = outlineTownLocation({ ...t, mapTableData: { ...t.mapTableData, mapId } }, io);
    const wall = townWall(loc, t.exterior.exteriorData.blockNames, rmbOf);
    assert.ok(wall, t.name);
    const { width: w, height: h, blockNames } = loc.exterior.exteriorData, W = w * 64, Hh = h * 64, cells = townWallCells(wall, w, h);
    for (let by = 0; by < h; by++) for (let bx = 0; bx < w; bx++) {
      const a = rmbOf(blockNames[by * w + bx])?.fldHeader?.autoMapData;
      if (!a) continue;
      for (let r = 0; r < 64; r++) for (let c = 0; c < 64; c++) if (a[r * 64 + c] && a[r * 64 + c] !== 0xfb) assert.equal(cells[(by * 64 + 63 - r) * W + bx * 64 + c], 0, `${t.name}: a house under its wall`);
    }
    let start = (Hh >> 1) * W + (W >> 1);
    while (cells[start]) start++;
    const seen = new Uint8Array(W * Hh), stack = [start];
    seen[start] = 1;
    while (stack.length) {
      const i = stack.pop(), x = i % W, y = (i - x) / W;
      assert.ok(x > 0 && y > 0 && x < W - 1 && y < Hh - 1, `${t.name}: its wall open`);
      for (const k of [i - 1, i + 1, i - W, i + W]) if (!seen[k] && !cells[k]) { seen[k] = 1; stack.push(k); }
    }
    n++;
  }
  assert.ok(n > 100);
});
