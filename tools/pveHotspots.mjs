#!/usr/bin/env node
// REGION-HOTSPOT (bible/05-Combat/Fixed-PvE.md section 9): THE BAY'S HOT SPOTS, measured from the game's own map. Each
// Bay region's hot spot is its land pixel farthest from the region's edge and the sea; its reach is how far the region's
// land runs from there (the 90th centile). Prints the table src/systems/pve/pveHotspots.js holds.
//
//   ARENA2_PATH=/home/claude/dfdata/arena2 node tools/pveHotspots.mjs
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isMain } from './lib/isMain.mjs';
import { MapsFile } from '../src/formats/mapsFile.js';
import { BAY_REGION_COUNT } from '../src/formats/mapsTables.js';

const W = 1000, H = 500, OCEAN = 223;

/** Each Bay region's [x, y, reach], or null where it holds no land. @param {MapsFile} maps */
export function bayHotspots(maps) {
  const region = new Int16Array(W * H).fill(-1);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {   // BAY-OWN: MAPS.BSA's own pixels, the Bay's data
    if (maps.getClimateIndex(x, y) === OCEAN) continue;
    const p = maps.getPoliticIndex(x, y);
    if (p >= 128 || p === 64) region[y * W + x] = maps.getRegionIndexAt(x, y);
  }
  // distance to the region's edge: a breadth-first walk in from every pixel whose neighbour is another region or sea
  const dist = new Int32Array(W * H).fill(-1), queue = [];
  for (let i = 0; i < W * H; i++) {
    if (region[i] < 0) continue;
    const x = i % W, y = (i / W) | 0;
    const edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
      const nx = x + dx, ny = y + dy;
      return nx < 0 || ny < 0 || nx >= W || ny >= H || region[ny * W + nx] !== region[i];
    });
    if (edge) { dist[i] = 0; queue.push(i); }
  }
  for (let q = 0; q < queue.length; q++) {
    const i = queue[q], x = i % W, y = (i / W) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, j = ny * W + nx;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H || dist[j] >= 0 || region[j] !== region[i]) continue;
      dist[j] = dist[i] + 1; queue.push(j);
    }
  }
  const best = new Array(BAY_REGION_COUNT).fill(-1);
  for (let i = 0; i < W * H; i++) { const r = region[i]; if (r >= 0 && r < BAY_REGION_COUNT && (best[r] < 0 || dist[i] > dist[best[r]])) best[r] = i; }
  const reach = best.map(() => []);
  for (let i = 0; i < W * H; i++) { const r = region[i]; if (r >= 0 && r < BAY_REGION_COUNT && best[r] >= 0) reach[r].push(Math.hypot(i % W - best[r] % W, ((i / W) | 0) - ((best[r] / W) | 0))); }
  return best.map((i, r) => {
    if (i < 0) return null;
    const d = reach[r].sort((a, b) => a - b), far = d[Math.floor(d.length * 0.9)];
    return [i % W, (i / W) | 0, Math.max(4, Math.round(far))];
  });
}

if (isMain(import.meta.url)) {
  const A = process.env.ARENA2_PATH;
  if (!A) { console.error('set ARENA2_PATH (sh tools/fetch-data.sh)'); process.exit(1); }
  const maps = new MapsFile();
  maps.load(readFileSync(join(A, 'MAPS.BSA')), readFileSync(join(A, 'CLIMATE.PAK')), readFileSync(join(A, 'POLITIC.PAK')));
  console.log(JSON.stringify(bayHotspots(maps)));
}
