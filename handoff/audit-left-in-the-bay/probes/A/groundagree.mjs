// Probe: pixelBuild.js:243 spawnGroundPlace.groundLocationAt(px, py, null) on an online build PAST THE BAY with the
// composed ground (world.js: woods = groundWoods(woods); _spawnGround = createSpawnGround(woods); cloneAt = _spawnCloneAt).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const R = '/home/user/daggerfall-js-source/src/';
globalThis.atob ??= (s) => Buffer.from(s, 'base64').toString('binary');
const A2 = process.env.ARENA2_PATH;
const bytes = (n) => new Uint8Array(readFileSync(join(A2, n)));
const { DFPalette } = await import(R + 'formats/dfPalette.js');
const { preloadTamrielTrace } = await import(R + 'ui/tamrielTrace.js');
const { setTamrielTrace } = await import(R + 'world/tamriel/tamrielLand.js');
const { setTamrielFit } = await import(R + 'world/tamriel/tamrielFrame.js');
const { MapsFile, REGION_NAMES } = await import(R + 'formats/mapsFile.js');
const { WoodsFile } = await import(R + 'formats/woodsFile.js');
const { groundMaps, groundWoods } = await import(R + 'world/tamriel/tamrielGround.js');
const sd = await import(R + 'world/spawnedDungeons.js');
const { createSpawnGroundPlace } = await import(R + 'world/spawnGroundPlace.js');
const pal = new DFPalette(); pal.load(bytes('ART_PAL.COL'), 'ART_PAL.COL');
setTamrielTrace(await preloadTamrielTrace({ fetchBytes: async (n) => bytes(n), palette: pal, indexedDBRef: null }));
setTamrielFit({ ox: 38 * 15.5, oy: 57 * 15.5, ppu: 15.5 });
const maps = new MapsFile(); maps.load(bytes('MAPS.BSA'), bytes('CLIMATE.PAK'), bytes('POLITIC.PAK'));
groundMaps(maps);
const raw = new WoodsFile(); raw.load(bytes('WOODS.WLD'));
const woods = groundWoods(raw);
const locs = [];
for (let r = 0; r < maps.regionCount; r++) { if (!maps.getRegion(r)) continue; for (let l = 0; l < maps.baseLocationCount(r); l++) { const loc = maps.getLocation(r, l); if (loc) locs.push(loc); } }
const templates = sd.spawnTemplates(locs);
console.log('templates', templates.length);
let cloneCalls = 0, threw = 0, firstErr = null;
const cloneAt = (px, py) => {
  cloneCalls++;
  const template = sd.pickTemplate(templates, sd.WORLD_SALT, px, py);
  const regionIndex = maps.getRegionIndexAt(px, py);
  try { return sd.synthesizeDungeonLocation(template, { salt: sd.WORLD_SALT, px, py, where: { regionIndex, regionName: REGION_NAMES[regionIndex], politic: maps.getPoliticIndex(px, py), climate: {} }, elite: sd.isEliteSpawn(sd.WORLD_SALT, px, py) }); }
  catch (e) { threw++; firstErr ??= e.message; throw e; }
};
const place = createSpawnGroundPlace({ maps, online: true, etherSea: false, plateauDry: sd.createSpawnGround(woods), terrainGen: { roads: () => null }, cloneAt, spawnGone: () => false, zoneMask: () => null });
let asked = 0, uncaught = 0;
for (let y = -380; y < -360; y++) for (let x = 2200; x < 2240; x++) {   // Skyrim, about Windhelm's row
  asked++;
  try { place.groundLocationAt(x, y, null); } catch { uncaught++; }
}
console.log(`Skyrim 40x20 pixels: groundLocationAt asked ${asked}, cloneAt reached ${cloneCalls}, threw ${uncaught} (${firstErr})`);
cloneCalls = 0; threw = 0; uncaught = 0; asked = 0;
for (let y = 130; y < 150; y++) for (let x = 600; x < 640; x++) { asked++; try { place.groundLocationAt(x, y, null); } catch { uncaught++; } }
console.log(`Bay 40x20 pixels: asked ${asked}, cloneAt reached ${cloneCalls}, threw ${uncaught}`);
// Density: of random Bay land pixels with no MAPS.BSA place, how many stand an online spawn (roll + dry), how many elite.
const { isWaterPixel } = await import(R + 'ui/overworldModel.js');
const { CLIMATES } = await import(R + 'formats/mapsFile.js');
const held = new Set(locs.map((l) => { const id = (l.mapTableData.mapId >>> 0) & 0xfffff; return id; }));
const dry = sd.createSpawnGround(woods);
let land = 0, stands = 0, elite = 0, seed = 12345;
const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296);
while (land < 3000) {
  const x = Math.floor(rnd() * 1000), y = Math.floor(rnd() * 500);
  if (held.has(y * 1000 + x) || isWaterPixel(maps.getClimateIndex(x, y), woods.getHeightMapValue(x, y))) continue;
  land++;
  if (!sd.spawnsDungeon(sd.WORLD_SALT, x, y) || maps.getClimateIndex(x, y) === CLIMATES.Ocean || !dry(x, y)) continue;
  stands++; if (sd.isEliteSpawn(sd.WORLD_SALT, x, y)) elite++;
}
console.log(`Bay: of ${land} land pixels with no MAPS.BSA place, ${stands} stand an online spawn (${(100 * stands / land).toFixed(1)}%), ${elite} of them Elite; MAPS.BSA places ${held.size} over the Bay`);
