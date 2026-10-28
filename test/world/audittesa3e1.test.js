// AUDIT TESA III lane E1 (2026-10-26, the owner: "Comprehensive audit on everything to ensure perfection";
// bible/01-Overview/audits/Audit-Tesa-III-E1.md): the pins of the findings fixed in the lane's own files.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { wallBayCity, TOWN_OUTLINE_BLOCK } from '../../src/world/townOutline.js';
import { townWallCellsOf, wallOnTownMap, wallLaidBytes, WALL_BYTE } from '../../src/world/townWalls.js';
import { installWorldDataReplacement } from '../../src/formats/worldData/worldDataReplacement.js';
import { CityNavigation } from '../../src/world/city/cityNavigation.js';
import { isWallCarrier } from '../../src/world/townShape.js';
import { rectsLookup, rectsFingerprint, bakeCacheKey, BAKE_GENERATOR_VERSION } from '../../src/world/deepWater/deepWatersBakeCache.js';

const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const ARENA2 = process.env.ARENA2_PATH;
const skipReal = !ARENA2 || !existsSync(join(ARENA2 ?? '', 'BLOCKS.BSA')) ? 'ARENA2_PATH not set or missing - real-data validation skipped' : false;
const RING = ['WALLAA02.RMB', 'WALLAA10.RMB', 'WALLAA03.RMB', 'WALLAA07.RMB', 'H.RMB', 'WALLAA05.RMB', 'WALLAA00.RMB', 'WALLAA08.RMB', 'WALLAA01.RMB'];
const city = (names, mapId) => ({ name: 'Bayton', mapTableData: { mapId }, exterior: { buildings: [], exteriorData: { width: 3, height: 3, blockNames: names.slice() } } });
const door = { getBlockByName: () => null, getBlockIndex: () => -1, checkName: (n) => n, readClassicBlock: () => null };
/** A walk grid off a city's blocks' bytes, as the bench builds its own (scenes/exterior.js: each block's bytes, a ground of
 *  grass) - `bytesOf(bx, by, own)` the bytes it hands setBlockData. */
const navOf = (w, h, own, bytesOf) => {
  const nav = new CityNavigation(w, h);
  for (let by = 0; by < h; by++) for (let bx = 0; bx < w; bx++) nav.setBlockData(bx, by, bytesOf(bx, by, own(bx, by)), () => 2);
  return nav;
};

