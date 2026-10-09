// IT1 (2026-10-04, the owner: "Actually lets let this be the next mod we integrate 1:1", after asking how instant
// travel could come back online "as an option but with a cost"): IMMERSIVE TRAVEL 1.5, by kkgobkk - "Implements
// diegetic fast-travel by adding carriages outside of city gates." (vendor/immersive-travel/README.md).
//
// THE MOD, WHOLE. A carriage, two horses and a driver stand outside the gate of every walled city (its four
// WALLAA08-11 gate blocks - vendor/immersive-travel/WorldDataPatches). The driver belongs to a faction the mod
// registers, Carriage Drivers (8642), whose custom merchant service is "Fast Travel": talk to him and his travel map
// opens. A trip picked there is Daggerfall's own fast travel, priced by the mod's own calculator - a daily carriage fee
// on top of the inn nights - and refused where the driver will not go (a type of place the settings bar, another
// region with the region lock on). Sailors (8643) are registered with a "Fast Travel" of their own - a ship captain's
// map of the docks, a voyage priced by the day for the ship and her crew - but no block the mod ships stands one
// (the bible's page says so). DisableNormalTravel (on as shipped) makes the carriage the only way to fast travel: the
// player's own map refuses a trip to a place.
//
// THE PORT'S LAW IS THE ASSEMBLY. The bundle carries ImmersiveTravel.dll and no C# source; every rule here is read off
// its IL (vendor/immersive-travel/il/ImmersiveTravel.il.txt, `tools/ilDump.py`), cited `IL_xxxx`, the mod's own bugs
// carried as it ships them and named where they stand. DFU's own popup is ui/travelPopUp.js; this module is what the
// mod changes about it, as pure functions both map skins run (ui/travelMapWindow.js + ui/travelPopUp.js, the classic
// window; ui/heldMap.js, the enhanced one).
//
// A LEAF apart from the settings store: no DOM, no world - the hosts hand in what PlayerGPS and the maps answer.

import { modSetting, latchModLoaded, modLatchedOn } from './modSettings.js';
import { registerCustomFaction } from '../formats/factionFile.js';
import { registerMerchantService } from './guildServices.js';
import { LOCATION_TYPES } from '../formats/mapsFile.js';
import { CAPITAL_MAP_IDS, LARGE_DOCK_MAP_IDS, DOCK_PIXEL_IDS } from './immersiveTravelTables.js';
import { setFlatFaceOverride } from '../characters/staticNpc.js';   // DRIVER-FACE: FLATS.CFG's dictionary, as Roleplay & Realism writes it

export { CAPITAL_MAP_IDS, LARGE_DOCK_MAP_IDS, DOCK_PIXEL_IDS };

export const IMMERSIVE_TRAVEL_VENDOR = 'immersive-travel';

// ── the two factions (Init, IL_0408-04f7) ────────────────────────────────────────────────────────────────────────
/** RegisterCustomFaction(8642, ...) - type 15, sgroup 1 (Merchants, which is what routes a click on one of them to the
 *  merchant popup and its custom service), ggroup 16, power 100, the rest -1. */
export const CARRIAGE_DRIVERS_FACTION_ID = 8642;
/** RegisterCustomFaction(8643, ...) - the same record under Carriage Drivers. */
export const SAILORS_FACTION_ID = 8643;
export const IT_FACTIONS = Object.freeze([
  Object.freeze({ id: CARRIAGE_DRIVERS_FACTION_ID, parent: 0, type: 15, name: 'Carriage Drivers', summon: -1, region: -1, power: 100, face: -1, race: -1, sgroup: 1, ggroup: 16 }),
  Object.freeze({ id: SAILORS_FACTION_ID, parent: CARRIAGE_DRIVERS_FACTION_ID, type: 15, name: 'Sailors', summon: -1, region: -1, power: 100, face: -1, race: -1, sgroup: 1, ggroup: 16 }),
]);
/** RegisterMerchantService(..., "Fast Travel") - both services' label (IL_0528, IL_0544). */
export const IT_SERVICE_LABEL = 'Fast Travel';

