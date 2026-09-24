// TO1: TRAVEL OPTIONS 1.11 (Hazelnut, MIT) - TravelOptionsMod.cs, the
// mod's spine: its settings, its state, its journey machine and its
// Update loop, in the order the MonoBehaviour runs them.
//
// WHAT THE MOD IS. Daggerfall's fast travel is a menu and a fade: you
// pick a town, the days tick past on a black screen, you arrive. This
// mod keeps that AND adds the other thing - a journey you actually
// walk, with the game running at up to sixty times speed, the terrain
// streaming past, encounters interrupting you and a control panel to
// steer it. Which of the two a trip uses is decided by the popup's own
// three choices (cautious/reckless, foot/horse/ship, inns/camp out)
// against the player's settings: TravelOptionsPopUp.IsPlayerControlledTravel
// (:80-83), ported in ui/travelPopUp.js.
//
// The other half is BASIC ROADS. With Hazelnut's own road mod present -
// and the port has it, vendored, as `world/roadsProducer.js` MOD_ROADS -
// the travel map draws his network and the follow key walks it: stand
// on a road, face the way you want to go, press the key, and the
// journey runs to the next junction on its own.
//
// HOW IT IS SHAPED HERE. The C# is a MonoBehaviour that reaches
// GameManager for everything; this is a plain object built over an
// injected `deps` bag, the way every ported system in this port is
// (systems/weaponSheathing.js, combat/weaponWidget.js). It reads
// nothing global, touches no DOM and draws nothing, which is what lets
// the pins fly whole journeys on a table of positions - and it is why
// `update()` takes the frame's numbers rather than asking for them.
//
// FOUR THINGS THE MOD DOES THAT THE PORT CANNOT, each recorded rather
// than silently dropped (bible/06-Systems/Travel-Options.md):
//   - Hidden Map Locations (:284-293, :1264-1266) - a mod the port
//     does not have; its discovery set and its "reveal ports" arm.
//   - Real Grass (:1227, :1258) - likewise, a `SendModMessage` toggle.
//   - `Time.fixedDeltaTime` (:387) - Unity's physics step. The port's
//     equivalent is systems/timeScale.js, which scales the frame's dt
//     AND the motor's fixed step together, which is what that line is
//     for ("Must set fixed delta time to scale the fixed (physics)
//     updates as well").
//   - `SDFFontRendering` (:1256) - picks between two help texts and
//     two time formats. The port keeps both strings and takes the SDF
//     arm (systems/travelOptionsText.js says why).

import { modSetting, colorKeyRgba } from './modSettings.js';
import { registerCustomGuild } from './guildServices.js';   // AUDIT-TO1 F1: GuildManager.RegisterCustomGuild (:331-336)
import {
  MAX_CIRCUMNAVIGATION_ACCEL, LOC_PAUSE_OFF, LOC_PAUSE_NEAR, LOC_PAUSE_ENTER,
  MID_LO, P_SIZE, MP_WORLD_UNITS,
  mapPixelWorldOrigin, normalisedYaw, directionOfYaw, targetPixel, countSetBits,
  playerOnPathAt, pathsDataPoint, roadsDataPoint, nextPathDirection,
} from './travelPaths.js';
import { TravelAutopilot, rectOf, rectMinMax, rectContains } from './travelAutopilot.js';
import { TRAVEL_OPTIONS_TEXT as T, format, localize } from './travelOptionsText.js';
import { hasPort } from './travelPorts.js';
import { FATIGUE_MULTIPLIER } from './statMods.js';
import { LOCATION_TYPES, CLIMATES } from '../formats/mapsFile.js';

export const TRAVEL_OPTIONS_VENDOR = 'travel-options';

/** TravelOptionsMod.cs:131 - the eleven accelerations the
 *  DefaultStartingAcceleration choice indexes. */
export const START_ACCEL_VALUES = Object.freeze([1, 2, 3, 5, 10, 15, 20, 25, 30, 40, 50]);

/* KB1: :132's six follow keys, and the custom bind past them, are the registry's FollowPaths action now
 * (systems/inputActions.js MOD_ACTIONS carries the six, for the one-time carry of a player's old choice) - the
 * key is bound in Controls, beside every other key, and read with `pressed` like them. */

/** :1214, AttemptAvoidEncounter - the seconds encounters are ignored
 *  for after a successful avoidance. Unscaled real time, so the
 *  acceleration does not shorten it. */
export const IGNORE_ENCOUNTERS_SECONDS = 15;

/** :1200 - the avoid roll is luck + Stealth - 50, capped by the
 *  MaxChanceToAvoidEncounter setting. (The mod's own readme says
 *  "luck + stealth - 20"; the code says 50 and the code is what runs.) */
export const AVOID_ENCOUNTER_OFFSET = 50;

/** :587-589, SetLocationRects - a city's border is one and a half
 *  terrain tiles wide, everything else's is one. */
export const LOCATION_BORDER_TILES = 1;
export const LOCATION_BORDER_TILES_CITY = 1.5;

/** :95-97 re-exported so a host reading the LocationPause setting does
 *  not have to import the geometry module for it. */
export { LOC_PAUSE_OFF, LOC_PAUSE_NEAR, LOC_PAUSE_ENTER };

/** MapsFile.Climates.Ocean - the climate the journey refuses
 *  (:1402-1407). The port's own table names it. */
export const CLIMATE_OCEAN = CLIMATES.Ocean;

/** TravelOptionsMod.cs:202-270's LoadSettings and :284-330's Awake,
 *  resolved into one frozen bag. The dynamic half (LoadSettings) and
 *  the fixed half (Awake, the keys marked * in the readme, which need a
 *  restart in DFU) are read together here: the port has no restart, and
 *  a host that wants the mod's "needs a restart" behaviour simply reads
 *  this once at boot, which is what scenes/world.js does.
 *
 *  `roadsModEnabled` is the OTHER mod's switch, exactly as
 *  `ModManager.GetMod("BasicRoads").Enabled` is (:302-303): the port's
 *  Basic Roads is `roads-hazelnut`, and its `RiversAndStreams` key is
 *  the same one the mod reads at :307 for the waterways arms. */
