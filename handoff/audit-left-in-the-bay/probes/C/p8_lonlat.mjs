// C probe 8: a place past the Bay's map pixel through its row's longitude/latitude and back (what portTownOnSea,
// the index's boot and every longitudeLatitudeToMapPixel reader do with a location past the Bay).
import { imp } from './setup.mjs';
const { longitudeLatitudeToMapPixel, mapPixelToLongitudeLatitude } = await imp('formats/mapsFile.js');
for (const [x, y] of [[500, 250], [1569, -430], [2069, 668], [-200, -300], [8, 1533], [1922, 1705], [-1500, 900]]) {
  const ll = mapPixelToLongitudeLatitude(x, y); const p = longitudeLatitudeToMapPixel(ll.x, ll.y);
  console.log(`(${x},${y}) -> ll(${ll.x},${ll.y}) -> (${p.x},${p.y}) ${p.x === x && p.y === y ? 'ok' : 'MISMATCH'}`);
}
