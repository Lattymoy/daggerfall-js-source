// @ts-check
// GROUND-GATE (FIELD BUGS 2026-10-17f; bible/01-Overview/bugs/Field-Bugs-2026-10-17f.md): THE GROUND'S PRINT. The relay
// refuses a ground room's hello from a build on an older ground (net/wire.js GROUND_LAW), so the law has to move every
// time the ground does - and a number beside a comment asking politely is forgotten (SLAM8's lesson, RELAY_VERSION's).
// The print is the shaped ground as online stands it (world/terrain/terrainGen.js generatePixelTerrain, landforms on)
// over the landforms' synthetic world (test/landformWorld.mjs - no game data): a pixel by the network's road and river
// and one on the mountain's flank, in each of CLIMATE.PAK's lands, read every GROUND_PRINT_STEP samples in decimetres.
// test/net/fb1017f_groundgate.test.js holds the ground to the print recorded under the law this tree names: a move past
// GROUND_PRINT_TOLERANCE_M anywhere is a new ground, and the law moves with it. Inside it is a float's noise.
//
//   node tools/groundPrint.mjs --write    records the print under GROUND_LAW (test/fixtures/groundPrint.json)
import { writeFileSync } from 'node:fs';
import { isMain } from './lib/isMain.mjs';
import { WoodsFile, MAP_WIDTH, MAP_HEIGHT } from '../src/formats/woodsFile.js';
import { generatePixelTerrain } from '../src/world/terrain/terrainGen.js';
import { MAX_TERRAIN_HEIGHT, STREAMING_TERRAIN_SCALE, HEIGHTMAP_DIMENSION } from '../src/world/terrain/terrainSampler.js';
import { landformSites } from '../src/world/landforms.js';
import { CLIMATES } from '../src/formats/mapsTables.js';
import { GROUND_LAW } from '../src/net/wire.js';
import { syntheticWoodsBytes, network } from '../test/landformWorld.mjs';

/** Every how many samples the print reads a pixel (17 x 17 of its 129 x 129). */
export const GROUND_PRINT_STEP = 8;
/** How far a sample may move and stand on the same ground, metres - a float's noise is millimetres; a peer drawn this
 *  far off its feet is not seen to float. */
export const GROUND_PRINT_TOLERANCE_M = 0.5;
/** The pixels read in each land: by the network's road, track and river; on the mountain's flank by its site. */
export const GROUND_PRINT_PIXELS = Object.freeze([[300, 250], [399, 250]]);
/** The recorded print's home. */
export const GROUND_PRINT_FILE = new URL('../test/fixtures/groundPrint.json', import.meta.url);

/** The print of the ground this tree stands: `{ law, step, cells: { '<land>@<px>,<py>': decimetres[] } }`. */
export function groundPrint() {
  const woods = new WoodsFile();
  woods.load(syntheticWoodsBytes());
  const roads = network();
  const sites = landformSites([{ px: 400, py: 250, loc: { exterior: { exteriorData: { width: 3, height: 3 } }, mapTableData: { locationType: 0 } } }]);
  const metres = MAX_TERRAIN_HEIGHT * STREAMING_TERRAIN_SCALE;
  /** @type {Record<string, number[]>} */
  const cells = {};
  for (const [land, climateType] of Object.entries(CLIMATES)) {
    const climates = new Uint8Array(MAP_WIDTH * MAP_HEIGHT).fill(climateType);
    for (const [px, py] of GROUND_PRINT_PIXELS) {
      const { samples } = generatePixelTerrain({ woods, px, py, stride: 1, tilemap: new Uint8Array(128 * 128), climateType, roads, sites, climates, landform: true });
      const out = [];
      for (let y = 0; y < HEIGHTMAP_DIMENSION; y += GROUND_PRINT_STEP) for (let x = 0; x < HEIGHTMAP_DIMENSION; x += GROUND_PRINT_STEP) out.push(Math.round(samples[y * HEIGHTMAP_DIMENSION + x] * metres * 10));
      cells[`${land}@${px},${py}`] = out;
    }
  }
  return { law: GROUND_LAW, step: GROUND_PRINT_STEP, cells };
}

/** How far the ground moved from a recorded print, metres, and where most: `{ most, at }` (`at` null when no cell moved). */
export function groundMoved(recorded, now) {
  let most = 0, at = null;
  for (const [k, cell] of Object.entries(now.cells)) {
    const was = recorded.cells?.[k];
    if (!Array.isArray(was) || was.length !== cell.length) return { most: Infinity, at: k };
    for (let i = 0; i < cell.length; i++) { const d = Math.abs(cell[i] - was[i]) / 10; if (d > most) { most = d; at = k; } }
  }
  if (Object.keys(recorded.cells ?? {}).length !== Object.keys(now.cells).length) return { most: Infinity, at: 'the cells read' };
  return { most, at };
}

if (isMain(import.meta.url)) {
  if (!process.argv.includes('--write')) { console.log('node tools/groundPrint.mjs --write records the print under GROUND_LAW'); process.exit(0); }
  const print = groundPrint();
  writeFileSync(GROUND_PRINT_FILE, `${JSON.stringify(print)}\n`);
  console.log(`the ground's print recorded under GROUND_LAW ${print.law}: ${Object.keys(print.cells).length} cells`);
}
