// C probe 6: a building's discovery is filed under `${regionIndex}:${name}` (scenes/world.js discoveryLocationId) - past
// the Bay a province is ONE region, so every place of one name in a province shares one book of discovered buildings.
import { setup, imp } from './setup.mjs';
const { tesaRows, places, maps } = await setup();
const { isCapitalPlaceId } = await imp('world/tamrielCapitals.js');
const keyOf = (r) => `${places.at(r.px, r.py)?.region ?? '?'}:${r.name}`;
const by = new Map();
for (const r of tesaRows) { const k = keyOf(r); (by.get(k) ?? by.set(k, []).get(k)).push(r); }
const shared = [...by.entries()].filter(([, l]) => l.length > 1);
console.log('listed places past the Bay:', tesaRows.length, '- discovery keys:', by.size, '- keys shared by 2+ places:', shared.length, '- places on a shared key:', shared.reduce((n, [, l]) => n + l.length, 0));
for (const [k, l] of shared.sort((a, b) => b[1].length - a[1].length).slice(0, 6)) console.log(`  ${k}: ${l.length} places${l.some((r) => isCapitalPlaceId(r.mapId)) ? ' (capital slices)' : ''}, e.g. at ${l.slice(0, 3).map((r) => `(${r.px},${r.py})`).join(' ')}`);
// the Bay for comparison: MAPS.BSA rows sharing region:name
const bay = new Map();
for (let r = 0; r < maps.regionCount; r++) { const g = maps.getRegion(r); if (!g) continue; g.mapNames.forEach((n) => { const k = `${r}:${n}`; bay.set(k, (bay.get(k) ?? 0) + 1); }); }
console.log('the Bay: keys shared by 2+ MAPS.BSA rows:', [...bay.values()].filter((n) => n > 1).length, 'of', bay.size);
