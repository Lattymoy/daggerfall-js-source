// A grown village (or city) on the ground print's gentle hill, through the real kernel: the town tools/groundPrint.mjs
// prints, built as a pixel's job would build it, the Landforms row on or off.
import { WoodsFile, MAP_WIDTH, MAP_HEIGHT } from '../src/formats/woodsFile.js';
import { generatePixelTerrain } from '../src/world/terrain/terrainGen.js';
import { CLIMATES } from '../src/formats/mapsTables.js';
import { landformSites } from '../src/world/landforms.js';
import { syntheticWoodsBytes, network } from './landformWorld.mjs';
import { GROUND_PRINT_GROWN, PRINT_GROWTH, PRINT_GROWTH_CITY, printTownRect } from '../tools/groundPrint.mjs';

const [gx, gy] = GROUND_PRINT_GROWN;
const gentle = new WoodsFile();
gentle.load(syntheticWoodsBytes());
for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) gentle.heightMapBuffer[(gy + dy) * MAP_WIDTH + gx + dx] = 60 + 4 * dx;
const sites = landformSites([{ px: 400, py: 250, loc: { exterior: { exteriorData: { width: 3, height: 3 } }, mapTableData: { locationType: 0 } } }]);
const woodlands = new Uint8Array(MAP_WIDTH * MAP_HEIGHT).fill(CLIMATES.Woodlands);

/** The town's pixel built. @param {{ city?: boolean, landform?: boolean }} [o] */
export function grow({ city = false, landform = true } = {}) {
  const rect = printTownRect();
  return generatePixelTerrain({ woods: gentle, px: gx, py: gy, stride: 1, tilemap: new Uint8Array(128 * 128), climateType: CLIMATES.Woodlands, roads: network(), sites, climates: woodlands, landform,
    locationRect: rect, hasLocation: true, about: [{ px: gx, py: gy, shape: rect.shape }], growth: city ? PRINT_GROWTH_CITY : PRINT_GROWTH, natureArchive: 504 });
}
