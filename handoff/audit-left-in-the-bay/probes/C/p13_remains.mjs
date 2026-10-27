// C probe 13: WILD-WAYPOINT's remains flag (systems/wild/wildRemainsWaypoint.js markRemains, planted by scenes/world.js
// wildMineLies on a death in the open zone) - the zone is Cyrodiil (WW-C2), every pixel of it past the Bay.
import { imp } from './setup.mjs';
const { markRemains } = await imp('systems/wild/wildRemainsWaypoint.js');
const until = Date.now() + 3600e3;
console.log('remains by the Imperial City (2069.5, 658.5):', markRemains({ mx: 2069.5, my: 658.5, until }));
console.log('remains by Bruma (2030.5, 560.5):', markRemains({ mx: 2030.5, my: 560.5, until }));
console.log('the old Wrothgarian zone on the Bay (430.5, 120.5):', markRemains({ mx: 430.5, my: 120.5, until }));
