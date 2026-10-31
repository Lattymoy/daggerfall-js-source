// @ts-check
// KETCH-EVERYWHERE (bible/11-Multiplayer/Sky-Ketch.md section 22): WHETHER THIS SCREEN STANDS THE STATIONS PAST THE BAY'S
// OWN, and the station of the province a pixel stands in - the light half of scenes/ketch/ketchStations.js, apart so the
// Timers (systems/eventTimers.js) read it without the places' graph (world/arenaPlaces.js reaches the HUD, which reads the
// Timers). The ketch client says the standing a frame: the relay keeps those stations' ships (net/online.js ktTheatresOk),
// and the Bay's map's region under a pixel (its politic map - the crown a Bay pixel is under).
// Not a DFU member. Ledger A (KETCH).
import { KT_STATION_CROWNS, ketchStationOk } from '../../net/ketch/ketchLaw.js';
import { kingdomOf } from '../../net/kingdomLaw.js';
import { theatreAt, BAY_THEATRE } from '../../world/worldWide/worldGrid.js';

let _standing = false;
/** @type {((px: number, py: number) => number) | null} */ let _regionAt = null;
/** Whether this screen stands the stations past the Bay's own (the ketch client's word, a frame). */
export const ketchStationsStanding = () => _standing;
/** The ketch client's word, a frame: whether the stations stand (`on`), and how a Bay pixel's region is read (`regionAt` -
 *  the Bay's politic map's region, -1 for none; left as it was when not given).
 *  @param {boolean} on @param {((px: number, py: number) => number) | null} [regionAt] */
export function setKetchStationsStanding(on, regionAt = undefined) {
  _standing = !!on;
  if (regionAt !== undefined) _regionAt = regionAt;
}

/** The lane of each crown's station (net/ketch/ketchLaw.js KT_STATION_CROWNS). */
const LANE_OF_CROWN = new Map(Object.entries(KT_STATION_CROWNS).map(([lane, crown]) => [crown, Number(lane)]));
/** The Bay's crowns, each the lane of its province's station - High Rock's Daggerfall and Wayrest that of Daggerfall,
 *  Hammerfell's Sentinel its own (SEAT0 4.3: High Rock north of the Bay, Hammerfell south). A March or a Free Land is no
 *  crown's: none. */
const BAY_CROWN_LANE = Object.freeze({
  daggerfall: LANE_OF_CROWN.get('daggerfall'),
  wayrest: LANE_OF_CROWN.get('daggerfall'),
  sentinel: LANE_OF_CROWN.get('sentinel'),
});

/**
 * THE STATION OF THE PROVINCE pixel (px, py) STANDS IN, past the Bay's own - its lane (net/ketch/ketchLaw.js KT_THEATRES), or
 * null: High Rock's (Daggerfall's - every screen's own, said and timed everywhere), the open zone, the sea, nowhere. On
 * the Bay by the crown its region is under (`regionAt` - the client's politic read, by default), past it by its theatre's
 * province (High Rock past the Bay is High Rock's: Daggerfall's).
 * @param {number} px @param {number} py @param {((px: number, py: number) => number) | null} [regionAt]
 */
export function ketchStationHere(px, py, regionAt = _regionAt) {
  if (!Number.isInteger(px) || !Number.isInteger(py)) return null;
  const t = theatreAt(px, py);
  let lane = null;
  if (t === BAY_THEATRE) {
    const r = regionAt ? regionAt(px, py) : -1;
    const k = Number.isInteger(r) && r >= 0 ? kingdomOf(r) : null;
    lane = k != null ? (BAY_CROWN_LANE[k] ?? null) : null;
  } else if (ketchStationOk(t)) lane = t; // High Rock past the Bay's lane keeps none: High Rock's station is Daggerfall's
  return lane ? lane : null;
}
