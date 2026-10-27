// RUMARE-WATER: the Deep Waters bake's view of the city's water (rumareWaterSampler) vs the streamed build's ground
// (generatePixelTerrain), slice by slice; and the bake's rect vs setLocationTiles'
import { setup, imp, bytes } from './setup.mjs';
const { ground, maps } = await setup();
const { BlocksFile } = await imp('src/formats/blocksFile.js');
const wd = await imp('src/formats/worldData/worldDataReplacement.js');
const tc = await imp('src/world/tamrielCapitals.js');
const { installCapitals } = await imp('src/world/capitalModels.js');
const { isMainStoryDungeon } = await imp('src/world/dungeon/dungeonTextures.js');
const { setLocationTiles } = await imp('src/world/terrain/terrainTiles.js');
const { generatePixelTerrain } = await imp('src/world/terrain/terrainGen.js');
const { rumareWaterSampler } = await imp('src/world/tamrielWatersBake.js');
const { rumareSliceRect } = await imp('src/world/rumareWaters.js');
const { CAPITAL_RIM_TILES } = await imp('src/world/capitalPlans.js');
const { WATER_THRESHOLD } = await imp('src/world/deepWater/deepWatersBake.js');
const { HEIGHTMAP_DIMENSION: H } = await imp('src/world/terrain/terrainSampler.js');
const rows = [];
for (let r = 0; r < maps.regionCount; r++) { if (!maps.getRegion(r)) continue; for (let l = 0; l < maps.baseLocationCount(r); l++) { const loc = maps.getLocation(r, l); if (loc) rows.push(loc); } }
const blocks = new BlocksFile(); blocks.load(bytes('BLOCKS.BSA'));
wd.installWorldDataReplacement(); wd.bindWorldDataBlocks(blocks);
installCapitals({ addTextures: () => 0 });
const base = tc.capitalBase(rows, isMainStoryDungeon), names = tc.cityBlockNames(rows);
const gen = (px, py) => {
  const a = tc.capitalOnPixel(px, py), tm = new Uint8Array(16384);
  const loc = tc.synthesizeCapitalLocation(a, { base, names, blockOf: (nm) => blocks.getBlockByName(nm), px, py }), rect = setLocationTiles(loc, maps, blocks, tm);
  return { loc, rect, ...generatePixelTerrain({ woods: ground, px, py, tilemap: tm, locationRect: rect, hasLocation: true, climateType: 0, flattenAt: loc.capital.flattenAt, bed: true }) };
};
const cx = 2069, cy = 658;
const picks = [[0, 0], [0, 12], [0, -12], [12, 0], [-12, 0], [12, 12], [-12, -12], [12, -12], [-12, 12], [0, 11], [0, 10], [-1, 12], [1, 12], [2, 12], [5, 5], [-8, 3]];
for (const [dx, dy] of picks) {
  const px = cx + dx, py = cy + dy, g = gen(px, py);
  const br = rumareSliceRect(px, py, CAPITAL_RIM_TILES), r = g.rect;
  const rectSame = br && r && br.xMin === r.xMin && br.xMax === r.xMax && br.yMin === r.yMin && br.yMax === r.yMax;
  const s = rumareWaterSampler(ground, px, py);
  let differ = 0, wetGround = 0, wetBake = 0;
  for (let x = 0; x < H; x++) for (let y = 0; y < H; y++) {
    const a = g.samples[x * H + y] <= WATER_THRESHOLD, b = s.water(x, y);
    if (a) wetGround++; if (b) wetBake++; if (a !== b) differ++;
  }
  console.log(`(${dx},${dy}) rect ${rectSame ? 'same' : `DIFFERS bake ${JSON.stringify(br)} build ${JSON.stringify({ xMin: r?.xMin, xMax: r?.xMax, yMin: r?.yMin, yMax: r?.yMax })}`} water ground ${wetGround} bake ${wetBake} differ ${differ}`);
}
