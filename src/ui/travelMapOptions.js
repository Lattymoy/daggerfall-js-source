// TO1: WHAT TRAVEL OPTIONS ADDS TO THE TRAVEL MAP -
// TravelOptionsMapWindow.cs, the half that is layout and drawing. The
// window itself stays ui/travelMapWindow.js, which is DFU's own and
// carries its own pins down to literal source strings; this module is
// what that window calls into, so the mod's additions read in one place
// and the window gains four small seams rather than four hundred lines.
//
// WHAT IS HERE:
//   - the PORTS filter button, its two textures and the shuffle it
//     performs on the arrow buttons (:85-92, :199-220);
//   - the region page drawn at FIVE texels a map pixel with the road
//     and track network on it (:593-662), which is the mod's whole
//     visual addition to the map and the thing its readme warns needs
//     a tall screen;
//   - the location information box the I key opens (:374-464);
//   - the resume prompt (:322-345) and the teleport charge (:470-503).
//
// WHAT IS NOT HERE, and why: the four path TOGGLE buttons (roads,
// tracks, rivers, streams; :221-279). The mod ships no art for them -
// `TextureReplacement.TryImportImage("roadsOff.png", ...)` reads the
// PLAYER's texture folder and `SetupPathButtons` RETURNS without making
// a button when it is not there (:231-238) - so a player who installs
// only the mod gets no toggles, which is the shipped behaviour. The
// port already has those four flags in its shared store and flips them
// from the enhanced map's chip row (ROADS 12/24, ui/travelMapWindow.js
// :544-552), which is the same answer arrived at independently; this
// module reads that store rather than growing a second one.

import { drawMapSection, drawPath, drawLocation, isLocationLarge, packColor, packRGBA, DOT_SCALE, ROAD_COLOR, TRACK_COLOR, RIVER_COLOR, STREAM_COLOR } from './travelPathsOverlay.js';
import { hasPort } from '../systems/travelPorts.js';
import { TRAVEL_OPTIONS_TEXT as T, format } from '../systems/travelOptionsText.js';
import { PATH_ROADS, PATH_TRACKS, PATH_RIVERS, PATH_STREAMS } from '../systems/travelPaths.js';
import { BUILDING_TYPES, isNamedBuildingType } from '../world/buildingNames.js';   // RMBLayout.IsNamedBuilding, one home

/** TravelOptionsMapWindow.cs:80-92 - the ports button and the three
 *  anchors it shuffles. The button sits where the arrow buttons live,
 *  so when a region pages (and the arrows are therefore ENABLED) the
 *  mod moves all three: the ports button up seven pixels and both
 *  arrows down eight. */
export const PORTS_SIZE = Object.freeze([45, 11]);
export const PORT_FILTER_POS = Object.freeze([231, 180]);
export const PORT_FILTER_MOVED = Object.freeze([231, 173]);
export const HORIZ_ARROW_POS = Object.freeze([231, 176]);
export const HORIZ_ARROW_MOVED = Object.freeze([231, 184]);
export const VERT_ARROW_POS = Object.freeze([254, 176]);
export const VERT_ARROW_MOVED = Object.freeze([254, 184]);

/** :199-220, SetupArrowButtons - where the three sit for a given page.
 *  `paging` is `verticalArrowButton.Enabled || horizontalArrowButton
 *  .Enabled`. Returns the three anchors, so a caller draws and hit-tests
 *  from one answer. */
export function portsBarAnchors(paging) {
  return paging
    ? { ports: PORT_FILTER_MOVED, horizontalArrow: HORIZ_ARROW_MOVED, verticalArrow: VERT_ARROW_MOVED }
    : { ports: PORT_FILTER_POS, horizontalArrow: HORIZ_ARROW_POS, verticalArrow: VERT_ARROW_POS };
}

/** :828-844, checkLocationDiscovered's ports arm: with the filter on,
 *  a place that is not a port is not on the map at all. Everything
 *  else about discovery is the port's own law (ui/travelMapWindow.js
 *  checkLocationDiscovered), which this wraps rather than replaces. */
export function portsFilterAllows(portsFilter, mapId) {
  return !portsFilter || hasPort(mapId);
}

/** :593-662, UpdateMapLocationDotsTextureWithPaths - the region page at
 *  five texels a map pixel.
 *
 *  It is the port's own dots walk with three differences, and they are
 *  the mod's whole picture: the buffer is five times bigger in each
 *  direction, each path type is drawn as LINES through its pixel
 *  (drawPath) under the dots, and each dot is a 5x5 or a 3x3 square
 *  rather than one texel (drawLocation).
 *
 *  The draw ORDER is the mod's: streams, tracks, rivers, roads, then
 *  the location dot - so a road wins over a track and a town wins over
 *  both. (The mod draws rivers AFTER tracks and BEFORE roads, which is
 *  not the order the four toggles are listed in, and is kept.)
 *
 *  Every law the port's own walk keeps is kept here too: the page's
 *  `(originX + x, originY + y)` texel lookup, the politic-index
 *  containment, and DFU's `* scale` offset quirk - the `offset5`
 *  expression is the same product, taken at five times the stride.
 *
 *  `deps` mirrors the window's own reads: politicAt, summaryAt,
 *  discovered, colorIndexOf, colors, pathsAt, showPaths, onlyLargeDots,
 *  markedMapId, markColor, outlineOn, outlineColor. */
