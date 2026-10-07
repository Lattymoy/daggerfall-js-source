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
  // AUDIT LANDFORMS D8: a bend, a junction and their ends on the mountain's flank, where the arms' grades part - the
  // arm-weighting law's own ground (test/auditlandforms.test.js walks it sample by sample)
  set(n.roads, 350, 200, DIR.E);                                                     // an end
  for (let x = 351; x <= 353; x++) set(n.roads, x, 200, DIR.E | DIR.W);
  set(n.roads, 352, 200, DIR.S);                                                     // a junction: a road south
  for (let y = 201; y <= 203; y++) set(n.roads, 352, y, DIR.N | DIR.S);
  set(n.roads, 352, 204, DIR.N);
  set(n.roads, 354, 200, DIR.W | DIR.N);                                             // a bend: west, then north
  for (let y = 197; y <= 199; y++) set(n.roads, 354, y, DIR.N | DIR.S);
  set(n.roads, 354, 196, DIR.S);
  set(n.tracks, 356, 204, DIR.NE);                                                   // a track off the diagonal...
  set(n.tracks, 357, 203, DIR.SW | DIR.NE);
  set(n.tracks, 358, 202, DIR.SW | DIR.N);                                           // ...into the north-south
  set(n.tracks, 358, 201, DIR.S | DIR.N);
  set(n.tracks, 358, 200, DIR.S);
  // AUDIT LANDFORMS II J1/J2: a track that fords the river, a stream that joins it, and a road over that stream - water
  // met by every other layer, where the painter's order and the shaper's lerp must agree
  set(n.tracks, 285, 251, DIR.S);                                                    // a track north-south...
  for (let y = 252; y <= 258; y++) set(n.tracks, 285, y, DIR.N | DIR.S);             // ...across the river at (285, 255)
  set(n.tracks, 285, 259, DIR.N);
  set(n.streams, 316, 250, DIR.S);                                                   // a stream south...
  for (let y = 251; y <= 254; y++) set(n.streams, 316, y, DIR.N | DIR.S);
  set(n.streams, 316, 255, DIR.N);                                                   // ...into the river at (316, 255)
  set(n.roads, 314, 252, DIR.E);                                                     // a road east-west...
  for (let x = 315; x <= 317; x++) set(n.roads, x, 252, DIR.E | DIR.W);              // ...over the stream at (316, 252)
  set(n.roads, 318, 252, DIR.W);
  return n;
}