export function readTravelOptionsSettings(read = modSetting) {
  const get = (k) => read(TRAVEL_OPTIONS_VENDOR, k);
  const roadsModEnabled = !!read('roads-hazelnut', 'Enabled');
  const riversStreams = !!read('roads-hazelnut', 'RiversAndStreams');

  // :316-323 - the roads arms are ALL gated on the other mod being on.
  const roadsIntegration = !!get('RoadsIntegration.Enable') && roadsModEnabled;
  const variableSizeDots = roadsIntegration ? !!get('RoadsIntegration.VariableSizeDots') : false;
  const roadsJunctionMap = roadsIntegration ? !!get('RoadsJunctionMap.Enable') : false;
  const waterwaysEnabled = roadsIntegration ? (!!get('RoadsIntegration.EnableWaterways') && riversStreams) : false;
  const streamsToggle = roadsIntegration ? (!!get('RoadsIntegration.EnableStreamsToggle') && riversStreams) : false;

  const speedPenalty = get('CautiousTravel.SpeedPenalty') | 0;
  return Object.freeze({
    // :203-207
    targetCoordsAllowed: !!get('GeneralOptions.AllowTargetingMapCoordinates'),
    enableWeather: !!get('GeneralOptions.AllowWeather'),
    enableSounds: !!get('GeneralOptions.AllowAnnoyingSounds'),
    enableRealGrass: !!get('GeneralOptions.AllowRealGrass'),
    locationPause: get('GeneralOptions.LocationPause') | 0,
    // :209-215. The speed penalty is a PERCENTAGE off, so 20 is x0.8,
    // and the fatigue minimum is the setting PLUS ONE (:214).
    cautiousTravel: !!get('CautiousTravel.PlayerControlledCautiousTravel'),
    recklessTravelMultiplier: 1,
    cautiousTravelMultiplier: 1 - (speedPenalty / 100),
    maxAvoidChance: get('CautiousTravel.MaxChanceToAvoidEncounter') | 0,
    cautiousHealthMinPc: get('CautiousTravel.HealthMinimumPercentage') | 0,
    cautiousFatigueMin: (get('CautiousTravel.FatigueMinimumValue') | 0) + 1,
    // :217-219
    stopAtInnsTravel: !!get('StopAtInnsTravel.PlayerControlledInnsTravel'),
    shipTravelPortsOnly: !!get('ShipTravel.OnlyFromPorts'),
    shipTravelDestinationPortsOnly: !!get('ShipTravel.OnlyToPorts'),
    // :221-223
    defaultStartingAccel: START_ACCEL_VALUES[get('TimeAcceleration.DefaultStartingAcceleration') | 0] ?? 10,
    alwaysUseStartingAccel: !!get('TimeAcceleration.AlwaysUseStartingAcceleration'),
    accelerationLimit: get('TimeAcceleration.AccelerationLimit') | 0,
    // :325-329
    teleportCost: !!get('Teleportation.EnablePaidTeleportation'),
    // :316-323 and :234
    // KB1: the follow arm stands wherever the roads do (:224-232's `None` is an unbound FollowPaths now)
    roadsIntegration, variableSizeDots, roadsJunctionMap, waterwaysEnabled, streamsToggle,
    markLocationColor: colorKeyRgba(get('RoadsIntegration.MarkLocationColor')),
    // :236-246 - only read while the junction map is on
    persistentJunctionMap: roadsJunctionMap ? !!get('RoadsJunctionMap.PersistentMap') : false,
    toggleMapOffPaths: roadsJunctionMap ? !!get('RoadsJunctionMap.ToggleMapOffPaths') : false,
    junctionMapCircular: roadsJunctionMap ? !!get('RoadsJunctionMap.Circular') : true,
    junctionMapFilterMode: roadsJunctionMap ? (get('RoadsJunctionMap.FilterMode') | 0) : 0,
    junctionMapSize: get('RoadsJunctionMap.ScreenSize') | 0,
    junctionMapX: get('RoadsJunctionMap.ScreenPositionX') | 0,
    junctionMapY: get('RoadsJunctionMap.ScreenPositionY') | 0,
    junctionMapOpaque: !!get('RoadsJunctionMap.Opaque'),
    playerColor: colorKeyRgba(get('RoadsJunctionMap.PlayerColor')),
    junctionMapBackground: colorKeyRgba(get('RoadsJunctionMap.BackgroundColor')),
    // :248-249
    fastTravelCostScaleFactor: get('FastTravelCostScaling.FastTravelCostScaleFactor') | 0,
    shipTravelCostScaleFactor: get('FastTravelCostScaling.ShipTravelCostScaleFactor') | 0,
    // :251-271 - the fourteen dot colours, in GetPixelColorIndex's own
    // index order (ui/travelMapWindow.js getPixelColorIndex: 0
    // DungeonLabyrinth ... 13 TownVillage), which is why the mod's
    // fourteen keys line up with it one for one.
    locationColors: Object.freeze([
      'DungeonLabyrinth', 'DungeonKeep', 'DungeonRuin', 'Graveyard', 'Coven', 'Farm', 'WealthyHome',
      'PoorHome', 'Temple', 'Cult', 'Tavern', 'City', 'Hamlet', 'Village',
    ].map((n) => colorKeyRgba(get(`LocationColours.${n}`)))),
  });
}

/** :126 - GetTravelSpeedMultiplier. */
export const travelSpeedMultiplier = (cautious, s) => (cautious ? s.cautiousTravelMultiplier : s.recklessTravelMultiplier);

/** MacroHelper.LocationTypeName (MacroHelper.cs) - the word DFU's %lt
 *  macro puts in a sentence for a location type, which the mod's own
 *  LocationTypeString falls back to for everything that is not one of
 *  the three dungeons. The port had no home for it (its macro table
 *  has %ltn and %lt1, the legal and faction titles, not this), so it
 *  is here with the enum it indexes; a second caller would move it. */
export const LOCATION_TYPE_NAMES = Object.freeze({
  [LOCATION_TYPES.TownCity]: 'city',
  [LOCATION_TYPES.TownHamlet]: 'town',
  [LOCATION_TYPES.TownVillage]: 'village',
  [LOCATION_TYPES.HomeFarms]: 'farm',
  [LOCATION_TYPES.DungeonLabyrinth]: 'labyrinth',
  [LOCATION_TYPES.ReligionTemple]: 'temple',
  [LOCATION_TYPES.Tavern]: 'tavern',
  [LOCATION_TYPES.DungeonKeep]: 'keep',
  [LOCATION_TYPES.HomeWealthy]: 'manor',
  [LOCATION_TYPES.ReligionCult]: 'shrine',
  [LOCATION_TYPES.DungeonRuin]: 'ruin',
  [LOCATION_TYPES.HomePoor]: 'farmstead',
  [LOCATION_TYPES.Graveyard]: 'graveyard',
  [LOCATION_TYPES.Coven]: 'coven',
});
export const locationTypeName = (locationType) => LOCATION_TYPE_NAMES[locationType] ?? 'place';

