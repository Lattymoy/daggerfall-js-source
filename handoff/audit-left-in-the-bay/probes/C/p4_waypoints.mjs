// C probe 4: a map waypoint (systems/map/mapWaypoints.js - personal, party, guild) on the land past the Bay.
import { imp } from './setup.mjs';
const W = await imp('systems/map/mapWaypoints.js');
const bay = W.addWaypoint({ kind: 'personal', mx: 500.5, my: 250.5, name: 'Bay spot' });
const solitude = W.addWaypoint({ kind: 'personal', mx: 1569.5, my: -429.5, name: 'Solitude' });
const elsweyr = W.addWaypoint({ kind: 'party', mx: 1922.5, my: 1705.5, name: 'Torval' });
console.log('on the Bay:', !!bay?.waypoint, '| Solitude:', solitude, '| Torval (party):', elsweyr);
console.log('a party line naming a point past the Bay, decoded:', W.decodeWaypointLine('[WP1] add abc123 1569.5 -429.5 red Solitude'));
console.log('the same on the Bay:', W.decodeWaypointLine('[WP1] add abc124 500.5 250.5 red Bay'));
