// D-weather probe: the weather map's field births at sea past the Bay read the nearest Bay edge pixel's climate
// (systems/weather/weatherMap.js climateOfField), not the sea's.
import { setup, imp } from './base.mjs';
const { maps } = await setup();
const { CLIMATES } = await imp('formats/mapsFile.js');
const names = Object.fromEntries(Object.entries(CLIMATES).map(([k, v]) => [v, k]));
const clamp = (x, y) => [Math.min(999, Math.max(0, x)), Math.min(499, Math.max(0, y))];
const seas = { 'Sea of Ghosts N of Skyrim': [1900, -620], 'Abecean Sea W of Summerset': [-200, 1500], 'Topal Bay S of Elsweyr': [2100, 1900], 'off Black Marsh E': [3700, 1100], 'Padomaic Ocean SE': [3600, 1600], 'Inner Sea Morrowind': [2900, 280] };
for (const [n, [x, y]] of Object.entries(seas)) {
  const c = maps.getClimateIndex(x, y); const [cx, cy] = clamp(x, y); const e = maps.getClimateIndex(cx, cy);
  console.log(n.padEnd(28), `(${x},${y})`, 'own', names[c], '-> field reads edge', `(${cx},${cy})`, names[e]);
}