/** :1194-1198's LocationTypeString - the three dungeon types have the
 *  mod's own words and everything else takes DFU's own macro. */
export function locationTypeString(locationType, macroName = '') {
  switch (locationType) {
    case LOCATION_TYPES.DungeonKeep: return localize('LocationTypeDungeonKeep');
    case LOCATION_TYPES.DungeonLabyrinth: return localize('LocationTypeDungeonLabyrinth');
    case LOCATION_TYPES.DungeonRuin: return localize('LocationTypeDungeonRuin');
    default: return macroName || locationTypeName(locationType);
  }
}

/** :1199-1213, AttemptAvoidEncounter's roll, as a pure function so the
 *  pin can drive it: luck + live Stealth - 50, capped at the setting. */
export function avoidEncounterChance(luck, stealth, maxAvoidChance) {
  return Math.min(luck + stealth - AVOID_ENCOUNTER_OFFSET, maxAvoidChance);
}

/** :587-605, SetLocationRects - the location's world rectangle and the
 *  border ring around it that a circumnavigation walks.
 *
 *  `locationTileRect` is the terrain's own tile rectangle (the port's
 *  world/streamingWorld.js getLocationTerrainTileOrigin and the
 *  exterior's block dimensions give the same four numbers). Both
 *  rects are inset by one tile at the min edges FIRST (:592-593), then
 *  the inner one by the border on all four (:597-600), so the border
 *  ring is `locBorder` tiles wide and the inner rect is what counts as
 *  "inside the town".
 *
 *  Returns { locationRect, locationBorderRect, aimForCentre }, the
 *  last being the C#'s return value: `!location.HasCustomLocationPosition()`
 *  - a location centred in its map pixel may be aimed at directly,
 *  one that has been moved off-centre may not. */
export function locationRectsOf(worldOriginX, worldOriginZ, tileRect, isCity, hasCustomPosition = false) {
  const tSize = MP_WORLD_UNITS / 128;
  const locBorder = isCity ? LOCATION_BORDER_TILES_CITY : LOCATION_BORDER_TILES;
  // xMin/yMin += 1 shrinks the rect from the min side, keeping the max.
  let xMin = tileRect.x + 1, zMin = tileRect.y + 1;
  const xMax = tileRect.x + tileRect.width, zMax = tileRect.y + tileRect.height;
  const locationBorderRect = rectOf(worldOriginX + (xMin * tSize), worldOriginZ + (zMin * tSize),
    (xMax - xMin) * tSize, (zMax - zMin) * tSize);
  // then the inner rect insets all four edges by the border
  const ixMin = xMin + locBorder, izMin = zMin + locBorder;
  const ixMax = xMax - locBorder, izMax = zMax - locBorder;
  const locationRect = rectOf(worldOriginX + (ixMin * tSize), worldOriginZ + (izMin * tSize),
    (ixMax - ixMin) * tSize, (izMax - izMin) * tSize);
  return { locationRect, locationBorderRect, aimForCentre: !hasCustomPosition };
}

/** :800-806, SetupLocBorderCornerRects - the four corners of the
 *  border ring, which is what a circumnavigation aims at in turn. */
export function locBorderCornerRects(locationRect, locationBorderRect) {
  return {
    ne: rectMinMax(locationRect.xMax, locationRect.zMax, locationBorderRect.xMax, locationBorderRect.zMax),
    se: rectMinMax(locationRect.xMax, locationBorderRect.zMin, locationBorderRect.xMax, locationRect.zMin),
    sw: rectMinMax(locationBorderRect.xMin, locationBorderRect.zMin, locationRect.xMin, locationRect.zMin),
    nw: rectMinMax(locationBorderRect.xMin, locationRect.zMax, locationRect.xMin, locationBorderRect.zMax),
  };
}

/** :753-797, CircumnavigateLocation's target pick: which corner of the
 *  border ring to walk to next, from where the player stands in the
 *  ring and which way they face. Pure, because the eight-branch
 *  if-chain and its yaw windows are the whole of the algorithm and a
 *  pin should be able to walk a town's ring and check it closes.
 *
 *  Returns 'ne' | 'se' | 'sw' | 'nw' | null - null being the C#'s bare
 *  `return`, which leaves the journey alone. */
export function circumnavigateTarget(worldX, worldZ, yaw, locationRect, locationBorderRect, corners) {
  if (rectContains(corners.ne, worldX, worldZ)) return (yaw > 45 && yaw < 225) ? 'se' : 'nw';
  if (rectContains(corners.se, worldX, worldZ)) return (yaw > 135 && yaw < 315) ? 'sw' : 'ne';
  if (rectContains(corners.sw, worldX, worldZ)) return (yaw > 45 && yaw < 225) ? 'se' : 'nw';
  if (rectContains(corners.nw, worldX, worldZ)) return (yaw > 135 && yaw < 315) ? 'sw' : 'ne';
  if (worldZ > locationRect.zMax && worldZ < locationBorderRect.zMax) return (yaw > 180 && yaw < 360) ? 'nw' : 'ne';
  if (worldZ > locationBorderRect.zMin && worldZ < locationRect.zMin) return (yaw > 180 && yaw < 360) ? 'sw' : 'se';
  if (worldX > locationRect.xMax && worldX < locationBorderRect.xMax) return (yaw > 90 && yaw < 270) ? 'se' : 'ne';
  if (worldX > locationBorderRect.xMin && worldX < locationRect.xMin) return (yaw > 90 && yaw < 270) ? 'sw' : 'nw';
  return null;
}

/** The mod, as a host builds it. `deps` is the whole of its world -
 *  see the comment at the top of this file for why. */
