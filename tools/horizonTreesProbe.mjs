// HORIZON-TREES (2026-10-27; KPbICA through the owner: "Strange projections above the horizon line"; bible/03-World/
// Tamriel.md RELIEF-PEAKS Cause 7, bible/06-Systems/Travel-View.md HORIZON-TREES): THE BAND'S TREES AGAINST THE MIDDLE
// RING'S SKYLINE, ON THE FREEWARE.
//
// The far pass has no depth among its layers, and the band (render/farTrees.js) is drawn last in it: before this slice
// every band tree stood whole over the middle ring's hills. This reads, from one point of the Bay, every tree of the band
// ring past the streamed grid (world/terrain/floraCover.js bandTreesPixel, the worker's own law) against the middle ring's
// heights (world/terrain/midRingGrid.js buildMidRingHeights) by the band's own skyline law (farTrees.js skylineAt - the
// vertex program's, run in WebGL2 against it by transform feedback when this slice was made), and counts the trees the
// nearer ground hides: whole (no longer drawn) and in part (drawn above the skyline alone). The streamed grid's pixels are
// left to the depth test, as the program leaves them.
//
// Run:  ARENA2_PATH=/home/claude/dfdata/arena2 node tools/horizonTreesProbe.mjs
//   AT=<px>,<py>   the traveller's pixel (default 2046,325 - the Bay's, RELIEF-PEAKS' own)
//   UP=<m>         the eye over the ground at the pixel's middle (default 300: the Overworld's)
//   R=<radius>     the streamed grid's radius (default 5: Land View 5)
//   TREE=<m>       a tree's height for the count (default 12)
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { WoodsFile } from '../src/formats/woodsFile.js';
import { PakFile } from '../src/formats/pakFile.js';
import { getWorldClimateSettings } from '../src/formats/mapsFile.js';
import { TERRAIN_SIZE } from '../src/world/terrain/terrainSampler.js';
import { bandTreesPixel } from '../src/world/terrain/floraCover.js';
import { buildMidRingHeights, midRingSide, MID_RADIUS, MID_SUB } from '../src/world/terrain/midRingGrid.js';
import { bandPixels, skylineAt } from '../src/render/farTrees.js';

const arena2 = process.env.ARENA2_PATH;
if (!arena2) throw new Error('horizonTreesProbe: ARENA2_PATH (sh tools/fetch-data.sh)');
const [bx, by] = (process.env.AT ?? '2046,325').split(',').map(Number);
const up = Number(process.env.UP ?? 300),
  radius = Number(process.env.R ?? 5),
  tall = Number(process.env.TREE ?? 12);
const woods = new WoodsFile();
if (!woods.load(new Uint8Array(readFileSync(join(arena2, 'WOODS.WLD'))))) throw new Error('WOODS.WLD did not load');
const climate = new PakFile();
climate.load(new Uint8Array(readFileSync(join(arena2, 'CLIMATE.PAK'))));

// the middle ring about the traveller's pixel, its vertex (0, 0) in the band's frame (x east, z north from the base
// pixel's south-west corner)
const side = midRingSide(),
  cell = TERRAIN_SIZE / MID_SUB,
  back = MID_RADIUS * MID_SUB * cell;
const heights = buildMidRingHeights({ woods, baseX: bx, baseY: by });
const ground = { heights, side, cell, x0: -back, z0: -back };
const mid = (MID_RADIUS * MID_SUB + MID_SUB / 2) * (side + 1);
const eye = [TERRAIN_SIZE / 2, heights[mid] + up, TERRAIN_SIZE / 2];
const built = new Set();
for (let y = by - radius; y <= by + radius; y++)
  for (let x = bx - radius; x <= bx + radius; x++) built.add(`${x},${y}`);
const builtAt = (x, z) => built.has(`${bx + Math.floor(x / TERRAIN_SIZE)},${by - Math.floor(z / TERRAIN_SIZE)}`);

let trees = 0,
  hidden = 0,
  cut = 0;
const t0 = Date.now();
for (const [px, py] of bandPixels(bx, by, radius, built)) {
  const c = getWorldClimateSettings(climate.getValue(px + 1, py));
  const t = bandTreesPixel({ woods, px, py, archive: c.natureArchive, climateType: c.climateType, forests: true });
  for (let i = 0; i < t.length; i += 4) {
    const foot = [(px - bx) * TERRAIN_SIZE + t[i], t[i + 1], (by - py) * TERRAIN_SIZE + t[i + 2]];
    const sky = skylineAt(eye, foot, ground, builtAt);
    trees++;
    if (sky >= foot[1] + tall) hidden++;
    else if (sky > foot[1]) cut++;
  }
}
const pc = (n) => `${((100 * n) / Math.max(1, trees)).toFixed(1)}%`;
console.log(
  `horizonTreesProbe: from ${bx},${by}, ${up} m up, the grid's radius ${radius}: ${trees} band trees (${Math.round((Date.now() - t0) / 1000)} s)`,
);
console.log(
  `  behind the middle ring's ground whole: ${hidden} (${pc(hidden)}) - stood over its hills before, not drawn now`,
);
console.log(
  `  behind it in part (a ${tall} m tree): ${cut} (${pc(cut)}) - drawn whole before, above the skyline alone now`,
);
