// D2 probe: Snowfall's world adapter past the Bay - the box SnowContextData.Prepare scans (scenes/snowfallHost.js
// snowPixelBox, the real export) for a player at Solitude, and world.js snowGround.pixelOn's Bay bound (quoted below).
import { imp } from './base.mjs';
import { readFileSync } from 'node:fs';
const { snowPixelBox } = await imp('scenes/snowfallHost.js');
const TS = 819.2;   // a map pixel in metres (TERRAIN_SIZE / 40 world units)
// Solitude's pixel (1569, -430): global metres x = px * 819.2, z = (499 - py) * 819.2 (world.js toGlobal's law)
for (const [name, px, py] of [['Solitude', 1569, -430], ['Torval', 1922, 1705], ['Daggerfall (Bay)', 207, 213]]) {
  const gx = (px + 0.5) * TS, gz = (499 - py + 0.5) * TS, r = 400;
  console.log(name, `pixel (${px},${py})`, 'box ->', JSON.stringify(snowPixelBox(gx - r, gz - r, gx + r, gz + r)));
}
const w = readFileSync('/home/user/daggerfall-js-source/src/scenes/world.js', 'utf8').split('\n');
const i = w.findIndex((l) => l.includes('pixelOn(px, py) {   // StreamingWorld.GetTerrainFromPixel'));
console.log(`world.js:${i + 1}-${i + 3}:\n` + w.slice(i, i + 3).join('\n'));
const r = readFileSync('/home/user/daggerfall-js-source/src/systems/snowfallRuntime.js', 'utf8').split('\n');
const j = r.findIndex((l) => l.includes('Math.min(819200, gx + span)'));
console.log(`snowfallRuntime.js:${j + 1}: ${r[j].trim()}`);
