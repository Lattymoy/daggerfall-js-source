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
// BAY-LEFT-GROUND (bible/03-World/Landforms.md "BAY-LEFT-GROUND"): AND PAST THE BAY - the print read the Bay's synthetic
// pixels alone, so a ground that moved past the Bay (its towns' sites, D1) moved under GROUND_LAW unseen. It reads two
// pixels of the continent composed round the synthetic world too (world/tamriel/tamrielGround.js groundWoods on the
// authored shape - no trace, no game data): a town past the Bay by its site, and its neighbour the site pulls.
//
// FB1028 TOWN-GROUND (bible/03-World/Town-Shapes.md "TS2 at FB1028"): AND A TOWN'S GROUND - every pixel read stood with
// no location, so the print held the same cells under GROUND_LAW 2 and 3 while a town's blend moved its ground by up to
// 292 m. It reads a town too: a 4 x 4 grid of blocks, its outline drawn by the game's own law (world/terrain/terrainTiles.js
// locationShapeField), on a hillside the synthetic world's own ground is too gentle to hold (20 bytes a pixel, about 375 m
// across it), flattened and eased as the stream lays it. TS2's 12-sample ease moves its print by 7.9 m.
//
// FB1029 GROUND (bible/01-Overview/bugs/Field-Bugs-2026-10-29c.md): AND THE TWO NEW LAWS. ACROSS-EDGE: a town on a
// cliff over its sea, and the sea north of it its meet raises (the town asked of both, as the stream asks it). ROAD-DRY:
// Basic Roads' road across a pixel of open sea, its paving lifted. The town's cell asks its own meet too.
//
//   node tools/groundPrint.mjs --write    records the print under GROUND_LAW (test/fixtures/groundPrint.json)
import { writeFileSync } from 'node:fs';
import { isMain } from './lib/isMain.mjs';
import { WoodsFile, MAP_WIDTH, MAP_HEIGHT } from '../src/formats/woodsFile.js';
import { generatePixelTerrain } from '../src/world/terrain/terrainGen.js';
import { locationShapeField } from '../src/world/terrain/terrainTiles.js'; // FB1028: a town's outline
import {
  MAX_TERRAIN_HEIGHT,
  STREAMING_TERRAIN_SCALE,
  HEIGHTMAP_DIMENSION,
} from '../src/world/terrain/terrainSampler.js';
import { landformSites, landformSitesBeyond } from '../src/world/landforms.js';
import { groundWoods, dropGroundCache } from '../src/world/tamriel/tamrielGround.js'; // BAY-LEFT-GROUND: the continent round the synthetic world
import { tamrielTrace, setTamrielTrace } from '../src/world/tamriel/tamrielLand.js';
import { tamrielFit, setTamrielFit } from '../src/world/tamriel/tamrielFrame.js';
import { CLIMATES } from '../src/formats/mapsTables.js';
import { GROUND_LAW } from '../src/net/wire.js';
import { syntheticWoodsBytes, network } from '../test/landformWorld.mjs';

/** Every how many samples the print reads a pixel (17 x 17 of its 129 x 129). */
export const GROUND_PRINT_STEP = 8;
/** How far a sample may move and stand on the same ground, metres - a float's noise is millimetres; a peer drawn this
 *  far off its feet is not seen to float. */
export const GROUND_PRINT_TOLERANCE_M = 0.5;
/** The pixels read in each land: by the network's road, track and river; on the mountain's flank by its site. */
export const GROUND_PRINT_PIXELS = Object.freeze([
  [300, 250],
  [399, 250],
]);
/** BAY-LEFT-GROUND: the pixels read past the Bay - a town's (its site past the Bay, 6 x 6 blocks) and its east
 *  neighbour's - on the continent the authored shape stands east of the Bay (Morrowind's land). */
export const GROUND_PRINT_BEYOND = Object.freeze([
  [3840, 759],
  [3841, 759],
]);
/** FB1028: the town read, its outline a 4 x 4 grid of blocks, its ground a hillside rising 20 bytes a pixel east. */
export const GROUND_PRINT_TOWN = Object.freeze([420, 270]);
/** FB1029 ACROSS-EDGE: the town over its sea - 6 x 6 blocks on land 30 bytes high, the three rows north of it the sea's. */
export const GROUND_PRINT_MEET = Object.freeze([150, 400]);
/** FB1029 ROAD-DRY: the pixel of open sea the road down to the beach crosses (test/landformWorld.mjs network). */
export const GROUND_PRINT_ROAD = Object.freeze([96, 200]);
/** The recorded print's home. */
export const GROUND_PRINT_FILE = new URL('../test/fixtures/groundPrint.json', import.meta.url);