// ── the mod's words, verbatim (every ldstr a player reads) ─────────────────────────────────────────────────────────
export const IT_TEXT = Object.freeze({
  /** CarriageMap.CreatePopUpWindow, IL_098e - region-locked, standing in a capital. */
  capitalOnly: 'To reach that location, you must travel to the capital of that region and take a carriage from there.',
  /** IL_099d - region-locked, standing anywhere else. */
  regionLocked: 'This carriage won\'t travel outside the region. Find a carriage in the capital or travel by sea.',
  /** IL_0a14 - a destination type the settings bar. */
  wrongType: 'The driver won\'t take you to this type of location.',
  /** SeafarersMap.CreatePopUpWindow, IL_1715. */
  smallBoat: 'This small boat will only take you to locations in the same region. Travel to a major port to find a larger ship.',
  /** IL_175d. */
  noDock: 'That location doesn\'t have a suitable dock.',
  /** ImmersiveTravelPopUp.OnPush, IL_1a54 - the player's own map, a place a carriage could reach. */
  mustTakeCarriage: 'You must take a carriage to initiate fast travel. Carriage drivers are stationed outside the gates of large cities.',
  /** IL_1a76 - the player's own map, a place no carriage goes. */
  cannotTravelType: 'You cannot travel to this type of location.',
  /** ForceNonShipTravel, IL_1ad3. */
  mustFindShip: 'You must find a ship to initiate ship travel. Ship captains can be found on docks along the coast.',
  /** SeafarersPopUp.ForceShipTravel, IL_1e83. */
  cannotDisableShip: 'Cannot disable ship travel when travelling with a ship captain.',
  /** SeafarersPopUp.ForceCampOut, IL_1edb. */
  noInnsAtSea: 'There are no inns in the middle of the sea.',
});

// ── the settings ───────────────────────────────────────────────────────────────────────────────────────────────────
/** The mod's eighteen keys (vendor/immersive-travel/modsettings.json), read through the store - the room's value
 *  online where systems/onlineLane.js says so. `get` is injectable for the pins. */
export function readImmersiveTravelSettings(get = modSetting) {
  const v = (k) => get(IMMERSIVE_TRAVEL_VENDOR, k);
  return {
    enabled: v('Enabled') === true,
    disableNormalTravel: v('General.DisableNormalTravel') === true,
    dailyCarriageFee: v('General.DailyCarriageFee') | 0,
    clearerMapDots: v('General.ClearerMapDots') === true,
    drawRoads: v('General.DrawRoads') === true,
    drawTracks: v('General.DrawTracks') === true,
    regionLockedCarriages: v('General.RegionLockedCarriages') === true,
    disableShipTravelOutsideDocks: v('ShipTravel.DisableShipTravelOutsideDocks') === true,
    dailyShipCost: v('ShipTravel.DailyShipCost') | 0,
    dailyCaptainFee: v('ShipTravel.DailyCaptainFee') | 0,
    limitedRangeInSmallDocks: v('ShipTravel.LimitedRangeInSmallDocks') === true,
    showLargerDocks: v('ShipTravel.ShowLargerDocks') === true,
    showOnlyDocks: v('ShipTravel.ShowOnlyDocks') === true,
    // ImmersiveTravel.BasicRoadsEnabled (Init IL_02c6-02e2): ModManager.GetMod("BasicRoads")?.Enabled - the map's
    // roads and tracks need it (itMapPaths)
    basicRoads: get('roads-hazelnut', 'Enabled') === true,
    allowed: Object.freeze({
      cities: v('AllowedDestinations.Cities') === true,
      covens: v('AllowedDestinations.Covens') === true,
      dungeons: v('AllowedDestinations.Dungeons') === true,
      graveyards: v('AllowedDestinations.Graveyards') === true,
      farms: v('AllowedDestinations.Farms') === true,
      hamlets: v('AllowedDestinations.Hamlets') === true,
      homes: v('AllowedDestinations.Homes') === true,   // read by nothing: see isDestinationValid
      temples: v('AllowedDestinations.Temples') === true,
      taverns: v('AllowedDestinations.Taverns') === true,
      villages: v('AllowedDestinations.Villages') === true,
    }),
  };
}

