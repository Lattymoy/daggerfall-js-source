// U41: THE TRAVEL MAP'S SESSION STATE - what DFU's single, persistent
// DaggerfallTravelMapWindow carries between openings, and the
// TravelMapSaveData envelope the save writes
// (SerializableGameObject.cs:502-512; SaveLoadManager.cs:871, :1479).
//
// DFU keeps ONE window alive in DaggerfallUI and re-PUSHES it, so the
// four filter toggles and the popup's three choices survive both a
// close and a save. The port mints a window per open - the A2
// zoom-memory shape - so the state lives here, in a systems module
// both the window and the save envelope can reach without the save
// layer importing a UI one.
//
// The struct's own defaults are load-bearing: the filters start FALSE
// and sleepInn/speedCautious/travelShip start TRUE, which is what a
// null envelope (an old save) restores.

// ROADS 12: two more, the port's own - roads and tracks on the map.
// Same inversion as DFU's four (TRUE means HIDDEN), so the default of
// false is "always on" and a pre-ROADS-12 save, which has no such keys,
// restores to shown.
const DEFAULT_FILTERS = Object.freeze({ dungeons: false, temples: false, homes: false, towns: false, roads: false, tracks: false });
const DEFAULT_POPUP = Object.freeze({ speedCautious: true, sleepModeInn: true, travelShip: true });

let _filters = { ...DEFAULT_FILTERS };
let _popUp = { ...DEFAULT_POPUP };

/** The live filter set - the window edits this object in place, the
 *  way DFU's window edits its own four fields. */
export function travelMapFilters() { return _filters; }

/** The three popup choices the next popup opens with. */
export function travelMapPopUpState() { return { ..._popUp }; }
export function setTravelMapPopUpState({ speedCautious, sleepModeInn, travelShip }) {
  _popUp = {
    speedCautious: !!speedCautious, sleepModeInn: !!sleepModeInn, travelShip: !!travelShip,
  };
}

/** GetTravelMapSaveData (DaggerfallTravelMapWindow.cs:1318-1339).
 *  `live` is the open popup's choices when one is up - DFU reads the
 *  window's popUp field and leaves the struct's defaults when it is
 *  null. */
export function travelMapSaveData(live = null) {
  const p = live ?? _popUp;
  return {
    filterDungeons: _filters.dungeons,
    filterTemples: _filters.temples,
    filterHomes: _filters.homes,
    filterTowns: _filters.towns,
    filterRoads: _filters.roads,     // ROADS 12: the port's own two
    filterTracks: _filters.tracks,
    sleepInn: p.sleepModeInn,
    speedCautious: p.speedCautious,
    travelShip: p.travelShip,
  };
}

/** SetTravelMapFromSaveData (:1342-1363): a null envelope restores
 *  the struct's own defaults, which is how a pre-U41 save loads. */
export function restoreTravelMapSaveData(data) {
  const d = data ?? {};
  _filters = {
    dungeons: !!d.filterDungeons, temples: !!d.filterTemples,
    homes: !!d.filterHomes, towns: !!d.filterTowns,
    roads: !!d.filterRoads, tracks: !!d.filterTracks,   // ROADS 12: absent in an older save -> shown
  };
  _popUp = {
    speedCautious: d.speedCautious ?? true,
    sleepModeInn: d.sleepInn ?? true,
    travelShip: d.travelShip ?? true,
  };
  return _filters;
}

/** A new game (and every test) starts from DFU's defaults. */
export function resetTravelMapState() {
  _filters = { ...DEFAULT_FILTERS };
  _popUp = { ...DEFAULT_POPUP };
}