export function drawRegionPageWithPaths(dotsBuf, outlineBuf, {
  originX, originY, width, height, scale, selectedRegion,
}, deps) {
  const {
    politicAt, summaryAt, discovered, colorIndexOf, colors, pathsAt,
    showPaths = [true, true, false, false], onlyLargeDots = false,
    markedMapId = -1, markColor = null, outlineOn = false, outlineColor = 0,
  } = deps;
  dotsBuf.fill(0);
  outlineBuf.fill(0);
  const width5 = width * DOT_SCALE;
  const px = {
    [PATH_STREAMS]: packColor(STREAM_COLOR), [PATH_TRACKS]: packColor(TRACK_COLOR),
    [PATH_RIVERS]: packColor(RIVER_COLOR), [PATH_ROADS]: packColor(ROAD_COLOR),
  };
  const mark = markColor ? (typeof markColor === 'number' ? markColor : packRGBA(...markColor)) : null;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const offset = Math.trunc((((height - y - 1) * width) + x) * scale);
      if (offset >= width * height) continue;
      const offset5 = Math.trunc((((height - y - 1) * DOT_SCALE * width5) + (x * DOT_SCALE)) * scale);
      const mpX = originX + x, mpY = originY + y;
      // :621-628 - the four path types, in the mod's own order
      for (const type of [PATH_STREAMS, PATH_TRACKS, PATH_RIVERS, PATH_ROADS]) {
        if (showPaths[type]) drawPath(dotsBuf, offset5, width5, pathsAt(mpX, mpY, type), px[type]);
      }
      // :630-643 - the dot, under the page's own containment law
      if (politicAt(mpX, mpY) - 128 !== selectedRegion) continue;
      const summary = summaryAt(mpX, mpY);
      if (!summary) continue;
      if (!discovered(summary)) continue;
      const index = colorIndexOf(summary.locationType);
      if (index === -1) continue;
      if (outlineOn) outlineBuf[offset] = outlineColor;
      drawLocation(dotsBuf, offset5, width5, colors[index] ?? 0,
        isLocationLarge(summary.locationType, onlyLargeDots),
        { highlight: summary.mapID === markedMapId || summary.mapId === markedMapId, markColor: mark });
    }
  }
}

/** :374-464, DisplayLocationInfo - what the I key shows over a selected
 *  place: the named buildings the player has DISCOVERED inside it,
 *  counted by type in two columns, with the guild halls named on a line
 *  of their own.
 *
 *  The types it refuses outright (:377-382) are the ones with no
 *  buildings to know: a coven, the three dungeon kinds, a graveyard and
 *  None. Returns { title, guilds, rows } for the window to lay out, or
 *  null for "no knowledge", which the mod answers with its own message.
 *
 *  `buildings` is what the port's discovery data holds for the place:
 *  [{ buildingType, displayName }] out of systems/discovery.js. The
 *  filter is the mod's own, `RMBLayout.IsNamedBuilding(buildingType)`,
 *  which the port has as `isNamedBuildingType`. */
export const INFO_REFUSED_TYPES = Object.freeze([13, 7, 4, 10, 12, 0xffff]);

/** DFLocation.BuildingTypes.GuildHall - 0x0B. A guild hall is NAMED on
 *  its own line and never counted with the shops (:404-406). */
export const BUILDING_GUILD_HALL = BUILDING_TYPES.GuildHall;

export function locationInfoRows(locationType, buildings, typeName) {
  if (INFO_REFUSED_TYPES.includes(locationType)) return null;
  if (!buildings || !buildings.length) return null;
  const counts = new Map();
  const guildNames = [];
  for (const b of buildings) {
    // :396 - `RMBLayout.IsNamedBuilding(building.buildingType)`
    if (!b || !isNamedBuildingType(b.buildingType)) continue;
    const name = String(b.displayName ?? '').startsWith('The ') ? String(b.displayName).slice(4) : String(b.displayName ?? '');
    if (b.buildingType === BUILDING_GUILD_HALL) {
      if (!guildNames.includes(name)) guildNames.push(name);
      continue;   // :404-406 - a guild hall is named, never counted
    }
    counts.set(b.buildingType, (counts.get(b.buildingType) ?? 0) + 1);
  }
  if (!counts.size && !guildNames.length) return null;
  guildNames.sort();
  // :419-431 - a SortedDictionary, so the rows come out in building-type order
  const rows = [...counts.entries()].sort((a, b) => a[0] - b[0])
    .map(([type, n]) => ({ type, name: typeName(type), count: n }));
  return { guilds: guildNames.length ? T.MsgGuildHalls + guildNames.join(', ') : '', rows };
}
/** :443-446 - the three tab stops the two columns are laid out on. */
export const INFO_TABS = Object.freeze([60, 140, 200]);

/** :322-345, OnPush's resume prompt. */
export const resumePrompt = (destinationName) => format(T.MsgResume, destinationName);

/** :470-503, ChargeForTeleport - the mages guild's fee for the
 *  teleportation service below the rank it is free at. Eight minus the
 *  rank, two hundred gold a step, so a rank-1 mage pays 1400 and a
 *  rank-8 Wizard pays nothing. */
export const TELEPORT_RANK_FREE = 8;
export const TELEPORT_COST_PER_RANK = 200;
export function teleportCost(rank) {
  const underWizard = TELEPORT_RANK_FREE - (rank | 0);
  return underWizard > 0 ? underWizard * TELEPORT_COST_PER_RANK : 0;
}
export const teleportCostPrompt = (cost) => format(T.MsgTeleportCost, cost);

/* :30's `notEnoughGoldId` is DFU's own TEXT.RSC 454 and the port
   already has ONE home for it - ui/travelPopUp.js's
   NOT_ENOUGH_GOLD_TEXT_ID, which the travel map imports. A second
   export of the same number is the ONE DFU MEMBER, ONE EXPORT rule's
   own shape, so there is none here. */

/** The mini-map and the region page share one routine; re-exported so
 *  the window needs one import from this module. */
export { drawMapSection };
