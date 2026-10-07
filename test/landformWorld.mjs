// LANDFORM1-3: THE LANDFORMS' SYNTHETIC WORLD - a WOODS.WLD the real reader loads and a network in Basic Roads' own
// layout, so the landforms are pinned with no game data. One home for test/landform.test.js and AUDIT LANDFORMS'
// pins (test/auditlandforms.test.js).
import { MAP_WIDTH, MAP_HEIGHT } from '../src/formats/woodsFile.js';
import { DIR } from '../src/world/roadNetwork.js';

/** A WOODS.WLD the real reader loads: the sea west of x = 100, land rising east, one mountain at (400, 250) up to the
 *  7-bit top, and four large-map cells taken in turn so the large heightmap is not one value everywhere. */
export function syntheticWoodsBytes() {
  const offsetsStart = 32 + 28 * 4;
  const cellsStart = offsetsStart + MAP_WIDTH * MAP_HEIGHT * 4;
  const CELL = 22 + 25;
  const heightMapOffset = cellsStart + 4 * CELL;
  const out = new Uint8Array(heightMapOffset + MAP_WIDTH * MAP_HEIGHT);
  const v = new DataView(out.buffer);
  v.setUint32(0, MAP_WIDTH * MAP_HEIGHT * 4, true);
  v.setUint32(4, MAP_WIDTH, true);
  v.setUint32(8, MAP_HEIGHT, true);
  v.setUint32(16, cellsStart, true);
  v.setUint32(28, heightMapOffset, true);
  for (let c = 0; c < 4; c++) for (let i = 0; i < 25; i++) out[cellsStart + c * CELL + 22 + i] = 6 + ((i * 7 + c * 5) % 9);
  for (let y = 0; y < MAP_HEIGHT; y++) {
    for (let x = 0; x < MAP_WIDTH; x++) {
      v.setUint32(offsetsStart + (y * MAP_WIDTH + x) * 4, cellsStart + ((x + 2 * y) % 4) * CELL, true);
      const land = x < 100 ? 0 : Math.round((x - 100) * 0.35);
      const cone = Math.max(0, 60 - Math.hypot(x - 400, y - 250) * 0.6);
      out[heightMapOffset + y * MAP_WIDTH + x] = Math.min(127, Math.round(land + cone));
    }
  }
  return out;
}
/** A network in Basic Roads' layout - one compass byte a map pixel, y * 1000 + x. */
export function network({ water = true } = {}) {
  const n = { roads: new Uint8Array(MAP_WIDTH * MAP_HEIGHT), tracks: new Uint8Array(MAP_WIDTH * MAP_HEIGHT), rivers: new Uint8Array(MAP_WIDTH * MAP_HEIGHT), streams: new Uint8Array(MAP_WIDTH * MAP_HEIGHT), water, smooth: true };
  const set = (arr, x, y, m) => { arr[y * MAP_WIDTH + x] |= m; };
  for (let y = 240; y <= 262; y++) set(n.roads, 300, y, DIR.N | DIR.S);              // a road north-south over the land
  for (let x = 280; x <= 320; x++) set(n.rivers, x, 255, DIR.E | DIR.W);             // a river east-west, under it
  for (let k = 0; k < 8; k++) set(n.tracks, 290 + k, 244 - k, DIR.NE | DIR.SW);      // a track on the diagonal
  for (let y = 245; y <= 252; y++) set(n.streams, 312, y, DIR.N | DIR.S);             // a stream
  for (let x = 92; x <= 112; x++) set(n.roads, x, 200, DIR.E | DIR.W);               // a road down to the beach
  for (let x = 92; x <= 112; x++) set(n.rivers, x, 300, DIR.E | DIR.W);              // and a river out to sea
  return n;
}
