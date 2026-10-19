// BANTHA2 (2026-10-19, bible/03-World/Bantha-Jungle.md "Where the jungle is") - THE OWNER'S RED, READ INTO MAP PIXELS.
//
// The owner's call, with a map of the Iliac Bay and an area of its south-eastern shore painted red: "The area is red in
// bantha and should be the jungle biome". Their map is Daggerfall's own 1000 x 500 at 0.4: it registers on the Bay's
// coasts at 2.5 map pixels a pixel and no offset (99.2 % of its sea on the map's sea). BANTHA_DRAWN below is their red,
// pixel for pixel (a run per row: [row, first, last, ...] on their 400 x 200 picture); `banthaArea` reads it into map
// pixels - the law src/world/jungle/banthaArea.js's BANTHA_AREA_ROWS was written by, and the test derives again
// (test/world/bantha2_area.test.js, with ARENA2):
//
//   1. THE DRAWING AT ITS OWN RESOLUTION. Each of their pixels is 2.5 map pixels (2 km) square, so a line they drew
//      at a slant is a staircase of 2 km steps. Their red is smoothed by a Gaussian of DRAWN_SIGMA of their pixels (it
//      takes the one-pixel steps and keeps every feature two pixels wide) and read at each map pixel's centre at a half.
//   2. HAMMERFELL'S LAND. A map pixel is the area's where POLITIC names it land of one of Hammerfell's regions
//      (REGION_RACES' Redguard): at the Bay's eastern end their red reached over the inlet onto a strip of Wayrest's and
//      Gavaudon's shore.
//   3. THE COAST IS ITS NORTH EDGE. Their map's coast stands a pixel or two off the map's own, so a column of the area
//      whose top is within COAST_REACH pixels of the water runs on up through Hammerfell's land to it (a top further
//      inland is where they drew it).
//   4. THE WATER IT CLOSES ROUND is the area's (a lake, a river's pool: the jungle's air and haze over it); the land it
//      left unpainted is not.
//
// Run:  ARENA2_PATH=/path/to/arena2 node tools/banthaArea.mjs   - prints the rows for banthaArea.js and their facts.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MapsFile, REGION_RACES, REGION_NAMES } from '../src/formats/mapsFile.js';
import { isMain } from './lib/isMain.mjs';

/** The owner's red on their 400 x 200 map: [row, first, last, first, last, ...]. */
export const BANTHA_DRAWN = Object.freeze([
  [108, 339, 340, 388, 399],
  [109, 359, 364, 390, 390, 394, 397],
  [110, 236, 237, 319, 323, 330, 334, 357, 362, 367, 369, 371, 372, 374, 375],
  [111, 236, 238, 258, 260, 277, 278, 299, 307, 318, 323, 326, 339, 345, 345, 356, 361, 364, 378, 381, 384],
  [112, 237, 237, 245, 247, 254, 254, 257, 264, 276, 281, 288, 289, 294, 308, 317, 339, 343, 345, 349, 358, 362, 388],
  [113, 243, 268, 274, 345, 349, 354, 360, 390, 398, 399],
  [114, 237, 334, 342, 343, 359, 399],
  [115, 237, 331, 358, 399],
  [116, 237, 331, 343, 399],
  [117, 237, 399],
  [118, 237, 250, 253, 399],
  [119, 238, 246, 248, 250, 253, 399],
  [120, 238, 244, 246, 250, 256, 399],
  [121, 238, 248, 257, 399],
  [122, 238, 244, 258, 399],
  [123, 242, 243, 258, 399],
  [124, 249, 249, 258, 399],
  [125, 258, 399],
  [126, 258, 399],
  [127, 257, 399],
  [128, 261, 399],
  [129, 264, 399],
  [130, 268, 399],
  [131, 271, 399],
  [132, 274, 399],
  [133, 277, 399],
  [134, 280, 399],
  [135, 283, 399],
  [136, 287, 399],
  [137, 290, 399],
  [138, 293, 399],
  [139, 296, 399],
  [140, 299, 399],
  [141, 302, 399],
  [142, 305, 399]

].map((r) => Object.freeze(r)));
/** Their picture's size, and its scale onto the map (map pixels a pixel of theirs). */
export const DRAWN_W = 400;
export const DRAWN_H = 200;
export const DRAWN_SCALE = 2.5;
/** The Gaussian their red is smoothed by (their pixels). */
export const DRAWN_SIGMA = 0.75;
/** How far a column of the area runs on up through the land to the water (map pixels). */
export const COAST_REACH = 6;
/** POLITIC's sea (MapsFile.getRegionIndexAt answers 31 for its 64). */
const SEA = 31;

/**
 * THE AREA on a `width` x `height` map: a Uint8Array, 1 the area's. `regionAt(x, y)` the map's region
 * (MapsFile.getRegionIndexAt), `races` REGION_RACES (1 Hammerfell's); `drawing` the red's rows (the owner's; a test's).
 * @param {{ width: number, height: number, regionAt: (x: number, y: number) => number, races: readonly number[], drawing?: readonly (readonly number[])[] }} o
 */
