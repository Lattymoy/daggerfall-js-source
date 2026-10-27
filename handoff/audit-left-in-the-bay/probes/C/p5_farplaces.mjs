// C probe 5: the Overworld's far places (systems/travel/travelFarPlaces.js) over the host's index as scenes/world.js
// gathers it - ONCE, the first time the view asks (`_tvSettlements ??= settlementPixels(locationIndex)`), the index holding
// the Bay's MAPS.BSA rows from the boot and a place past the Bay only once its pixel is built. Here: the index at the
// first ask (the Bay's rows + the place the player stands in), and what the edge then marks about towns past the Bay,
// against what the registry's listed settlements alone would put there.
import { setup, imp } from './setup.mjs';
const { gameRows, tesaRows } = await setup();
const { settlementPixels, farPlaces, TV_FAR_RANGE } = await imp('systems/travel/travelFarPlaces.js');
const { longitudeLatitudeToMapPixel, LOCATION_TYPES } = await imp('formats/mapsFile.js');
const { isCapitalPlaceId } = await imp('world/tamrielCapitals.js');
const SETTLE = new Set([LOCATION_TYPES.TownCity, LOCATION_TYPES.TownHamlet, LOCATION_TYPES.TownVillage]);
const index = new Map();
for (const loc of gameRows) { const p = longitudeLatitudeToMapPixel(loc.mapTableData.longitude, loc.mapTableData.latitude); index.set(`${p.x},${p.y}`, loc); }
const towns = tesaRows.filter((r) => SETTLE.has(r.type) && (!isCapitalPlaceId(r.mapId) || (r.mapId & 0x7ffff) < 16));   // a capital once (its centre)
const stand = (r) => ({ name: r.name, mapTableData: { mapId: r.mapId, locationType: r.type } });
let sumWant = 0, sumGot = 0, n = 0;
for (const here of towns) {
  const idx = new Map(index); idx.set(`${here.px},${here.py}`, stand(here));   // the first ask made standing in this town
  const settlements = settlementPixels(idx);
  const known = (x, y) => { const l = idx.get(`${x},${y}`); return l ? { mapId: l.mapTableData.mapId } : null; };   // every place found (the best case)
  const got = farPlaces({ at: { x: here.px, y: here.py }, near: 3, settlements, summaryOf: known }).length;
  const want = towns.filter((t) => t !== here && Math.max(Math.abs(t.px - here.px), Math.abs(t.py - here.py)) > 3 && Math.hypot(t.px - here.px, t.py - here.py) <= TV_FAR_RANGE).length;
  sumWant += Math.min(want, 10); sumGot += got; n++;
}
console.log(`listed towns past the Bay: ${n}; mean far plates the edge could mark (listed places alone, max 10): ${(sumWant / n).toFixed(2)}; mean it marks with the boot's index: ${(sumGot / n).toFixed(2)}`);
let bw = 0, bn = 0;
const baySet = [...index.entries()].filter(([, l]) => SETTLE.has(l.mapTableData.locationType)).map(([k]) => k.split(',').map(Number));
for (let i = 0; i < baySet.length; i += 50) { const [x, y] = baySet[i]; bw += Math.min(10, baySet.filter(([a, b]) => Math.max(Math.abs(a - x), Math.abs(b - y)) > 3 && Math.hypot(a - x, b - y) <= TV_FAR_RANGE).length); bn++; }
console.log(`on the Bay (every 50th settlement): mean far plates (all found, max 10): ${(bw / bn).toFixed(2)}`);