// ── the carriage's laws ────────────────────────────────────────────────────────────────────────────────────────────
const T = LOCATION_TYPES;

/** CarriageMap.IsDestinationValid(LocationTypes) (IL_0a58-0b61), branch for branch. A type answers its own setting;
 *  every other type falls through to false.
 *
 *  THE MOD'S OWN BUG, CARRIED: the three home types - HomePoor (11), HomeWealthy (8) and HomeYourShips (14) - read
 *  "Dungeons" (IL_0adb-0ae1), not "Homes"; no branch reads the Homes key at all. So Homes on admits nothing and
 *  Dungeons on admits the homes too. */
export function isDestinationValid(locationType, allowed) {
  const a = allowed ?? {};
  if (locationType === T.Coven && a.covens) return true;
  if ((locationType === T.DungeonKeep || locationType === T.DungeonLabyrinth || locationType === T.DungeonRuin) && a.dungeons) return true;
  if (locationType === T.Graveyard && a.graveyards) return true;
  if (locationType === T.HomeFarms && a.farms) return true;
  if ((locationType === T.HomePoor || locationType === T.HomeWealthy || locationType === T.HomeYourShips) && a.dungeons) return true;   // IL_0adb: "Dungeons", the mod's own
  if ((locationType === T.ReligionCult || locationType === T.ReligionTemple) && a.temples) return true;
  if (locationType === T.Tavern && a.taverns) return true;
  if (locationType === T.TownCity && a.cities) return true;
  if (locationType === T.TownHamlet && a.hamlets) return true;
  if (locationType === T.TownVillage) return !!a.villages;
  return false;
}

/** CarriageMap.BorderingRegionIndex(x, y) (IL_1398-1466): the region of the first of the player's neighbouring map
 *  pixels that answers a region above 0 and not 31 ("High Rock sea coast"), asked in the mod's order - and the mod
 *  asks (x, y+1) TWICE (IL_13a7 and IL_13d2: the second was surely meant as another neighbour), then (x+1, y),
 *  (x, y-1), (x-1, y); -1 when none answers. The player's own pixel is never asked. Two consequences carried as
 *  shipped: region 0 (Alik'r Desert) is never an answer, and a pixel inland of a coast answers its inland
 *  neighbour's region. `politicAt(x, y)` is MapsFile.GetPoliticIndex. */
export function borderingRegionIndex(x, y, politicAt) {
  for (const [px, py] of [[x, y + 1], [x, y + 1], [x + 1, y], [x, y - 1], [x - 1, y]]) {
    const r = (politicAt(px, py) | 0) - 128;
    if (r === 31) continue;
    if (r > 0) return r;
  }
  return -1;
}

/** MapsFile's pixel-id mask, the mod's `& 1048575` (IL_14d0, IL_1fc8). */
const PIXEL_MASK = 0xfffff;
/** CarriageMap.isCapital(mapID) (IL_14bc-14f1, the lambda IL_1fc7-1fd6): a capital table entry whose pixel id is the
 *  map id's. */
export const isCapital = (mapId) => CAPITAL_MAP_IDS.some((c) => (c & PIXEL_MASK) === ((mapId | 0) & PIXEL_MASK));

/** CarriageMap.CreatePopUpWindow's NPC arm (IL_0886-0a49): whether the driver takes the player to the place on the
 *  map - null for a trip (ImmersiveTravelPopUp is pushed), or the refusal's key in IT_TEXT. `here` is PlayerGPS: the
 *  pixel the player stands on (CurrentMapPixel) and the current location's MapId (CurrentMapID); `dest` the map's
 *  locationSummary. */
