// TAMRIEL-DEEP x RUMARE-WATER: what one Deep Waters promote of an Imperial City slice costs the worker, on a fresh bake
import { setup, imp, bytes } from './setup.mjs';
const { ground, maps } = await setup();
const { BlocksFile } = await imp('src/formats/blocksFile.js');
const wd = await imp('src/formats/worldData/worldDataReplacement.js');
const tc = await imp('src/world/tamrielCapitals.js');
const { installCapitals } = await imp('src/world/capitalModels.js');
const { isMainStoryDungeon } = await imp('src/world/dungeon/dungeonTextures.js');
const { setLocationTiles } = await imp('src/world/terrain/terrainTiles.js');
const { generatePixelTerrain } = await imp('src/world/terrain/terrainGen.js');
const { TamrielWatersBake } = await imp('src/world/tamrielWatersBake.js');
const { buildDeepWatersPixel } = await imp('src/world/deepWater/deepWatersPixel.js');
const { tamrielClimateAt } = await imp('src/world/tamriel/tamrielGround.js');
const rows = [];
for (let r = 0; r < maps.regionCount; r++) { if (!maps.getRegion(r)) continue; for (let l = 0; l < maps.baseLocationCount(r); l++) { const loc = maps.getLocation(r, l); if (loc) rows.push(loc); } }
const blocks = new BlocksFile(); blocks.load(bytes('BLOCKS.BSA'));
wd.installWorldDataReplacement(); wd.bindWorldDataBlocks(blocks);
installCapitals({ addTextures: () => 0 });
const base = tc.capitalBase(rows, isMainStoryDungeon), names = tc.cityBlockNames(rows);
const gen = (px, py) => {
  const a = tc.capitalOnPixel(px, py), tm = new Uint8Array(16384);
  const loc = tc.synthesizeCapitalLocation(a, { base, names, blockOf: (nm) => blocks.getBlockByName(nm), px, py }), rect = setLocationTiles(loc, maps, blocks, tm);
  return generatePixelTerrain({ woods: ground, px, py, tilemap: tm, locationRect: rect, hasLocation: true, climateType: 0, flattenAt: loc.capital.flattenAt, bed: true });
};
const b = new TamrielWatersBake({ woods: ground });
const promote = (px, py) => {
  const g = gen(px, py), climates = [];
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) climates.push(tamrielClimateAt(px + dx, py + dy));
  const t = performance.now();
  const r = buildDeepWatersPixel({ px, py, samples: g.samples, tilemap: g.tilemap, tilemapBytes: g.tilemapBytes, climates, waterDepth: 200 }, b);
  return [(performance.now() - t).toFixed(0), !!r?.floor];
};
// a traveller arriving on the Waterfront (2069, 668), then walking west along the lake
for (const [x, y] of [[2069, 668], [2068, 668], [2066, 668], [2062, 668], [2058, 664], [2069, 646]]) console.log(`promote (${x},${y}) ms, floor:`, promote(x, y));