/** FB1028: the town's rect and outline - a house on each block's middle, its tiles stamped (the 4 x 4 grid's tiles 32-95,
 *  DFU's clearance of 2 round them). FB1029: `blocks` a side (6: tiles 16-111). */
function printTownRect(blocks = 4) {
  const groundTiles = Array.from({ length: 16 }, () =>
    Array.from({ length: 16 }, () => ({ textureRecord: 2, tileBitfield: 2 })),
  );
  const am = new Uint8Array(64 * 64);
  for (let r = 16; r < 48; r++) for (let c = 16; c < 48; c++) am[r * 64 + c] = 5;
  const rmb = {
    fldHeader: { autoMapData: am, groundData: { groundTiles } },
    misc3dObjectRecords: [],
    miscFlatObjectRecords: [],
  };
  const loc = {
    exterior: { exteriorData: { width: blocks, height: blocks, blockNames: Array(blocks * blocks).fill('T.RMB') } },
    mapTableData: { mapId: 270420, locationType: 2 },
  };
  const lo = 64 - blocks * 8 - 2,
    hi = 64 + blocks * 8 + 1;
  return { xMin: lo, xMax: hi, yMin: lo, yMax: hi, shape: locationShapeField(loc, () => rmb) };
}
/** FB1029 ROAD-DRY: the sea everywhere - every byte 0, so every sample stands at the ocean's clamp. */
const SEA_WOODS = Object.freeze({
  getHeightMapValuesRange1Dim: (x, y, d) => new Uint8Array(d * d),
  getLargeHeightMapValuesRange: (x, y, d) => new Uint8Array(d * 3 * d * 3),
  getHeightMapValue: () => 0,
});
/** A pixel's samples as the print reads them, decimetres. @param {ArrayLike<number>} samples */
const printed = (samples) => {
  const out = [],
    metres = MAX_TERRAIN_HEIGHT * STREAMING_TERRAIN_SCALE;
  for (let y = 0; y < HEIGHTMAP_DIMENSION; y += GROUND_PRINT_STEP)
    for (let x = 0; x < HEIGHTMAP_DIMENSION; x += GROUND_PRINT_STEP)
      out.push(Math.round(samples[y * HEIGHTMAP_DIMENSION + x] * metres * 10));
  return out;
};