export function carriageRefusal(settings, { here, dest, politicAt }) {
  if (!isDestinationValid(dest.locationType, settings.allowed)) return 'wrongType';
  if (!settings.regionLockedCarriages) return null;
  const border = borderingRegionIndex(here.x, here.y, politicAt);
  const fromCapital = isCapital(here.mapId ?? 0);
  if (fromCapital && isCapital(dest.mapId)) return null;   // IL_093f-095e: capital to capital, anywhere
  if (border === dest.regionIndex) return null;            // IL_0960-096c
  return fromCapital ? 'capitalOnly' : 'regionLocked';      // IL_097e-09a3
}

/** CarriageMap.IsLocationLarge (IL_1468-1483) - a city or a hamlet, or every place with ClearerMapDots off. Travel
 *  Options' own rule over its own switch (ui/travelPathsOverlay.js isLocationLarge), the mod's copy of it. */
export const carriageLocationLarge = (locationType, settings) =>
  locationType === T.TownCity || locationType === T.TownHamlet || !settings?.clearerMapDots;

/** ImmersiveTravelCalculator.CalculateTripCost (IL_1d44-1e46) - TravelTimeCalculator.CalculateTripCost
 *  (systems/travel.js calculateTripCost) with the carriage's fee: the inn nights as DFU bills them, then
 *  DailyCarriageFee for every whole day of the trip off the ocean, plus one more; the ship toggle pays the ship (unless
 *  the player has one) and her captain for every day at sea plus one. CARRIED (AUDIT IT1 L5): with NO ocean guard
 *  (IL_1dfb tests the toggle alone, where DFU asks `pixelsTraveledOnOcean > 0`), so a trip over land on the ship toggle
 *  pays one sea day - only with DisableShipTravelOutsideDocks off. The minutes are the popup's, which
 *  ImmersiveTravelPopUp leaves to DFU's own CalculateTravelTime. Never below zero (IL_1e36). */
export function carriageTripCost(minutes, oceanPixels, { sleepModeInn = false, hasShip = false, travelShip = false, freeTavernRooms = false } = {}, settings) {
  const hours = Math.trunc(((minutes | 0) + 59) / 60);
  const ocean = oceanPixels | 0;
  let piecesCost = 0;
  if (sleepModeInn && !freeTavernRooms) {
    piecesCost = 5 * Math.trunc((hours - ocean) / 24);
    if (piecesCost < 0) piecesCost = 0;
    piecesCost += 5;
  }
  const fee = settings?.dailyCarriageFee | 0;
  let totalCost = piecesCost + fee * Math.trunc((hours - ocean) / 24) + fee;
  if (travelShip) {
    const seaDays = Math.trunc(ocean / 24) + 1;
    if (!hasShip) totalCost += (settings?.dailyShipCost | 0) * seaDays;
    totalCost += (settings?.dailyCaptainFee | 0) * seaDays;
  }
  if (totalCost < 0) totalCost = 0;
  return { piecesCost, totalCost };
}

// ── the ship captain's laws ────────────────────────────────────────────────────────────────────────────────────────
const DOCKS = new Set(DOCK_PIXEL_IDS);
/** SeafarersMap.HasDock(mapID) (IL_1818-184d): the masked id among the dock pixels - which are compared UNMASKED, so a
 *  table entry is a pixel id (y * 1000 + x). */
export const hasDock = (mapId) => DOCKS.has((mapId | 0) & PIXEL_MASK);
/** SeafarersMap.NearDock(mapID) (IL_185c-189d): a dock on the place's pixel or one of its four neighbours, asked in
 *  the mod's order (the pixel, -1000 a row up, +1, +1000, -1). */
export function nearDock(mapId) {
  const id = (mapId | 0) & PIXEL_MASK;
  return hasDock(id) || hasDock(id - 1000) || hasDock(id + 1) || hasDock(id + 1000) || hasDock(id - 1);
}
/** SeafarersMap.IsPlayerInTown(gps) (IL_18ac-18fd): standing in a city or a hamlet, in one of the fifteen large docks,
 *  or in region 31 (High Rock sea coast). `gps`: { locationType, mapId, regionIndex } - PlayerGPS.CurrentLocationType,
 *  CurrentMapID and CurrentRegionIndex. */
