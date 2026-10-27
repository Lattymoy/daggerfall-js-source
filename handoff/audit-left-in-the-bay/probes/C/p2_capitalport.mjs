// C probe 2: a capital's harbour slice is a port on the registry (world/pastBayRows.js) - and its stood location's
// exterior says portTownAndUnknown 0 (world/tamrielCapitals.js), so portTownByData (systems/portPlaces.js) - the
// shipyard / lighthouse / docks gate (scenes/pixelBuild.js portTown) - answers false there.
import { setup, imp } from './setup.mjs';
const { tesaRows } = await setup();
const { isCapitalPlaceId, CAPITALS } = await imp('world/tamrielCapitals.js');
const { portTownByData } = await imp('systems/portPlaces.js');
const { hasPort } = await imp('systems/travel/travelPorts.js');
const ports = tesaRows.filter((r) => r.port);
const capPorts = ports.filter((r) => isCapitalPlaceId(r.mapId));
console.log('ports past the Bay on the registry:', ports.length, '- of them a capital\'s harbour slice:', capPorts.length);
for (const r of capPorts) {
  const loc = { mapTableData: { mapId: r.mapId }, exterior: { exteriorData: { portTownAndUnknown: 0 } } };   // tamrielCapitals.js synthesizeCapitalLocation's literal
  console.log(`  ${r.name} (${r.px},${r.py}) mapId=0x${(r.mapId >>> 0).toString(16)} low20=${r.mapId & 0xfffff} hasPort=${hasPort(r.mapId)} portTownByData=${portTownByData(loc, hasPort)}`);
}
const arenaPorts = ports.filter((r) => !isCapitalPlaceId(r.mapId));
console.log('Arena ports (synthesizeArenaLocation writes portTownAndUnknown: place.port ? 1 : 0):', arenaPorts.length);
