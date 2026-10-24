// @ts-check
// ═══════════════════════════════════════════════════════════════════
// HOME-VENDOR (net/vendorLaw.js) - THE TRADER'S WAYPOINT (Mac: "you should be able to set a waypoint where the trader is
// you want to buy from"). One waypoint at a time: the trader's house - its town's map id, the building's key there, whose
// it is and the town's name. Setting it puts its own gold coin on both world maps (ui/vendor/vendorMapMark.js -
// apart from the map's one yellow mark, which stays the player's), the house is named on the town map (scenes/world.js townHomes), and the compass
// points at the town until the player stands in it. Cleared by hand, or on walking into the house.
//
// Pure state: no DOM, no network. The host reads it each frame.
// ═══════════════════════════════════════════════════════════════════

/** @type {{ map: number, buildingKey: number, owner: string, town: string }|null} */
let _wp = null;
let _version = 0;

/** The waypoint, or null. */
export const vendorWaypoint = () => _wp;
/** A number that moves whenever the waypoint does (the town map repaints its marks on it). */
export const vendorWaypointVersion = () => _version;
/** `map:key` of the waypoint's house, or null - the board's and the page's "is this row the waypoint". */
export const vendorWaypointKey = () => (_wp ? `${_wp.map}:${_wp.buildingKey}` : null);

/** SET the waypoint on a trader's house (both world maps draw its own coin - ui/vendor/vendorMapMark.js). False for a row that names no house. */
export function setVendorWaypoint({ map, buildingKey, owner = '', town = '' } = /** @type {any} */ ({})) {
  if (!Number.isSafeInteger(map) || map <= 0 || !Number.isSafeInteger(buildingKey) || buildingKey <= 0) return false;
  _wp = Object.freeze({ map, buildingKey, owner: String(owner ?? ''), town: String(town ?? '') });
  _version++;
  return true;
}

/** CLEAR it. */
export function clearVendorWaypoint() {
  if (!_wp) return;
  _wp = null;
  _version++;
}

/** Whether the house `(map, buildingKey)` is the waypoint's (an entered house clears it: the trader is reached). */
export const isVendorWaypoint = (map, buildingKey) => !!_wp && _wp.map === (Number(map) >>> 0) && _wp.buildingKey === buildingKey;

/** The owner's name as the town map says it on the waypoint's house ("Trader waypoint - Eve's home", homeDoorTitle). */
export const vendorWaypointLabel = (owner) => `Trader waypoint - ${owner || _wp?.owner || 'a trader'}`;