test('AUDIT TESA III E1-2 THE BENCH KNOWS TS7\'S WALL: a Bay city walled on its outline as the door reads it lays its wall in each block\'s town-map bytes (a copy; a block it crosses none of, and a city with no wall of its own, its own bytes) - a walk grid carved off them is shut on every cell of the wall, where one off the raw bytes walks through it; the fixed-city bench carves and draws its town through them (mutants: the bytes unlaid; the bench\'s walk grid off the raw bytes; its town map unwalled)', () => {
  installWorldDataReplacement();
  const houses = new Uint8Array(4096);
  for (let r = 8; r < 56; r++) for (let c = 8; c < 56; c++) houses[r * 64 + c] = 5;
  const gate = (z) => ({ rmbBlock: { subRecords: [{ xPos: 2048, zPos: z, yRotation: 0, exterior: { block3dObjectRecords: [{ modelIdNum: 446, xPos: 0, zPos: -64 }] } }], misc3dObjectRecords: [], miscFlatObjectRecords: [] } });
  const served = { 'H.RMB': { rmbBlock: { fldHeader: { autoMapData: houses }, misc3dObjectRecords: [], miscFlatObjectRecords: [], subRecords: [] } }, 'WALLAA08.RMB': gate(3584), 'WALLAA10.RMB': gate(512) };
  const loc = city(RING, 4501);
  assert.equal(wallBayCity(loc, null, { ...door, getBlockByName: (n) => served[n] ?? null }), true);
  const cells = townWallCellsOf(loc);
  assert.ok(cells && cells.some(Boolean), 'its wall registered');
  const names = loc.exterior.exteriorData.blockNames;
  const own = (bx, by) => (names[by * 3 + bx] === 'H.RMB' ? houses : new Uint8Array(4096));   // the open cells' and the carrier's: none
  let laid = 0;
  for (let by = 0; by < 3; by++) for (let bx = 0; bx < 3; bx++) {
    const raw = own(bx, by), before = Uint8Array.from(raw), got = wallLaidBytes(loc, bx, by, raw);
    assert.deepEqual([...got], [...wallOnTownMap([{ x: bx, y: by, autoMap: raw }], cells, 3)[0].autoMap], `block ${bx},${by}: the wall's own bytes`);
    assert.deepEqual([...raw], [...before], 'a copy - the block\'s bytes untouched');
    laid += got.filter((v) => v === WALL_BYTE).length;
  }
  assert.ok(laid > 0, 'the wall laid in the blocks it crosses');
  const shut = navOf(3, 3, own, (bx, by, raw) => wallLaidBytes(loc, bx, by, raw)), open = navOf(3, 3, own, (bx, by, raw) => raw);
  assert.ok([...cells].every((v, i) => !v || shut.grid[i] === 0), 'every wall cell shut to the walkers');
  assert.ok([...cells].some((v, i) => v && open.grid[i] > 0), 'the raw bytes walk through it');
  // a city with no wall of its own: its bytes themselves
  const plain = city(['H.RMB'], 4502);
  assert.equal(wallLaidBytes(plain, 0, 0, houses), houses);
  // the bench: its walk grid off the laid bytes, its town map with the wall on it
  const ext = rd('src/scenes/exterior.js');
  assert.match(ext, /cityNav\.setBlockData\(b\.x, b\.y, wallLaidBytes\(dfLocation, b\.x, b\.y, b\.dfBlock\.rmbBlock\.fldHeader\.autoMapData\),/);
  assert.match(ext, /blocks: wallOnTownMap\(loc\.blocks\.map\(\(bl\) => \(\{ x: bl\.x, y: bl\.y, autoMap: bl\.dfBlock\?\.rmbBlock\?\.fldHeader\?\.autoMapData, landmark: arenaTownLandmark\(bl\.dfBlock\) \}\)\), townWallCellsOf\(dfLocation\), loc\.width\),/);
});

test('AUDIT TESA III E1-2 with ARENA2: Daggerfall, Wayrest and Sentinel on the bench - their rings opened on the door\'s read, a walk grid off their blocks\' laid bytes shut on every cell of their walls, their town maps drawing them; off the raw bytes no wall byte stands in Daggerfall\'s blocks at all (mutant: the bytes unlaid)', { skip: skipReal }, async () => {
  installWorldDataReplacement();
  const { BlocksFile } = await import('../../src/formats/blocksFile.js');
  const { MapsFile } = await import('../../src/formats/mapsFile.js');
  const bytes = (n) => new Uint8Array(readFileSync(join(ARENA2, n)));
  const blocks = new BlocksFile(); blocks.load(bytes('BLOCKS.BSA'));
  const maps = new MapsFile(); maps.load(bytes('MAPS.BSA'), bytes('CLIMATE.PAK'), bytes('POLITIC.PAK')); maps.autoDiscard = false;
  const seen = new Set();
  for (let r = 0; r < 62; r++) {
    const reg = maps.getRegion(r);
    if (!reg) continue;
    for (let l = 0; l < reg.locationCount; l++) {
      const loc = maps.getLocation(r, l);
      if (!loc || !['Daggerfall', 'Wayrest', 'Sentinel'].includes(loc.name) || loc.mapTableData.locationType !== 0) continue;
      assert.equal(wallBayCity(loc, maps, blocks), true, `${loc.name}: walled on its outline`);
      const { width: w, height: h, blockNames } = loc.exterior.exteriorData;
      const own = (bx, by) => { const n = blockNames[by * w + bx]; return isWallCarrier(n) || n === TOWN_OUTLINE_BLOCK ? new Uint8Array(4096) : blocks.getBlockByName(n).rmbBlock.fldHeader.autoMapData; };
      const cells = townWallCellsOf(loc);
      // PIN MOVED (TS8, bible/03-World/Town-Shapes.md): a bend's tower its body alone, its two open stubs gone - Daggerfall's
      // wall 9,610 cells where it was 12,513 (Sentinel's 9,439, Wayrest's 9,591), each still one ring
      assert.ok(cells.reduce((n, v) => n + v, 0) > 9000, `${loc.name}: its wall`);
      const nav = navOf(w, h, own, (bx, by, raw) => wallLaidBytes(loc, bx, by, raw));
      assert.ok([...cells].every((v, i) => !v || nav.grid[i] === 0), `${loc.name}: every wall cell shut`);
      if (loc.name === 'Daggerfall') {
        let raw = 0;
        for (let by = 0; by < h; by++) for (let bx = 0; bx < w; bx++) raw += own(bx, by).filter((v) => v === WALL_BYTE).length;
        assert.equal(raw, 0, 'Daggerfall\'s own blocks hold no wall byte once its ring is open - the bench drew none');
      }
      seen.add(loc.name);
    }
  }
  assert.deepEqual([...seen].sort(), ['Daggerfall', 'Sentinel', 'Wayrest']);
});

test('AUDIT TESA III E1-4 THE DEEP WATERS BAKE BLENDS A TOWN AS THE STREAMED BUILD DOES: a coastal location\'s row carries its outline (TOWN-SHAPES TS2\'s `shape`) beside its rect, the lookup hands it to the bake\'s water test, the bake\'s key moves with its bytes, and the generator\'s version moved so no bake kept off the rect alone is read (mutants: the outline unread by the lookup; unkept in the key; the version unmoved)', () => {
  const shape = new Uint8Array(128 * 128);
  shape[64 * 128 + 64] = 1;
  const rows = [[250500, 10, 20, 30, 40, shape], [100, 1, 2, 3, 4]];
  assert.deepEqual(rectsLookup(rows)(500, 250), { xMin: 10, xMax: 20, yMin: 30, yMax: 40, shape }, 'the outline handed on');
  assert.equal(rectsLookup(rows)(500, 250).shape, shape);
  assert.deepEqual(rectsLookup(rows)(100, 0), { xMin: 1, xMax: 2, yMin: 3, yMax: 4 }, 'a row with none, as before');
  const moved = Uint8Array.from(shape);
  moved[64 * 128 + 65] = 1;
  assert.notEqual(rectsFingerprint(rows), rectsFingerprint([[250500, 10, 20, 30, 40, moved], [100, 1, 2, 3, 4]]), 'an outline moved moves the key');
  assert.equal(rectsFingerprint([[100, 1, 2, 3, 4]]), rectsFingerprint([[100, 1, 2, 3, 4]]));
  assert.equal(BAKE_GENERATOR_VERSION, 3, 'the bake\'s rules moved: a coastal town\'s blend its outline\'s (was 1), then the sea a town\'s ease reaches lifted (was 2)');   // PIN MOVED (FB1028): 3 (test/world/terrain/fb1028_townground.test.js)
  assert.match(bakeCacheKey({ woodsHash: 1, rectsHash: 2 }), new RegExp(`^dwbake:v${BAKE_GENERATOR_VERSION}:1:2$`));
  assert.match(rd('src/world/deepWater/deepWatersClient.js'), /rows\.push\(\[py \* 1000 \+ px, r\.xMin, r\.xMax, r\.yMin, r\.yMax, \.\.\.\(r\.shape \? \[r\.shape\] : \[\]\)\]\);/);
});

test('AUDIT TESA III E1-4 with ARENA2: Antelibuton and Aldwall Rock - the bake\'s water test over the row Deep Waters is handed is the streamed build\'s ground, sample for sample; the rect alone (the bake before) called thousands of their sea samples land (mutant: the outline left off the row)', { skip: skipReal }, async () => {
  const { BlocksFile } = await import('../../src/formats/blocksFile.js');
  const { MapsFile, longitudeLatitudeToMapPixel } = await import('../../src/formats/mapsFile.js');
  const { WoodsFile } = await import('../../src/formats/woodsFile.js');
  const TT = await import('../../src/world/terrain/terrainTiles.js');
  const { generateSamples } = await import('../../src/world/terrain/terrainSampler.js');
  const { deepWatersLocationRects } = await import('../../src/world/deepWater/deepWatersClient.js');
  const { pixelWaterSampler, WATER_THRESHOLD } = await import('../../src/world/deepWater/deepWatersBake.js');
  const bytes = (n) => new Uint8Array(readFileSync(join(ARENA2, n)));
  const blocks = new BlocksFile(); blocks.load(bytes('BLOCKS.BSA'));
  const maps = new MapsFile(); maps.load(bytes('MAPS.BSA'), bytes('CLIMATE.PAK'), bytes('POLITIC.PAK')); maps.autoDiscard = false;
  const woods = new WoodsFile(); woods.load(bytes('WOODS.WLD'));
  const HD = 129, got = new Map();
  for (let r = 0; r < 62; r++) {
    const reg = maps.getRegion(r);
    if (!reg) continue;
    for (let l = 0; l < reg.locationCount; l++) {
      const loc = maps.getLocation(r, l);
      if (!loc || !['Antelibuton', 'Aldwall Rock'].includes(loc.name)) continue;
      const p = longitudeLatitudeToMapPixel(loc.mapTableData.longitude, loc.mapTableData.latitude);
      const [row] = deepWatersLocationRects(woods, [[p.x, p.y, loc]], maps, blocks);
      assert.ok(row?.[5] instanceof Uint8Array, `${loc.name}: its row carries its outline`);
      // the streamed build's ground (terrainGen.js: the outline's blend, the sea read on DFU's own samples)
      const S = generateSamples(woods, p.x, p.y), [avg] = TT.calcAvgMaxHeight(S);
      TT.blendLocationTerrain(S, avg, TT.setLocationTiles(loc, maps, blocks, new Uint8Array(128 * 128)), HD, Float32Array.from(S));
      const off = (rect) => { const w = pixelWaterSampler(woods, p.x, p.y, rect); let n = 0; for (let x = 0; x < HD; x++) for (let y = 0; y < HD; y++) if (w.water(x, y) !== (S[x * HD + y] <= WATER_THRESHOLD)) n++; return n; };
      assert.equal(off(rectsLookup([row])(p.x, p.y)), 0, `${loc.name}: the bake's water the ground's`);
      got.set(loc.name, off(rectsLookup([row.slice(0, 5)])(p.x, p.y)));
    }
  }
  assert.deepEqual([...got.keys()].sort(), ['Aldwall Rock', 'Antelibuton']);
  for (const [name, n] of got) assert.ok(n > 1000, `${name}: the rect alone called ${n} samples otherwise`);
});