export function banthaArea({ width, height, regionAt, races, drawing = BANTHA_DRAWN }) {
  const W = DRAWN_W, H = DRAWN_H;
  const drawn = new Float64Array(W * H);
  for (const [v, ...runs] of drawing) for (let k = 0; k < runs.length; k += 2) for (let u = runs[k]; u <= runs[k + 1]; u++) drawn[v * W + u] = 1;
  // 1. the Gaussian, separable, its taps to three sigma and the edges held
  const R = 3, taps = [];
  let sum = 0;
  for (let i = -R; i <= R; i++) { const w = Math.exp(-(i * i) / (2 * DRAWN_SIGMA * DRAWN_SIGMA)); taps.push(w); sum += w; }
  for (let i = 0; i < taps.length; i++) taps[i] /= sum;
  const clampI = (i, n) => (i < 0 ? 0 : i >= n ? n - 1 : i);
  const across = new Float64Array(W * H), soft = new Float64Array(W * H);
  for (let v = 0; v < H; v++) for (let u = 0; u < W; u++) { let s = 0; for (let i = -R; i <= R; i++) s += taps[i + R] * drawn[v * W + clampI(u + i, W)]; across[v * W + u] = s; }
  for (let v = 0; v < H; v++) for (let u = 0; u < W; u++) { let s = 0; for (let i = -R; i <= R; i++) s += taps[i + R] * across[clampI(v + i, H) * W + u]; soft[v * W + u] = s; }
  const at = (fu, fv) => {
    const u = Math.min(Math.max(fu, 0), W - 1.001), v = Math.min(Math.max(fv, 0), H - 1.001);
    const u0 = Math.floor(u), v0 = Math.floor(v), a = u - u0, b = v - v0;
    return (soft[v0 * W + u0] * (1 - a) + soft[v0 * W + u0 + 1] * a) * (1 - b) + (soft[(v0 + 1) * W + u0] * (1 - a) + soft[(v0 + 1) * W + u0 + 1] * a) * b;
  };
  // 2. Hammerfell's land, and the drawing on it
  const region = new Int16Array(width * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) region[y * width + x] = regionAt(x, y);
  const south = (i) => region[i] !== SEA && races[region[i]] === 1;
  const area = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (south(i) && at((x + 0.5) / DRAWN_SCALE - 0.5, (y + 0.5) / DRAWN_SCALE - 0.5) >= 0.5) area[i] = 1;
    }
  }
  // 3. each column on up to the water - where the water is within COAST_REACH of its top (a top inland is the drawing's)
  for (let x = 0; x < width; x++) {
    let top = -1;
    for (let y = 0; y < height; y++) if (area[y * width + x]) { top = y; break; }
    if (top < 0) continue;
    let y = top - 1;
    while (y >= 0 && top - y <= COAST_REACH && south(y * width + x)) y--;
    if (y >= 0 && region[y * width + x] === SEA) for (let k = y + 1; k < top; k++) area[k * width + x] = 1;   // the walk stopped at the water, not at its reach
  }
  // 4. the water it closes round: each piece of the rest that touches no edge of the map and holds no land
  const seen = new Uint8Array(width * height);
  for (let s = 0; s < width * height; s++) {
    if (area[s] || seen[s]) continue;
    const piece = [s];
    seen[s] = 1;
    let open = false, dry = false;
    for (let q = 0; q < piece.length; q++) {
      const i = piece[q], x = i % width, y = (i - x) / width;
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) open = true;
      if (region[i] !== SEA) dry = true;
      for (const j of [x > 0 ? i - 1 : -1, x < width - 1 ? i + 1 : -1, y > 0 ? i - width : -1, y < height - 1 ? i + width : -1]) {
        if (j >= 0 && !area[j] && !seen[j]) { seen[j] = 1; piece.push(j); }
      }
    }
    if (!open && !dry) for (const i of piece) area[i] = 1;
  }
  return area;
}

/** The area as rows: [y, first, last, first, last, ...] for every row that holds any of it. */
export function areaRows(area, width, height) {
  const rows = [];
  for (let y = 0; y < height; y++) {
    const row = [y];
    for (let x = 0; x < width; x++) {
      if (!area[y * width + x]) continue;
      const first = x;
      while (x + 1 < width && area[y * width + x + 1]) x++;
      row.push(first, x);
    }
    if (row.length > 1) rows.push(row);
  }
  return rows;
}

if (isMain(import.meta.url)) {
  const A = process.env.ARENA2_PATH;
  if (!A) { console.log('banthaArea: set ARENA2_PATH to the ARENA2 folder (sh tools/fetch-data.sh)'); process.exit(0); }
  const rd = (f) => new Uint8Array(readFileSync(join(A, f)));
  const maps = new MapsFile(); maps.load(rd('MAPS.BSA'), rd('CLIMATE.PAK'), rd('POLITIC.PAK'));
  const W = 1000, H = 500;
  const area = banthaArea({ width: W, height: H, regionAt: (x, y) => maps.getRegionIndexAt(x, y), races: REGION_RACES });
  const rows = areaRows(area, W, H);
  const by = new Map(), clim = new Map();
  let n = 0;
  for (let i = 0; i < W * H; i++) {
    if (!area[i]) continue;
    n++;
    const x = i % W, y = (i - x) / W, r = REGION_NAMES[maps.getRegionIndexAt(x, y)], c = maps.getClimateIndex(x, y);
    by.set(r, (by.get(r) ?? 0) + 1); clim.set(c, (clim.get(c) ?? 0) + 1);
  }
  console.log(rows.map((r) => `  [${r.join(', ')}],`).join('\n'));
  console.log(`// ${n} pixels in ${rows.length} rows; regions ${JSON.stringify([...by].sort((a, b) => b[1] - a[1]))}; climates ${JSON.stringify([...clim].sort((a, b) => b[1] - a[1]))}`);
}