export function isPlayerInTownForShips(gps) {
  if (gps.locationType === T.TownCity || gps.locationType === T.TownHamlet) return true;
  const here = (gps.mapId | 0) & PIXEL_MASK;
  if (LARGE_DOCK_MAP_IDS.some((d) => (d & PIXEL_MASK) === here)) return true;
  return gps.regionIndex === 31;
}

/** SeafarersMap.CreatePopUpWindow (IL_1604-1792): null for a voyage (SeafarersPopUp), or the refusal's key. The
 *  destination must lie by a dock; with LimitedRangeInSmallDocks a small place sails within its own region only -
 *  and a player whose neighbours answer no region (BorderingRegionIndex -1) sails anywhere (IL_16d0-16d2). */
export function seafarerRefusal(settings, { here, gps, dest, politicAt }) {
  if (!nearDock(dest.mapId)) return 'noDock';
  if (!settings.limitedRangeInSmallDocks) return null;
  if (isPlayerInTownForShips(gps)) return null;
  const border = borderingRegionIndex(here.x, here.y, politicAt);
  if (border === dest.regionIndex || border === -1) return null;
  return 'smallBoat';
}

/** SeafarersMap.IsLocationLarge (IL_17f0-180a): with ShowLargerDocks, a place by a dock; else the carriage map's. */
export const seafarerLocationLarge = (summary, settings) =>
  (settings?.showLargerDocks ? nearDock(summary.mapID ?? summary.mapId) : carriageLocationLarge(summary.locationType, settings));
/** SeafarersMap.checkLocationDiscovered (IL_17a0-17ee): the map's own answer, and with ShowOnlyDocks only a place by a
 *  dock - asked of the summary's ID (the pixel id), where every other dock question asks MapID; the two mask alike. */
export const seafarerDiscovered = (summary, discovered, settings) =>
  !!discovered && (!settings?.showOnlyDocks || nearDock(summary.id ?? summary.mapID ?? summary.mapId));

/** SeafarersCalculator.CalculateTravelTime (IL_1bec-1cab): the classic pixel walk with every step 51 minutes - the
 *  sea's own rate, ship or no, terrain unread - and the reckless halving. It counts no ocean pixels: the calculator's
 *  OceanPixels stays 0 (the voyage's cost does not read it, and neither does Warm Ashes' hidden roll then). Inns and
 *  the transport are not read. */
export function seafarerTravelTime(start, end, { speedCautious = false } = {}) {
  const steps = Math.max(Math.abs((end.x | 0) - (start.x | 0)), Math.abs((end.y | 0) - (start.y | 0)));
  let minutes = 51 * steps;
  if (!speedCautious) minutes >>= 1;
  return { minutes, oceanPixels: 0 };
}

/** SeafarersCalculator.CalculateTripCost (IL_1cb8-1d2e): the ship (unless the player owns one) and her captain, each by
 *  the day plus one. No inn is paid and the coins-only half stays the calculator's untouched 0. */
export function seafarerTripCost(minutes, { hasShip = false } = {}, settings) {
  const days = Math.trunc(Math.trunc(((minutes | 0) + 59) / 60) / 24) + 1;
  let totalCost = 0;
  if (!hasShip) totalCost += (settings?.dailyShipCost | 0) * days;
  totalCost += (settings?.dailyCaptainFee | 0) * days;
  if (totalCost < 0) totalCost = 0;
  return { piecesCost: 0, totalCost };
}

/** CarriageMap / SeafarersMap.CreatePopUpWindow, as the one question both map skins ask of a place picked on a
 *  driver's or a captain's map: the refusal's key, or null for the popup. `here` is PlayerGPS - { x, y } the pixel
 *  the player stands on, `mapId`, `locationType` and `regionIndex` of where they stand; `summary` the map's
 *  locationSummary (the port's MapSummary: mapID, regionIndex, locationType). */
