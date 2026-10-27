// RUMARE-WATER's capitalSea.js over the OTHER shore capitals: water samples per slice, this tree (head or base)
import { setup, imp, bytes } from './setup.mjs';
const { ground, maps } = await setup();
const { BlocksFile } = await imp('src/formats/blocksFile.js');
const wd = await imp('src/formats/worldData/worldDataReplacement.js');
const tc = await imp('src/world/tamrielCapitals.js');
const { installCapitals } = await imp('src/world/capitalModels.js');
const { isMainStoryDungeon } = await imp('src/world/dungeon/dungeonTextures.js');
const { setLocationTiles } = await imp('src/world/terrain/terrainTiles.js');
const { generatePixelTerrain } = await imp('src/world/terrain/terrainGen.js');
const { WATER_THRESHOLD } = await imp('src/world/deepWater/deepWatersBake.js');
const { HEIGHTMAP_DIMENSION: H, MAX_TERRAIN_HEIGHT, SCALED_OCEAN_ELEVATION } = await imp('src/world/terrain/terrainSampler.js');
const rows = [];
for (let r = 0; r < maps.regionCount; r++) { if (!maps.getRegion(r)) continue; for (let l = 0; l < maps.baseLocationCount(r); l++) { const loc = maps.getLocation(r, l); if (loc) rows.push(loc); } }
const blocks = new BlocksFile(); blocks.load(bytes('BLOCKS.BSA'));
wd.installWorldDataReplacement(); wd.bindWorldDataBlocks(blocks);
installCapitals({ addTextures: () => 0 });
const base = tc.capitalBase(rows, isMainStoryDungeon), names = tc.cityBlockNames(rows);
for (const [k, cap] of tc.CAPITALS.entries()) {
  if (!cap.shore) continue;
  const at = tc.capitalCentrePixel(k);
  if (!at) { console.log(cap.name, 'no pixel'); continue; }
  const n = cap.span ?? 1, h = (n - 1) / 2;
  const out = [];
  for (let sy = 0; sy < n; sy++) for (let sx = 0; sx < n; sx++) {
    const px = at.px + sx - h, py = at.py + sy - h, a = tc.capitalOnPixel(px, py), tm = new Uint8Array(16384);
    const loc = tc.synthesizeCapitalLocation(a, { base, names, blockOf: (nm) => blocks.getBlockByName(nm), px, py }), rect = setLocationTiles(loc, maps, blocks, tm);
    const g = generatePixelTerrain({ woods: ground, px, py, tilemap: tm, locationRect: rect, hasLocation: true, climateType: 0, flattenAt: loc.capital.flattenAt, bed: true });
    let wet = 0, waterTiles = 0;
    for (let i = 0; i < H * H; i++) if (g.samples[i] <= WATER_THRESHOLD) wet++;
    for (let i = 0; i < 128 * 128; i++) { const t = g.tilemap[i]; if (t === 0xff || (t & 0x3f) === 0) waterTiles++; }
    out.push(`[${sx},${sy}] wet ${wet} waterTiles ${waterTiles} centre ${(g.samples[64 * H + 64] * MAX_TERRAIN_HEIGHT * 1.25).toFixed(1)}m`);
  }
  console.log(cap.name, 'span', n, out.join(' | '));
}
