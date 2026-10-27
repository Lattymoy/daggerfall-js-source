// C probe 11: the map reveals (scenes/world.js revealLocation - a map item read, the Thieves Guild's and the Dark
// Brotherhood's promotions) walk maps.getRegion(the location's region).mapTable: past the Bay a town's region is its
// province's (62..70), which MAPS.BSA holds no record for.
import { setup, imp } from './setup.mjs';
const { maps, tesaRows, places } = await setup();
const { discoverRandomLocation } = await imp('systems/discovery.js');
for (const r of [17, 62, 64, 70]) {
  const region = maps.getRegion(r);
  const rows = region ? region.mapTable.map((row, i) => ({ mapId: row.mapId, discovered: row.discovered, name: region.mapNames[i], regionName: region.name })) : null;
  const picked = rows ? discoverRandomLocation(rows, () => 0.5) : null;
  const inProvince = r >= 62 ? tesaRows.filter((t) => places.at(t.px, t.py)?.region === r).length : null;
  console.log(`region ${r} (${maps.getRegionName(r)}): getRegion ${region ? 'a record' : 'null'} -> reveal ${picked ? `"${picked.name}"` : 'null (readMapFail / no promotion map)'}${inProvince != null ? `; the registry lists ${inProvince} places in it` : ''}`);
}