export function itMapRefusal(kind, settings, { here, summary, politicAt }) {
  const dest = { locationType: summary.locationType, mapId: summary.mapID ?? summary.mapId, regionIndex: summary.regionIndex };
  if (kind === IT_POPUP.seafarer) return seafarerRefusal(settings, { here, gps: here, dest, politicAt });
  return carriageRefusal(settings, { here, dest, politicAt });
}

/** The carriage map's roads and tracks (CarriageMap..cctor IL_1538-1579): each drawn only with Basic Roads loaded and
 *  its own switch on - in the five-texel page's path order (ui/travelMapOptions.js: roads, tracks, rivers, streams;
 *  the mod draws no water). */
export const itMapPaths = (settings) => [!!(settings?.basicRoads && settings.drawRoads), !!(settings?.basicRoads && settings.drawTracks), false, false];

// ── the popups ─────────────────────────────────────────────────────────────────────────────────────────────────────
/** The three popups the mod makes. `carriage` - ImmersiveTravelPopUp over a driver's map; `seafarer` - SeafarersPopUp
 *  over a captain's; `player` - ImmersiveTravelPopUp as the player's OWN map's popup, which the mod registers in DFU's
 *  place only with DisableNormalTravel on (Init, IL_03d7-03f9). */
export const IT_POPUP = Object.freeze({ carriage: 'carriage', seafarer: 'seafarer', player: 'player' });

/** OnPush (ImmersiveTravelPopUp IL_19c4-19d3, SeafarersPopUp IL_1f0f-1f31) over DFU's own defaults (cautious, ship,
 *  inns - DaggerfallTravelPopUp :85-87). Each is a NEW popup (`newobj`, IL_09e5, IL_16e6), never the persistent one
 *  the map reuses, so nothing a player chose last time carries over. */
export function itPopUpDefaults(kind, settings) {
  if (kind === IT_POPUP.seafarer) return { speedCautious: true, travelShip: true, sleepModeInn: false };
  return { speedCautious: true, travelShip: !settings?.disableShipTravelOutsideDocks, sleepModeInn: true };
}

/** The player's own map's refusal (ImmersiveTravelPopUp.OnPush, IL_19e4-1aac) - on DisableNormalTravel, for a map
 *  no driver opened: a place a carriage goes says take one, a place none goes says no one goes; a destination with no
 *  location summary is only logged (IL_1a97) and the popup stands. Null for no refusal. */
export function playerPopUpRefusal(settings, destLocationType) {
  if (!settings?.enabled || !settings.disableNormalTravel) return null;
  if (destLocationType == null) return null;
  return isDestinationValid(destLocationType, settings.allowed) ? 'mustTakeCarriage' : 'cannotTravelType';
}

/**
 * The popup's three toggles under the mod's overrides, as one decision over the state - DFU's handlers
 * (ui/travelPopUp.js) are the `base` the overrides fall through to. `press`:
 *   - 'transportClick' with `ship` (the button: true the ship row, false foot/horse) - TransportModeButtonOnClickHandler
 *   - 'transportToggle' - ToggleTransportModeButtonOnScrollHandler, which is also the T hotkey's (DFU routes the
 *     footHorse button's keyboard event to it)
 *   - 'sleepClick' with `inn` (true the inn row, false camp out) - SleepModeButtonOnClickHandler
 *   - 'sleepToggle' with `campOutButton` (the wheel over camp out; the N hotkey is the inn button's) -
 *     ToggleSleepModeButtonOnScrollHandler
 * Mutates `st` ({ speedCautious, travelShip, sleepModeInn }) as the C# does and answers the refusal box's key, or null.
 * A refusal plays no click (ForceNonShipTravel / ForceShipTravel / ForceCampOut play none); the base arm does.
 */
