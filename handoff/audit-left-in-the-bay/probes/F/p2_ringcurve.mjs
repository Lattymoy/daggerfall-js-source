// TS9 past the Bay: the ring's half tiles painted by the straight painter (the Bay) vs the curved one (past the Bay)
import { imp } from './setup.mjs';
const { paintRoads, TILE } = await imp('src/world/road/roadPainter.js');
const { townRoadRing } = await imp('src/world/terrain/terrainTiles.js');
const { RING } = await imp('src/world/townShape.js');
const { DIR } = await imp('src/world/road/roadNetwork.js');
const D = 128;
// a diamond town (45-degree edges), centre 64,64, radius 30
const mask = new Uint8Array(D * D);
for (let y = 0; y < D; y++) for (let x = 0; x < D; x++) if (Math.abs(x - 63.5) + Math.abs(y - 63.5) <= 30) mask[y * D + x] = 1;
const ring = townRoadRing(mask);
let codes = { road: 0, half: 0 }; for (const v of ring) { if (v === RING.road) codes.road++; else if (v) codes.half++; }
const grass = new Uint8Array(129 * 129).fill(TILE.grass);
const rect = { xMin: 40, xMax: 88, yMin: 40, yMax: 88, mask, ring };
const run = (curve) => {
  const tm = new Uint8Array(D * D);
  for (let i = 0; i < D * D; i++) if (mask[i]) tm[i] = 1;   // the town's own tiles stamped
  paintRoads(grass, tm, DIR.N | DIR.S, 0, rect, 129, curve ? { curve: { px: -50, py: -50, byteAt: (kind, x, y) => (kind === 'roads' && x === -50 && (y === -50 || y === -51 || y === -49) ? (DIR.N | DIR.S) : 0) } } : {});
  let whole = 0, halves = 0;
  for (let i = 0; i < D * D; i++) { if (!ring[i]) continue; const v = tm[i]; if (!v) continue; if (ring[i] === RING.road) whole++; else halves++; }
  return { whole, halves };
};
console.log('ring codes', codes);
console.log('Bay (straight painter):', run(false));
console.log('past the Bay (curved painter):', run(true));