/** The print of the ground this tree stands: `{ law, step, cells: { '<land>@<px>,<py>': decimetres[] } }`. */
export function groundPrint() {
  const woods = new WoodsFile();
  woods.load(syntheticWoodsBytes());
  const roads = network();
  const sites = landformSites([
    {
      px: 400,
      py: 250,
      loc: { exterior: { exteriorData: { width: 3, height: 3 } }, mapTableData: { locationType: 0 } },
    },
  ]);
  /** @type {Record<string, number[]>} */
  const cells = {};
  for (const [land, climateType] of Object.entries(CLIMATES)) {
    const climates = new Uint8Array(MAP_WIDTH * MAP_HEIGHT).fill(climateType);
    for (const [px, py] of GROUND_PRINT_PIXELS) {
      cells[`${land}@${px},${py}`] = printed(
        generatePixelTerrain({
          woods,
          px,
          py,
          stride: 1,
          tilemap: new Uint8Array(128 * 128),
          climateType,
          roads,
          sites,
          climates,
          landform: true,
        }).samples,
      );
    }
  }
  // FB1028: a town's ground, in the woodlands, on its own copy of the world with the hillside stamped
  const [tx, ty] = GROUND_PRINT_TOWN,
    hill = new WoodsFile();
  hill.load(syntheticWoodsBytes());
  for (let dy = -3; dy <= 3; dy++)
    for (let dx = -3; dx <= 3; dx++) hill.heightMapBuffer[(ty + dy) * MAP_WIDTH + tx + dx] = 60 + 20 * dx;
  const woodlands = new Uint8Array(MAP_WIDTH * MAP_HEIGHT).fill(CLIMATES.Woodlands),
    townRect = printTownRect();
  const town = generatePixelTerrain({
    woods: hill,
    px: tx,
    py: ty,
    stride: 1,
    tilemap: new Uint8Array(128 * 128),
    climateType: CLIMATES.Woodlands,
    roads,
    sites,
    climates: woodlands,
    landform: true,
    locationRect: townRect,
    hasLocation: true,
    about: [{ px: tx, py: ty, shape: townRect.shape }],
  });
  cells[`Town@${tx},${ty}`] = printed(town.samples);
  // FB1029 ACROSS-EDGE: a town on a cliff over its sea, and the sea north of it its meet raises
  const [mx, my] = GROUND_PRINT_MEET,
    cliff = new WoodsFile();
  cliff.load(syntheticWoodsBytes());
  for (let dy = -3; dy <= 3; dy++)
    for (let dx = -3; dx <= 3; dx++) cliff.heightMapBuffer[(my + dy) * MAP_WIDTH + mx + dx] = dy < 0 ? 0 : 30;
  const meetRect = printTownRect(6),
    about = [{ px: mx, py: my, shape: meetRect.shape }];
  for (const [px, py] of [
    [mx, my],
    [mx, my - 1],
  ]) {
    const own = px === mx && py === my ? { locationRect: { ...meetRect }, hasLocation: true } : {};
    cells[`Meet@${px},${py}`] = printed(
      generatePixelTerrain({
        woods: cliff,
        px,
        py,
        stride: 1,
        tilemap: new Uint8Array(128 * 128),
        climateType: CLIMATES.Woodlands,
        roads,
        sites,
        climates: woodlands,
        landform: true,
        about,
        ...own,
      }).samples,
    );
  }
  // FB1029 ROAD-DRY: the road down to the beach across a pixel of open sea
  const [rx, ry] = GROUND_PRINT_ROAD;
  cells[`Road@${rx},${ry}`] = printed(
    generatePixelTerrain({
      woods: SEA_WOODS,
      px: rx,
      py: ry,
      stride: 1,
      tilemap: new Uint8Array(128 * 128),
      climateType: CLIMATES.Woodlands,
      roads,
      sites,
      climates: woodlands,
      landform: true,
    }).samples,
  );
  // BAY-LEFT-GROUND: past the Bay, on the authored shape whatever the caller has landed (the trace and the fit put back)
  const trace = tamrielTrace(),
    fit = tamrielFit();
  setTamrielTrace(null);
  setTamrielFit(null);
  dropGroundCache();
  try {
    const continent = groundWoods(woods);
    const [tx, ty] = GROUND_PRINT_BEYOND[0];
    const beyond = landformSitesBeyond([
      {
        px: tx,
        py: ty,
        loc: {
          exterior: { exteriorData: { width: 6, height: 6, blockNames: ['X'] } },
          mapTableData: { locationType: 2 },
        },
      },
    ]);
    for (const [px, py] of GROUND_PRINT_BEYOND) {
      cells[`Beyond@${px},${py}`] = printed(
        generatePixelTerrain({
          woods: continent,
          px,
          py,
          stride: 1,
          tilemap: new Uint8Array(128 * 128),
          climateType: CLIMATES.Woodlands,
          roads,
          sites,
          beyond,
          climates: null,
          landform: true,
        }).samples,
      );
    }
  } finally {
    setTamrielTrace(trace);
    setTamrielFit(fit);
    dropGroundCache();
  }
  return { law: GROUND_LAW, step: GROUND_PRINT_STEP, cells };
}

/** How far the ground moved from a recorded print, metres, and where most: `{ most, at }` (`at` null when no cell moved). */
export function groundMoved(recorded, now) {
  let most = 0,
    at = null;
  for (const [k, cell] of Object.entries(now.cells)) {
    const was = recorded.cells?.[k];
    if (!Array.isArray(was) || was.length !== cell.length) return { most: Infinity, at: k };
    for (let i = 0; i < cell.length; i++) {
      const d = Math.abs(cell[i] - was[i]) / 10;
      if (d > most) {
        most = d;
        at = k;
      }
    }
  }
  if (Object.keys(recorded.cells ?? {}).length !== Object.keys(now.cells).length)
    return { most: Infinity, at: 'the cells read' };
  return { most, at };
}

if (isMain(import.meta.url)) {
  if (!process.argv.includes('--write')) {
    console.log('node tools/groundPrint.mjs --write records the print under GROUND_LAW');
    process.exit(0);
  }
  const print = groundPrint();
  writeFileSync(GROUND_PRINT_FILE, `${JSON.stringify(print)}\n`);
  console.log(`the ground's print recorded under GROUND_LAW ${print.law}: ${Object.keys(print.cells).length} cells`);
}