export function itTogglePress(kind, st, settings, press, { ship = false, inn = false, campOutButton = false } = {}) {
  const disableShip = !!settings?.disableShipTravelOutsideDocks;
  const transport = press === 'transportClick' || press === 'transportToggle';
  const sleep = press === 'sleepClick' || press === 'sleepToggle';
  if (!transport && !sleep) return null;   // the speed pair is the base's alone - the mod overrides none of its handlers
  if (kind === IT_POPUP.seafarer) {
    if (transport && st.travelShip) { st.travelShip = true; return 'cannotDisableShip'; }   // IL_1f33-1f41, IL_1f4c-1f5a
    if (sleep && !st.sleepModeInn) { st.sleepModeInn = false; return 'noInnsAtSea'; }       // IL_1f64-1f72, IL_1f7d-1f8b
  } else if (transport) {
    if (!st.travelShip && disableShip) { st.travelShip = false; return 'mustFindShip'; }   // IL_1b07-1b1c, IL_1b27-1b3c
  } else if ((press === 'sleepClick' ? !inn : campOutButton) && disableShip) {
    st.travelShip = false;   // IL_1b46-1b5d, IL_1b67-1b7e - the camp-out button alone
  }
  // the base arms (DaggerfallTravelPopUp :516-560): a click assigns, a scroll or a hotkey toggles
  if (press === 'transportClick') st.travelShip = !!ship;
  else if (press === 'transportToggle') st.travelShip = !st.travelShip;
  else if (press === 'sleepClick') st.sleepModeInn = !!inn;
  else if (press === 'sleepToggle') st.sleepModeInn = !st.sleepModeInn;
  return null;
}

/**
 * The trip an IT popup bills: the travel time (DFU's own for a carriage, the captain's for a voyage) with the guild's
 * blessing folded in (GuildManager.FastTravel, DaggerfallTravelPopUp.UpdateLabels - the base every popup runs), and
 * the mod's own calculator's fare. NOT Travel Options' scaled fare (TravelTimeCalculatorTO is Travel Options' popup's
 * calculator, and the mod's popup is DFU's with its own) and NOT online's half-price fare (ESSENTIALS-HALF), which is
 * the port's word on DFU's and Travel Options' fares: a driver's price is the mod's, and online the room's.
 * `calc` is { calculateTravelTime, guildFastTravel } off the host (systems/travel.js, systems/guildVariants.js).
 */
export function itTrip(kind, settings, { start, end, opts, hasHorse = false, hasCart = false, hasShip = false, freeTavernRooms = false, getClimateIndex, playerEntity = null, calc }) {
  const t = kind === IT_POPUP.seafarer
    ? seafarerTravelTime(start, end, { speedCautious: opts.speedCautious })
    : calc.calculateTravelTime(start, end, { speedCautious: opts.speedCautious, sleepModeInn: opts.sleepModeInn, travelShip: opts.travelShip, hasHorse, hasCart }, getClimateIndex);
  const minutes = calc.guildFastTravel(playerEntity, t.minutes);
  const cost = kind === IT_POPUP.seafarer
    ? seafarerTripCost(minutes, { hasShip }, settings)
    : carriageTripCost(minutes, t.oceanPixels, { sleepModeInn: opts.sleepModeInn, hasShip, travelShip: opts.travelShip, freeTavernRooms }, settings);
  return { minutes, oceanPixels: t.oceanPixels, ...cost };
}

// ── Init (IL_0298-0564) ────────────────────────────────────────────────────────────────────────────────────────────
let _installed = false;
/** AUDIT IT1 W4/G3: THE MOD LOADED FOR THE GAME (AUDIT PRE-MERGE 0928 S4) - latched by its Init below, as its factions
 *  go into the dictionary the load builds once a page; until then, the switch as it stands. The services, the gate
 *  patch and its layer (scenes/modWorldData.js), the driver's map and the player's map's Disable Normal Travel
 *  (scenes/world.js) all ask this, so a switch flipped mid-game reaches none of them before the game is next started:
 *  it had left carriages standing whose drivers only talked, and towns that kept or lost them by the cache. */
