// The R1 eyeball probe: generate a network over synthetic terrain and
// render it, because "the road avoids the ridge" is a claim about a
// picture and a passing assertion is not a picture.
//
// Not part of the suite. Run: node tools/roadProbe.mjs

import fs from 'fs';
import { PNG } from 'pngjs';
import {
  buildCostField, buildRoadNetwork, roadKindAt, ROAD_TRUNK, ROAD_TRACK,
} from '../src/systems/roads.js';
import { CLIMATES, LOCATION_TYPES } from '../src/formats/mapsFile.js';

const W = 220, H = 150;

// Real topography EVERYWHERE, not off in a corner: the point is to
// watch a road refuse a ridge, so the ridges have to sit under the
// towns. The first version of this fixture made the whole east one
// flat plateau and confined every town to a coastal strip, which
// exercised the gradient term barely at all.
const hb = new Uint8Array(W * H);
const clim = new Uint8Array(W * H);
const hill = (cx, cy, rx, ry, amp, rot = 0) => (x, y) => {
  const c = Math.cos(rot), s = Math.sin(rot);
  const u = ((x - cx) * c + (y - cy) * s) / rx;
  const v = (-(x - cx) * s + (y - cy) * c) / ry;
  return amp * Math.exp(-(u * u + v * v));
};
const hills = [
  hill(58, 46, 30, 9, 165, 0.5), hill(96, 96, 34, 10, 150, -0.6),
  hill(150, 44, 26, 11, 175, 0.9), hill(170, 108, 22, 14, 140, -0.2),
  hill(112, 30, 15, 20, 120, 0.0), hill(40, 112, 18, 12, 110, 0.4),
];
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const i = y * W + x;
    const shore = 14 + 9 * Math.sin(y * 0.09) + 26 * Math.exp(-((y - 74) ** 2) / 300);
    let h = Math.min(46, (x - shore) * 2.2);
    for (const f of hills) h += f(x, y);
    h += 7 * Math.sin(x * 0.06) * Math.cos(y * 0.08) + 5 * Math.sin((x + y) * 0.13);
    hb[i] = Math.max(0, Math.min(255, Math.round(h)));
    if (hb[i] <= 3) clim[i] = CLIMATES.Ocean;
    else if (hb[i] > 128) clim[i] = CLIMATES.Mountain;
    else if (hb[i] < 30 && y > 100) clim[i] = CLIMATES.Swamp;
    else if (y < 34) clim[i] = CLIMATES.Subtropical;
    else clim[i] = CLIMATES.Woodlands;
  }
}

const climateAt = (x, y) => clim[y * W + x];
const isWater = (climate, byte) => climate === CLIMATES.Ocean || byte <= 3;
const field = buildCostField({ heightBytes: hb, width: W, height: H, climateAt, isWater });

// xorshift32 via Math.imul. A textbook LCG is WRONG here: in JS
// seed * 1103515245 exceeds 2**53, the multiply loses precision and
// the generator degenerates - it hung the full-scale fixture outright
// and was producing usable output in this one only by luck.
let seed = 20260827;
const rnd = () => {
  seed ^= seed << 13; seed |= 0;
  seed ^= seed >>> 17;
  seed ^= seed << 5; seed |= 0;
  return (seed >>> 0) / 4294967296;
};

const locations = [];
const T = [LOCATION_TYPES.TownCity, LOCATION_TYPES.TownHamlet, LOCATION_TYPES.TownVillage,
  LOCATION_TYPES.HomeFarms, LOCATION_TYPES.DungeonRuin, LOCATION_TYPES.ReligionTemple];
const weights = [6, 10, 14, 16, 10, 8];
const total = weights.reduce((a, b) => a + b, 0);
for (let k = 0; k < 78; k++) {
  let x, y, tries = 0;
  do {
    x = 2 + Math.floor(rnd() * (W - 4));
    y = 2 + Math.floor(rnd() * (H - 4));
  } while (!(field.cost[y * W + x] < Infinity) && ++tries < 400);
  if (tries >= 400) continue;
  let r = rnd() * total, ti = 0;
  while (r > weights[ti] && ti < weights.length - 1) { r -= weights[ti]; ti++; }
  locations.push({ x, y, locationType: T[ti] });
}

const t0 = Date.now();
const { network, stats } = buildRoadNetwork({ field, heightBytes: hb, locations });
console.log('built in', Date.now() - t0, 'ms');
console.log(stats);

const png = new PNG({ width: W * 4, height: H * 4 });
const put = (x, y, r, g, b) => {
  for (let sy = 0; sy < 4; sy++) {
    for (let sx = 0; sx < 4; sx++) {
      const o = ((y * 4 + sy) * W * 4 + (x * 4 + sx)) << 2;
      png.data[o] = r; png.data[o + 1] = g; png.data[o + 2] = b; png.data[o + 3] = 255;
    }
  }
};
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const i = y * W + x, b = hb[i], c = clim[i];
    let col;
    if (c === CLIMATES.Ocean) col = [26, 46, 74];
    else if (c === CLIMATES.Swamp) col = [58, 68, 48];
    else if (c === CLIMATES.Mountain) col = [104, 98, 92];
    else if (c === CLIMATES.Subtropical) col = [110, 108, 66];
    else col = [58, 82, 54];
    const nb = hb[Math.min(H - 1, y + 1) * W + Math.min(W - 1, x + 1)];
    const sh = 0.45 + Math.min(1.05, b / 150)
      + Math.max(-0.3, Math.min(0.3, (nb - b) * 0.035));
    col = col.map((v) => Math.min(255, v * sh));
    if (b > 3 && b % 24 < 2) col = col.map((v) => Math.min(255, v * 1.18));
    const k = roadKindAt(network, x, y);
    if (k === ROAD_TRUNK) col = [232, 196, 128];
    else if (k === ROAD_TRACK) col = [150, 126, 92];
    put(x, y, col[0] | 0, col[1] | 0, col[2] | 0);
  }
}
for (const l of locations) {
  const hub = l.locationType === LOCATION_TYPES.TownCity
    || l.locationType === LOCATION_TYPES.TownHamlet;
  const c = hub ? [255, 240, 180] : [190, 120, 110];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (l.x + dx >= 0 && l.y + dy >= 0 && l.x + dx < W && l.y + dy < H) {
        put(l.x + dx, l.y + dy, c[0], c[1], c[2]);
      }
    }
  }
}

// Direction-run audit: median run tells you whether the router is
// interleaving diagonals with axis steps or emitting them in blocks.
const runs = [];
for (const seg of network.segments) {
  const d = [];
  for (let i = 1; i < seg.points.length; i++) {
    d.push(`${seg.points[i].x - seg.points[i - 1].x},${seg.points[i].y - seg.points[i - 1].y}`);
  }
  if (!d.length) continue;
  let cur = 1;
  for (let i = 1; i < d.length; i++) {
    if (d[i] === d[i - 1]) cur++; else { runs.push(cur); cur = 1; }
  }
  runs.push(cur);
}
runs.sort((a, b) => a - b);
console.log('direction runs:', {
  runs: runs.length,
  mean: +(runs.reduce((a, b) => a + b, 0) / runs.length).toFixed(2),
  median: runs[runs.length >> 1],
  longest: runs[runs.length - 1],
});

fs.writeFileSync('/home/claude/roads_probe.png', PNG.sync.write(png));
console.log('wrote /home/claude/roads_probe.png');