export function createTravelOptions(deps = {}) {
  const s0 = deps.settings ?? readTravelOptionsSettings(deps.read ?? modSetting);
  const st = {
    settings: s0,
    // :105-107 - the journey
    destinationName: null,
    destinationSummary: null,
    destinationCautious: false,
    autopilot: null,
    // :141-150
    lastLocation: null,
    locationRect: null,
    locationBorderRect: null,
    corners: null,
    // :157-166
    ignoreEncounters: false,
    ignoreEncountersTime: 0,
    diseaseCount: 0,
    beginTime: 0,
    // AUDIT-TO1 L5: the port's own - the popup's estimate for the trip, so
    // the enhanced panel can say how long is left. The mod keeps no such
    // number (its strip has no room for one); a followed path has none
    // to keep, and the panel then shows the distance alone.
    estimateMinutes: null,
    // AUDIT-TO1 M1: TravelOptionsMod.cs:994-996. InterruptTravel UNSUBSCRIBES
    // PlayerGPS_OnEnterLocationRect when LocationPause is "entered", and
    // Start (:381) is the only `+=` - so after the first interruption of
    // the session the "entered" stop never fires again. The mod's own
    // quirk, carried as written and recorded in the bible.
    enterRectDetached: false,
    circumnavigatePathsDataPt: 0,
    lastCrossed: 0,
    road: false,
    uiCloseWhenTop: false,
    // :189 - the junction map's last drawn facing
    lastPlayerFacing: 0,
    junctionMapOn: false,
  };

  // AUDIT-TO1 F1: :331-336, Init's guild registration. With paid
  // teleportation on, the mod registers MagesGuildTO for the whole
  // MagesGuild group - a class whose only body is
  // `CanAccessService(Teleport) => true` - so a member of ANY rank
  // reaches the teleport service and is charged the rank-scaled fee
  // (ChargeForTeleport, :470-503). The port's own MagesGuild law is
  // DFU's rank >= 8, and the service is FREE at rank 8 and above, so
  // without this the whole paid-teleport feature - the setting, the
  // cost formula, both boxes - was unreachable by every player it was
  // written for.
  //
  // DFU THROWS if the group is already overridden ("unable to register
  // MagesGuildTO guild class"); the port's registry is last-writer and
  // this is its only writer, so a second construction re-registers the
  // same arm rather than dying. The arm DECLINES (undefined) for every
  // service but Teleport, which leaves the rest of the guild's law -
  // training, spells, magic items, soul gems, summoning - exactly DFU's.
  registerCustomGuild('MagesGuild', s0.teleportCost
    ? (_membership, service) => (service === 'Teleport' ? true : undefined)
    : null);

  const ui = deps.ui;
  const say = (text) => deps.say?.(text);
  const messageBox = (text) => deps.messageBox?.(text);
  const now = () => deps.now?.() ?? 0;
  const roads = () => deps.roads?.() ?? null;
  const pixel = () => deps.mapPixel?.() ?? { x: 0, y: 0 };
  const pos = () => deps.worldPos?.() ?? { x: 0, z: 0 };
  const yawDeg = (invert = false) => normalisedYaw(deps.yaw?.() ?? 0, invert);

  /** :382-390, SetTimeScale. In DFU this is `Time.timeScale` AND
   *  `Time.fixedDeltaTime`; in the port it is systems/timeScale.js,
   *  which the host wires to the frame's dt and the motor's step. */
  const setTimeScale = (n) => deps.setTimeScale?.(n);

  /** :392-398, ClearTravelDestination. */
  function clearTravelDestination() {
    st.destinationName = null;
    st.autopilot = null;
    st.estimateMinutes = null;   // AUDIT-TO1 L5
    if (ui?.isShowing) ui.closeWindow();
  }

  /** :456-473, BeginTravel(summary, cautious) - the named destination.
   *  `summary` is the port's map summary: { pixel: {x, y}, mapId,
   *  regionIndex, mapIndex, locationType, name }. */
  function beginTravel(summary, speedCautious = false, estimateMinutes = null) {
    const name = deps.localizedLocationName?.(summary) ?? summary?.name ?? null;
    if (name == null) throw new Error('TravelOptions: destination not found!');   // :472
    st.destinationName = name;
    ui?.setDestinationName(name);
    st.destinationSummary = summary;
    st.destinationCautious = speedCautious;
    if (st.settings.alwaysUseStartingAccel && ui) ui.timeAcceleration = st.settings.defaultStartingAccel;
    if (ui) ui.halfLimit = false;
    resumeTravel();
    st.beginTime = deps.worldTimeNow?.() ?? 0;
    // AUDIT-TO1 L5: the popup's own estimate for THIS trip, the port's
    // own reading for the enhanced panel; null for a followed path.
    st.estimateMinutes = Number.isFinite(estimateMinutes) && estimateMinutes > 0 ? estimateMinutes : null;
  }

  /** AUDIT-TO1 L5: the minutes still to run, or null when there is no
   *  estimate to run down - a followed path, a coordinate target, or a
   *  resumed journey whose estimate was for the whole trip. Clamped at
   *  zero: a walk that overran its estimate is "arriving", not owed. */
  function minutesLeft() {
    if (st.estimateMinutes == null || !st.autopilot || st.destinationName == null) return null;
    const elapsed = (deps.worldTimeNow?.() ?? 0) - st.beginTime;
    return Math.max(0, st.estimateMinutes - elapsed);
  }

  /** :475-493, BeginTravel() with no arguments - "used to continue
   *  journeys", which is what the map window's resume prompt calls. */
  function resumeTravel() {
    if (!st.destinationName) return;
    const rect = deps.locationWorldRect?.(st.destinationSummary);
    if (!rect) return;
    st.autopilot = new TravelAutopilot(st.destinationSummary.pixel, rect,
      travelSpeedMultiplier(st.destinationCautious, st.settings), { grow: true, isLocation: true });
    st.autopilot.onArrival = () => {
      ui?.closeWindow();
      clearTravelDestination();
      messageBox(T.MsgArrived);
    };
    st.lastLocation = deps.currentLocation?.() ?? null;
    initTravelUI();
  }

  /** :495-519, BeginTravelToCoords - a bare map pixel, no location.
   *  Note the speed: this one takes `road ? reckless : cautious`
   *  (:508), which reads oddly for a coordinate target - `road` is
   *  whatever the last followed path left behind - and is carried as
   *  written. */
  function beginTravelToCoords(target, speedCautious = false) {
    const targetName = format(T.MsgTargetCoords, target.x, target.y);
    ui?.setDestinationName(targetName);
    st.destinationCautious = speedCautious;
    if (st.settings.alwaysUseStartingAccel && ui) ui.timeAcceleration = st.settings.defaultStartingAccel;
    if (ui) ui.halfLimit = false;
    const origin = mapPixelWorldOrigin(target.x, target.y);
    const targetRect = rectOf(origin.x + MID_LO, origin.z + MID_LO, P_SIZE, P_SIZE);
    st.autopilot = new TravelAutopilot({ x: target.x, y: target.y }, targetRect,
      st.road ? st.settings.recklessTravelMultiplier : st.settings.cautiousTravelMultiplier);
    st.autopilot.onArrival = () => {
      ui?.closeWindow();
      clearTravelDestination();
      messageBox(T.MsgArrived);
    };
    st.lastLocation = deps.currentLocation?.() ?? null;
    initTravelUI();
  }

  /** :521-534, InitTravelUI. */
  function initTravelUI(circumnavSpeedLimiter = false) {
    disableJunctionMap(true);
    if (circumnavSpeedLimiter && ui && ui.timeAcceleration > MAX_CIRCUMNAVIGATION_ACCEL) setTimeScale(MAX_CIRCUMNAVIGATION_ACCEL);
    else setTimeScale(ui ? ui.timeAcceleration : 1);
    disableWeatherAndSound();
    st.diseaseCount = deps.diseaseCount?.() ?? 0;
    if (ui && !ui.isShowing) deps.pushWindow?.(ui);
  }

  /** :606-612's InitLocationRects, and the two GPS events that call it
   *  (:546-555, :557-565): whenever the player's map pixel changes, the
   *  rects for THAT pixel's location are recomputed, so the follow key
   *  always has a ring to walk. Only while roads integration is on and
   *  the player is not mid-journey to a named place. */
  function initLocationRects(mapPixel = pixel()) {
    if (!(st.settings.roadsIntegration && (st.autopilot == null || st.destinationName != null))) return;
    setLocationRects(mapPixel);
  }

  /** :568-605, SetLocationRects. The host answers the terrain's tile
   *  rectangle for a pixel; a pixel with no location clears both rects
   *  (:602-604). */
  function setLocationRects(mapPixel) {
    const info = deps.locationTileRect?.(mapPixel);
    if (!info) {
      st.locationRect = null; st.locationBorderRect = null;
      return false;
    }
    const origin = mapPixelWorldOrigin(mapPixel.x, mapPixel.y);
    const r = locationRectsOf(origin.x, origin.z, info.tileRect, info.locationType === LOCATION_TYPES.TownCity, info.hasCustomPosition);
    st.locationRect = r.locationRect;
    st.locationBorderRect = r.locationBorderRect;
    return r.aimForCentre;
  }

  /** :614-679, FollowPath - the follow key's whole answer. */
  function followPath() {
    const p = pos(), mp = pixel();
    const inLoc = !!st.locationRect && rectContains(st.locationRect, p.x, p.z);
    const net = roads();
    const pathsDataPt = pathsDataPoint(net, mp.x, mp.y);
    const onPath = playerOnPathAt(pathsDataPt, p.x, p.z, mp.x, mp.y);

    if (onPath !== 0) {
      const playerDirection = directionOfYaw(yawDeg());
      const roadDataPt = roadsDataPoint(net, mp.x, mp.y);
      // :637 - inside a town the facing alone decides (there is no
      // standing ON the path in there); outside, the facing must be a
      // path the player is standing on.
      if ((inLoc && (pathsDataPt & playerDirection) !== 0) || (pathsDataPt & playerDirection & onPath) !== 0) {
        st.road = (roadDataPt & playerDirection) !== 0;
        st.destinationName = null;
        beginPathTravel(targetPixel(playerDirection, mp.x, mp.y));
        return true;
      }
      // :646-656 - else try the way the player came: this is what
      // turning round on a road does.
      const fromDirection = directionOfYaw(yawDeg(true));
      if ((inLoc && (pathsDataPt & fromDirection) !== 0) || (pathsDataPt & fromDirection & onPath) !== 0) {
        st.road = (roadDataPt & fromDirection) !== 0;
        st.destinationName = null;
        beginPathTravel(targetPixel(0, mp.x, mp.y));   // :653 - GetTargetPixel(0) is THIS pixel
        return true;
      }
    }
    // :658-664 - in the border ring of a town: walk around it
    if (!inLoc && st.locationBorderRect && rectContains(st.locationBorderRect, p.x, p.z)) {
      // ROAD-CRASH (2026-09-23, Discord through Mac: "crashes while
      // traveling on roads with travel options"): THE RING WALK IS A
      // FOLLOWED PATH, and forgets the named destination as the two path
      // arms above do. The mod's arm does not - and an interrupt "leaves
      // current destination active" (:1273), so a ring walked after one
      // ran with that name still set, which is the ONE condition under
      // which InitLocationRects keeps refreshing the rects mid-journey
      // (:606-612, `destinationName != null`). The next pixel crossed - a
      // town's ring reaches into its neighbours - answered no location
      // (not built yet, or none there), both rects went null, and the
      // walk's own OnArrival read `.zMax` off null. Unity logs that and
      // runs the next frame; this host's frame loop dies on it. With the
      // name gone the rects hold for the whole walk, as they do for
      // every path leg, and the follow key, the avoid-encounter resume
      // and the LocationPause arm all read the walk as the followed
      // path it is. Recorded departure 16.
      st.destinationName = null;
      st.corners = locBorderCornerRects(st.locationRect, st.locationBorderRect);
      circumnavigateLocation();
      return true;
    }
    // :666-678 - no path here. With the junction map set to toggle off
    // paths, the key flips the map instead of only complaining.
    if (st.settings.roadsJunctionMap && st.settings.toggleMapOffPaths) {
      st.junctionMapOn = !st.junctionMapOn;
      if (st.junctionMapOn) {
        drawJunctionMap(mp);
        say(T.MsgNoPath);
      }
    } else {
      say(T.MsgNoPath);
    }
    return false;
  }

  /** :681-720, BeginPathTravel - one leg of a followed path. */
  function beginPathTravel(target, starting = true) {
    if (!target) return;
    st.lastCrossed = 0;
    ui?.setDestinationName(st.road ? T.MsgFollowRoad : T.MsgFollowTrack);
    const origin = mapPixelWorldOrigin(target.x, target.y);
    // :700 - a target pixel that holds a location is aimed at its
    // BORDER rect, so the leg ends at the town's edge; otherwise at
    // the 512-unit square in the middle of the pixel.
    const aimed = setLocationRects(target);
    const targetRect = aimed ? st.locationBorderRect : rectOf(origin.x + MID_LO, origin.z + MID_LO, P_SIZE, P_SIZE);

    st.destinationCautious = true;   // :702
    if (starting && st.settings.alwaysUseStartingAccel && ui) ui.timeAcceleration = st.settings.defaultStartingAccel;
    if (ui) ui.halfLimit = true;     // :705 - half the acceleration limit while following

    const speed = st.road ? st.settings.recklessTravelMultiplier : st.settings.cautiousTravelMultiplier;
    if (st.autopilot == null) {
      st.autopilot = new TravelAutopilot(target, targetRect, speed);
      st.autopilot.onArrival = selectNextPath;
    } else {
      st.autopilot.initTargetRect(target, targetRect, speed);
    }
    initTravelUI();
    if (st.settings.roadsJunctionMap && st.settings.persistentJunctionMap) {
      drawJunctionMap(pixel());
      st.junctionMapOn = true;
    }
  }

  /** :722-751, SelectNextPath - what happens when a leg arrives. */
  function selectNextPath() {
    if (!deps.hasCurrentLocation?.()) {
      const mp = pixel();
      const net = roads();
      const pathsDataPt = pathsDataPoint(net, mp.x, mp.y);
      if (countSetBits(pathsDataPt) === 2) {
        // :727-1050 - exactly two ways out: carry straight on.
        const dir = nextPathDirection(pathsDataPt, directionOfYaw(yawDeg()), directionOfYaw(yawDeg(true)));
        // ROAD-CRASH: the recovery walk's give-up. nextPathDirection
        // hands back the mod's RAW leftover when its nine tries narrow
        // nothing (travelPaths.js; the mod's own ":1036 - should work
        // 99% of the time"), and GetTargetPixel's default arm makes THAT
        // a leg to the pixel the player stands in - arrived before it
        // starts, OnArrival again next frame, and so on for ever with
        // the panel up and the clock racing. A pick that is not one edge
        // is a junction here: the journey stops and the map goes up, as
        // at every other pixel the mod cannot read. Recorded departure 17.
        if (countSetBits(dir) === 1) {
          const roadDataPt = roadsDataPoint(net, mp.x, mp.y);
          st.road = (roadDataPt & dir) !== 0;
          beginPathTravel(targetPixel(dir, mp.x, mp.y), false);
          return;
        }
      }
      // :1057-1063 - a junction: stop, and put the mini-map up.
      say(T.MsgArrivedJunc);
      if (st.settings.roadsJunctionMap) {
        drawJunctionMap(mp);
        st.junctionMapOn = true;
      }
    } else {
      // :1066 - arrived at a location: remember the way we came, so
      // the ring walk knows which path it has already crossed.
      st.lastCrossed = directionOfYaw(yawDeg(true));
    }
    ui?.closeWindow();
  }

  /** :753-797, CircumnavigateLocation. */
  function circumnavigateLocation() {
    // ROAD-CRASH: the seam's own guard. A walk whose rects are gone has
    // nothing to walk round, and the mod's NullReferenceException here
    // is a logged frame in Unity and a dead frame loop in this host. The
    // walk ends where it stands, as a junction's does (:1063,
    // CloseWindow - the host's onClose is InterruptTravel); a host whose
    // panel does not interrupt is stopped outright. The follow key asked
    // again answers "no path" through followPath's own rect test.
    if (!st.locationRect || !st.locationBorderRect) {
      ui?.closeWindow();
      if (st.autopilot) interruptTravel();
      return;
    }
    const p = pos(), mp = pixel();
    if (st.circumnavigatePathsDataPt === 0) st.circumnavigatePathsDataPt = pathsDataPoint(roads(), mp.x, mp.y);
    const yaw = Math.trunc(yawDeg());   // :758 - `(int)GetNormalisedPlayerYaw()`
    if (!st.corners) st.corners = locBorderCornerRects(st.locationRect, st.locationBorderRect);
    const which = circumnavigateTarget(p.x, p.z, yaw, st.locationRect, st.locationBorderRect, st.corners);
    if (!which) return;
    const targetRect = st.corners[which];

    ui?.setDestinationName(format(T.MsgCircumnavigate, deps.localizedCurrentLocationName?.() ?? ''));
    st.destinationCautious = false;   // :781
    if (st.settings.alwaysUseStartingAccel && ui) ui.timeAcceleration = st.settings.defaultStartingAccel;
    if (ui) ui.halfLimit = true;

    st.autopilot = new TravelAutopilot(mp, targetRect, travelSpeedMultiplier(st.destinationCautious, st.settings));
    st.autopilot.onArrival = () => circumnavigateLocation();
    initTravelUI(true);   // :791 - the circumnavigation speed limiter
    if (st.settings.roadsJunctionMap && st.settings.persistentJunctionMap) {
      drawJunctionMap(mp, directionOfYaw(yawDeg()));
      st.junctionMapOn = true;
    }
  }

  /** :911-928, DrawJunctionMap, and :954-962's UpdateJunctionMap. */
  function drawJunctionMap(mapPixel, playerDirection = 0) {
    if (!deps.junctionMap) return;
    const dir = playerDirection === 0 ? directionOfYaw(yawDeg()) : playerDirection;
    deps.junctionMap.draw(mapPixel, dir);
    st.lastPlayerFacing = dir;
  }
  function updateJunctionMap(mapPixel) {
    const dir = directionOfYaw(yawDeg());
    if (st.lastPlayerFacing !== dir) drawJunctionMap(mapPixel, dir);
  }
  /** :964-968, DisableJunctionMap. */
  function disableJunctionMap(force = false) {
    if (force || (st.settings.roadsJunctionMap && !st.settings.persistentJunctionMap && !st.settings.toggleMapOffPaths)) {
      st.junctionMapOn = false;
    }
  }

  /** :1273-1294, InterruptTravel - "Stops travel, but leaves current
   *  destination active". */
  function interruptTravel() {
    setTimeScale(1);
    st.circumnavigatePathsDataPt = 0;
    deps.setMouseLookEnabled?.(true);
    if (st.autopilot) {
      const f = st.autopilot.mouseLookAtDestination();
      deps.setFacing?.(f.yaw, f.pitch);
    }
    st.autopilot = null;
    enableWeatherAndSound();
    // :994-996 - see st.enterRectDetached (AUDIT-TO1 M1)
    if (st.settings.locationPause === LOC_PAUSE_ENTER) st.enterRectDetached = true;
    if (st.settings.roadsJunctionMap && st.settings.persistentJunctionMap && st.junctionMapOn) {
      drawJunctionMap(pixel());
    }
  }

  /** :1187-1192, StopTravelWithMessage. */
  function stopTravelWithMessage(message) {
    if (ui?.isShowing) ui.closeWindow();
    messageBox(message);
  }

  /** :1199-1213, AttemptAvoidEncounter. */
  function attemptAvoidEncounter() {
    const e = deps.entity?.() ?? {};
    const chance = avoidEncounterChance(e.luck ?? 50, e.stealth ?? 0, st.settings.maxAvoidChance);
    if ((deps.roll100?.() ?? 100) <= chance) {   // Dice100.SuccessRoll
      st.ignoreEncounters = true;
      st.ignoreEncountersTime = Math.trunc(now()) + IGNORE_ENCOUNTERS_SECONDS;
      st.lastPlayerFacing = 0;   // :1208 - so a persistent map redraws at once
      if (st.destinationName != null) resumeTravel();
      else followPath();
      ui?.showMessage(T.MsgAvoidSuccess);
    } else {
      messageBox(T.MsgAvoidFail);
    }
  }

  /** :1215-1233 / :1235-1271 - what an accelerated journey turns off
   *  and what it turns back on. The port's hosts own the three
   *  switches; a host that hands none simply travels with them on. */
  function disableWeatherAndSound() {
    if (!st.settings.enableWeather) deps.setWeatherEnabled?.(false);
    if (!st.settings.enableSounds) deps.setTravelSoundsEnabled?.(false);
    if (!st.settings.enableRealGrass) deps.setRealGrassEnabled?.(false);
  }
  function enableWeatherAndSound() {
    if (!st.settings.enableWeather) deps.setWeatherEnabled?.(true);
    if (!st.settings.enableSounds) deps.setTravelSoundsEnabled?.(true);
    if (!st.settings.enableRealGrass) deps.setRealGrassEnabled?.(true);
  }

  /** :1246-1256, DisplayHelpInfo - the H key's message box. The three
   *  placeholders are the follow key (KB1: the FollowPaths binding), the
   *  TravelExit binding and the TravelMap binding. */
  function helpText() {
    return format(localize('HelpInfoSDF'), deps.binding?.('FollowPaths') || 'None',
      deps.binding?.('TravelExit') ?? 'V', deps.binding?.('TravelMap') ?? 'M');
  }

  /** :1258-1320, MessageReceiver - the eight messages other mods send
   *  this one. Kept because the port's own hosts use three of them
   *  (`isTravelActive` gates the quest machine's popups the same way)
   *  and because a later ported mod may send the rest. */
  const messages = {
    pauseTravel: () => { if (ui?.isShowing) ui.closeWindow(); },
    isTravelActive: () => !!ui?.isShowing,
    isPathFollowing: () => !!ui?.isShowing && st.destinationName == null,
    isFollowingRoad: () => st.road,
    showMessage: (msg) => { if (msg) ui?.showMessage(msg); },
    hasPort: (mapId) => hasPort(mapId),
  };

  /** :1325-1365, Update - THE ORDER IS THE MOD'S, step for step.
   *
   *  `frame` is what the host knows this frame and the C# asks
   *  GameManager for: { topWindowIsTravelUI, topWindowAllowsTravel,
   *  isPlayerOnHUD, gamePaused, inputPaused, followKeyDown, helpKeyDown,
   *  isPlayerInside }. Returns a small report the host acts on -
   *  `arrived` when the autopilot reached its rect, and the autopilot's
   *  yaw and forward force for the frame. */
  function update(frame = {}) {
    // :1327-1332 - a window that stopped travel is closed once it is
    // on top again, and nothing else happens this frame.
    if (st.uiCloseWhenTop && frame.topWindowIsTravelUI) {
      st.uiCloseWhenTop = false;
      ui?.closeWindow();
      return { handled: true };
    }
    const mp = pixel();
    // :1335-1338 - H over the travel UI opens the help.
    if (frame.topWindowIsTravelUI && frame.helpKeyDown) messageBox(helpText());

    let drive = null;
    if (st.autopilot) {
      const p = pos();
      drive = st.autopilot.update({ worldX: p.x, worldZ: p.z, mapPixelX: mp.x, mapPixelY: mp.y });
      // :1343-1345 - the autopilot runs even while the game is paused
      // (the travel map is open over it), and nothing else does.
      if (frame.gamePaused) return { drive, handled: true };

      // :1348-1356 - any OTHER window stops the journey.
      if (frame.isPlayerOnHUD || !(frame.topWindowIsTravelUI || frame.topWindowAllowsTravel)) {
        interruptTravel();
        st.uiCloseWhenTop = !!ui?.isShowing;
        return { drive, handled: true, interrupted: true };
      }
      // :1358-1362 - the follow key stops a followed journey.
      if (st.destinationName == null && st.settings.roadsIntegration && !frame.inputPaused && frame.followKeyDown) {
        if (ui?.isShowing) ui.closeWindow();
      }
      // :1364-1375 - crossing another path while walking a town's ring
      if (st.circumnavigatePathsDataPt !== 0) {
        const crossed = playerOnPathAt(st.circumnavigatePathsDataPt, p.x, p.z, mp.x, mp.y);
        if (crossed !== 0 && crossed !== st.lastCrossed) {
          st.lastCrossed = crossed;
          if (ui?.isShowing) ui.closeWindow();
          return { drive, handled: true, crossedPath: crossed };
        }
        st.lastCrossed = crossed;
      }
      // :1377-1389 - cautious travel watches health and fatigue
      if (st.destinationCautious) {
        const e = deps.entity?.() ?? {};
        const healthPc = (e.health ?? 1) / (e.maxHealth ?? 1) * 100;
        if (healthPc < st.settings.cautiousHealthMinPc) { stopTravelWithMessage(T.MsgLowHealth); return { drive, handled: true, stopped: 'health' }; }
        if ((e.fatigue ?? 0) < FATIGUE_MULTIPLIER * st.settings.cautiousFatigueMin) { stopTravelWithMessage(T.MsgLowFatigue); return { drive, handled: true, stopped: 'fatigue' }; }
      }
      // :1391-1400 - a location nearby, under LocationPause "nearby"
      const loc = deps.currentLocation?.() ?? null;
      if (st.settings.locationPause === LOC_PAUSE_NEAR && st.destinationName != null && deps.hasCurrentLocation?.()
        && !sameLocation(loc, st.lastLocation) && (deps.localizedCurrentLocationName?.() ?? '') !== st.destinationName) {
        st.lastLocation = loc;
        deps.discoverLocation?.(loc);
        stopTravelWithMessage(format(T.MsgNearLocation,
          locationTypeString(loc?.locationType, deps.locationTypeName?.() ?? ''), deps.localizedCurrentLocationName?.() ?? ''));
        return { drive, handled: true, stopped: 'location' };
      }
      // :1402-1407 - the sea
      if ((deps.climateIndex?.() ?? 0) === CLIMATE_OCEAN) { stopTravelWithMessage(T.MsgOcean); return { drive, handled: true, stopped: 'ocean' }; }
      // :1409-1424 - encounters
      if (st.ignoreEncounters && now() >= st.ignoreEncountersTime) st.ignoreEncounters = false;
      if (!st.ignoreEncounters && deps.enemiesNearby?.()) {
        ui?.closeWindow();
        if (st.destinationCautious) attemptAvoidEncounter();
        else messageBox(T.MsgEnemies);
        return { drive, handled: true, stopped: 'enemies' };
      }
      // :1426-1437 - a new disease stops the journey and shows the
      // health status box.
      const dc = deps.diseaseCount?.() ?? 0;
      if (dc !== st.diseaseCount) {
        if (dc > st.diseaseCount) { interruptTravel(); deps.showHealthStatus?.(); }
        st.diseaseCount = dc;
      }
    } else if (st.settings.roadsIntegration && !frame.inputPaused && frame.followKeyDown && frame.isPlayerOnHUD) {
      // :1438-1446 - the follow key, with no journey running
      if (frame.isPlayerInside) return { handled: true };
      if (deps.enemiesNearby?.()) messageBox(deps.text?.('cannotTravelWithEnemiesNearby') ?? 'You cannot travel with enemies nearby.');
      else followPath();
    }
    // :1448-1470 - the junction map's own upkeep
    if (st.settings.roadsJunctionMap && st.junctionMapOn) {
      if (deps.enemiesNearby?.()) {
        st.junctionMapOn = false;
      } else if (!ui?.isShowing) {
        const pathsDataPt = pathsDataPoint(roads(), mp.x, mp.y);
        const p = pos();
        if (!st.settings.toggleMapOffPaths && playerOnPathAt(pathsDataPt, p.x, p.z, mp.x, mp.y) === 0) st.junctionMapOn = false;
        else updateJunctionMap(mp);
      } else if (st.settings.persistentJunctionMap) {
        updateJunctionMap(mp);
      }
    }
    return { drive, handled: !!st.autopilot };
  }

  /** :1394 - `!playerGPS.CurrentLocation.Equals(lastLocation)`. A DFU
   *  DFLocation compares by value; the port's summaries carry a mapId,
   *  which is the same identity. */
  const sameLocation = (a, b) => (a == null && b == null) || (!!a && !!b && a.mapId === b.mapId);

  /** :540-544 - GameManager_OnEncounter, the event DFU raises when a
   *  quest or a spawn puts foes on the player. It fires BEFORE the
   *  Update loop's own `AreEnemiesNearby` sweep would. */
  function onEncounter() {
    if (ui?.isShowing && !st.ignoreEncounters) {
      setTimeScale(1);   // :543 - "essentially redundant, but still helpful"
      ui.closeWindow();
      messageBox(T.MsgEnemies);
    }
  }

  /** :546-555, PlayerGPS_OnEnterLocationRect - the LocationPause
   *  "entered" arm. */
  function onEnterLocationRect(location) {
    if (st.enterRectDetached) return;   // AUDIT-TO1 M1: the mod's `-=` at :994-996
    if (st.destinationName && st.settings.locationPause === LOC_PAUSE_ENTER) {
      if (ui?.isShowing) ui.closeWindow();
      messageBox(format(T.MsgEnterLocation, deps.locationTypeName?.() ?? '',
        deps.localizedLocationName?.(location) ?? location?.name ?? ''));
    }
  }

  /** :557-561, PlayerGPS_OnMapPixelChanged. */
  function onMapPixelChanged(mapPixel) {
    disableJunctionMap();
    initLocationRects(mapPixel);
  }

  /** :563-569, PlayerGPS_OnRegionIndexChanged. */
  function onRegionIndexChanged() {
    if (ui?.isShowing) ui.showMessage(format(T.MsgNewRegion, deps.regionName?.() ?? ''));
  }

  return {
    state: st,
    get settings() { return st.settings; },
    set settings(v) { st.settings = v; },
    get destinationName() { return st.destinationName; },
    get road() { return st.road; },
    get isTravelActive() { return !!ui?.isShowing; },
    get isPathFollowing() { return !!ui?.isShowing && st.destinationName == null; },
    get junctionMapOn() { return st.junctionMapOn; },
    get minutesLeft() { return minutesLeft(); },   // AUDIT-TO1 L5
    beginTravel, resumeTravel, beginTravelToCoords, clearTravelDestination,
    followPath, beginPathTravel, selectNextPath, circumnavigateLocation,
    interruptTravel, update, helpText, messages,
    followKeyText: () => deps.binding?.('FollowPaths') || null,   // KB1: the FollowPaths key's name, or null unbound
    initLocationRects, setLocationRects,
    onEncounter, onEnterLocationRect, onMapPixelChanged, onRegionIndexChanged,
    drawJunctionMap, updateJunctionMap, disableJunctionMap,
    attemptAvoidEncounter,
  };
}