export const immersiveTravelLoaded = () => modLatchedOn(IMMERSIVE_TRAVEL_VENDOR) ?? (modSetting(IMMERSIVE_TRAVEL_VENDOR, 'Enabled') === true);
/**
 * The mod's Init, once, at the boot every host shares (scenes/shared.js): the mod latched loaded for the game or not
 * (AUDIT IT1 W4 - the dictionary is built at the load once a page, so a switch reaches the next start), then while it
 * is loaded the two factions and the two services. A service's body is `service(door, entity)` (systems/guildServices.js); the door the hosts hand it answers
 * `enemiesNearby()` - GameManager.AreEnemiesNearby(false, false) - `messageBox(text)` and `openImmersiveMap(kind)`,
 * the CarriageMap / SeafarersMap push (CarriageTravelService IL_0574-05b3, ShipTravelService IL_05c0-05fe).
 *
 * The window-type registrations (IL_03bf-03f9: CarriageMap for DFU's travel map while Travel Options is off,
 * ImmersiveTravelPopUp for its popup with DisableNormalTravel) are the hosts' and ui/ - an IT kind on the map's bag.
 */
/** DRIVER-FACE (FIELD BUGS 2026-10-09b, "NPC Shrarton in Tasoparet face sprite missing."): THE ONE DRIVER WITH NO
 *  FACE. The mod stands a carriage driver at each of the four city gates (WorldDataPatches WALLAA08-11); WALLAA09's is
 *  the flat TEXTURE.357 record 3, a bearded man, which FLATS.CFG has no row for (it lists 357's princes and queen
 *  alone), and the Carriage Drivers' faction carries no flat of its own (IL_040f clears the record). So
 *  GetPortraitIndexFromStaticNPCBillboard stood its starting record - 410, TFAC00I0's grey "OOPS! Tell Mack NOW!" - on
 *  every walled city's WALLAA09 driver, in DFU with the mod as here. A departure from DFU and the mod: the flat is given
 *  the face FLATS.CFG gives classic's own bearded man (182.3, 429), as a mod writes the dictionary (staticNpc.js
 *  setFlatFaceOverride, rrVariants.js's own). The other three drivers' flats have rows, and keep them. */
export const IT_DRIVER_FACE = Object.freeze({ archive: 357, record: 3, faceIndex: 429 });

export function installImmersiveTravel() {
  if (_installed) return false;
  _installed = true;
  if (!latchModLoaded(IMMERSIVE_TRAVEL_VENDOR, modSetting(IMMERSIVE_TRAVEL_VENDOR, 'Enabled') === true)) return true;
  // AUDIT IT1 L3: the services only once BOTH factions went in (IL_047a-04ff - the second asked only after the first);
  // else Init logs its error and registers neither (IL_0501-050b)
  const [drivers, sailors] = IT_FACTIONS;
  if (!(registerCustomFaction(drivers.id, drivers) && registerCustomFaction(sailors.id, sailors))) {
    console.warn('[ImmersiveTravel] Error: could not register custom factions!');
    return true;
  }
  setFlatFaceOverride(IT_DRIVER_FACE.archive, IT_DRIVER_FACE.record, IT_DRIVER_FACE.faceIndex);   // DRIVER-FACE
  registerMerchantService(CARRIAGE_DRIVERS_FACTION_ID, (door) => immersiveTravelService(door, IT_POPUP.carriage), IT_SERVICE_LABEL, immersiveTravelLoaded);
  registerMerchantService(SAILORS_FACTION_ID, (door) => immersiveTravelService(door, IT_POPUP.seafarer), IT_SERVICE_LABEL, immersiveTravelLoaded);
  return true;
}
/** CarriageTravelService / ShipTravelService: enemies near say DFU's cannotTravelWithEnemiesNearby and nothing opens;
 *  otherwise the driver's (or the captain's) map. Nothing else is asked - not the sun, not a quest's offer: those are
 *  DaggerfallUI's travel-map door (DaggerfallUI.cs:604-626), which a service's PushWindow never passes. */
export function immersiveTravelService(door, kind) {
  if (door?.enemiesNearby?.()) { door.messageBox?.(door.enemiesText ?? 'You cannot travel with enemies nearby.'); return false; }
  return !!door?.openImmersiveMap?.(kind);
}
export function _resetImmersiveTravel() { _installed = false; }
