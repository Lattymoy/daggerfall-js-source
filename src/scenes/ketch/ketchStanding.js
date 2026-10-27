// @ts-check
// KETCH-EVERYWHERE (bible/11-Multiplayer/Sky-Ketch.md section 22): WHETHER THIS SCREEN STANDS THE STATIONS PAST THE BAY,
// and the station of the province a pixel stands in - the light half of scenes/ketch/ketchStations.js, apart so the Timers
// (systems/eventTimers.js) read it without the places' graph (world/arenaPlaces.js reaches the HUD, which reads the Timers).
// The ketch client says the standing a frame: the relay keeps a station's ships (net/online.js ktTheatresOk).
// Not a DFU member. Ledger A (KETCH).
import { ketchStationOk } from '../../net/ketch/ketchLaw.js';
import { theatreAt, BAY_THEATRE } from '../../world/worldWide/worldGrid.js';

let _standing = false;
/** Whether this screen stands the stations past the Bay (the ketch client's word, a frame). */
export const ketchStationsStanding = () => _standing;
/** @param {boolean} on */
export function setKetchStationsStanding(on) { _standing = !!on; }
/** The station past the Bay a map pixel stands in - its theatre's, where that theatre keeps one - or null (the Bay's, the
 *  open zone, the sea). @param {number} px @param {number} py */
export function ketchStationHere(px, py) {
  if (!Number.isInteger(px) || !Number.isInteger(py)) return null;
  const t = theatreAt(px, py);
  return t !== BAY_THEATRE && ketchStationOk(t) ? t : null;
}
