// W1-i: THE TRAVEL MAP - DaggerfallTravelMapWindow.cs (MIT,
// Daggerfall Workshop; original authors Lypyl and Gavin Clayton) on
// the real TRAV0I00.IMG. This is the classic world map the F-slice
// left routed: the province map with its clickable regions, the
// region pages with their location dots, the flashing identify, the
// four filter buttons, the find box and its list picker, and the
// travel popup behind it (ui/travelPopUp.js).
//
// It RETIRED ui/travelMap.js, the keyed typeahead that stood in for
// this window since the F-slice: that file is gone from src/ and
// nothing imports it. What it carried forward and this window holds:
// the visibility law (checkLocationDiscovered, TV-slice) and the
// arrival seam (onTravel -> the host's fastTravelTo).
//
// THE NATIVE-WINDOW RULE, element by element:
// - the background is the whole 320x200 TRAV0I00.IMG (:326);
//   the region pages draw INTO the 320x160 window it frames, at
//   (0, regionPanelOffset=12) (:121).
// - the region label is a centred default-shadowed label at y=2
//   (:280-282).
// - the bottom bar's buttons: EXIT (278,175,39,22) - art already in
//   the background - FIND (3,175) and I'M AT (3,186) cut out of
//   TRAV0I03.IMG's 45x22 sheet, the four filter buttons cut out of
//   TRAV01I0/TRAV01I1's 179x22 sheets (enabled/disabled pairs) at
//   (50,175) (50,186) (149,175) (149,186), and the two 22x20 arrow
//   buttons at (231,176) and (254,176) (:463-527).
// - MBRD00I0.IMG borders the region page whenever it is not zoomed
//   (:319-322, :795-799).
// - the location dots are a GENERATED 320x160 texture, one pixel per
//   map pixel, coloured out of FMAP_PAL.COL by location type
//   (:253-269); with TravelMapLocationsOutline on, a second
//   half-transparent black copy draws four times at half-pixel
//   offsets to outline them (:296-311, :672-732).
//
// THE LAWS, verbatim:
// - the offset table (:590-648) that aligns each region page to map
//   pixels, Betony's scale of 4 and its -477/+60/+212 fixups, and
//   the Cybiades quarter-scale mouse fix (:1193-1198).
// - the dots walk (:687-731): politic index must equal the open
//   region, the pixel must carry a location, the location must be
//   discovered, and its type must survive the filters. DFU's own
//   `offset * scale` indexing quirk is kept - it is what makes the
//   Betony page plot at all.
// - the identify flash (:1732-1780): 0.5s per state, four flashes
//   for a region and two for a selected location, and the flash's
//   END is what pops the travel confirmation after a find.
// - the zoom (:736-803): right-click toggles a 2x crop centred on
//   the cursor, shift-move pans it, and the crop clamps to the page
//   edges. The port's textures are TOP-DOWN where Unity's are
//   bottom-up, so the buffers are built in DFU's bottom-up order and
//   flipped at upload; the crop rect is flipped with them.
// - the find box (:951-957) runs DFU's weighted edit distance over
//   the OPEN region's names (systems/editDistance.js), not a prefix
//   match, with MatchesCutOff's relevance gate.
//
// RECORDED DEPARTURES:
// - no localization layer: every name is the canonical MAPS.BSA one,
//   so GetLocalizedLocationName / GetLocalizedRegionName collapse to
//   the map table and REGION_NAMES, and the localizedMapNameLookup
//   dictionary reduces to the region's own name list. With it goes
//   the COLLATION: DFU's L-key list is OrderBy(p => p), which is
//   culture-sensitive, and this sorts ordinal - visible as the row
//   order of names that differ only by an apostrophe or a hyphen
//   (systems/editDistance.js records the same departure on the find
//   box's own two orderings).
// - no TextureReplacement: the imported region overlays and custom
//   region maps (:648-660, :821-833) have no door here.
// - no world data replacement: checkLocationDiscovered reads the
//   BAKED map table flag, which is what the TV-slice already did.
// - (RETIRED by ROAD-E E3, 2026-09-02: the console's THREE commands -
//   map_reveallocations, map_hidelocations and map_reveallocation -
//   are registered on the real ConsoleCommandsDatabase by the
//   registrar at the foot of this file, and the flag they set is the
//   same setRevealUndiscoveredLocations. What has no port is the
//   console WINDOW, which is a recorded departure in Ledger A: DFU's
//   is the third-party UnityConsole addon's Unity uGUI prefab, not
//   DFU source.)
// - DFU's Update() polls the mouse every frame; the port's windows
//   are told (hover/click), so the same work happens on the move.
//
// The guild TELEPORT mode (ActivateTeleportationTravel +
// DaggerfallTeleportPopUp, :1705-1730) idled here for one slice and is
// LIVE at G5: the service it waited on is systems/guildServiceFlow.js's
// `Teleport: 'guildServiceTeleport'`, and this file carries the map
// half - ui/teleportPopUp.js imported above, TELE00I0 preloaded, the
// one-shot `teleportationTravel` flag, activateTeleportationTravel
// (ActivateTeleportationTravel) and the TeleportPopUpWindow raised on
// the destination pick. (TravelMapSaveData ships through
// systems/travelMapState.js and the session envelope.) The journal's
// click-through travel (GotoPlace,
// :214-217 and its Update consumer :443-455) is LIVE - ui/questJournal.js
// offers the find dialog and the host hands the place here.

import { loadImg, nativeMetrics, drawImg, drawImgCrop, drawRect, shadowText, NATIVE_W } from './nativePanel.js';
import { OVERWORLD_ROAD, OVERWORLD_TRACK, OVERWORLD_RIVER, OVERWORLD_STREAM } from './overworldModel.js';   // ROADS 13/24: the relief's colours
// TO1: Travel Options' own additions to this window - the ports
// filter, the five-texel region page with his road network on it, the
// I key's location information, the resume prompt and the teleport
// charge (ui/travelMapOptions.js, TravelOptionsMapWindow.cs).
import {
  portsBarAnchors, portsFilterAllows, drawRegionPageWithPaths, PORTS_SIZE,
  locationInfoRows, INFO_TABS, resumePrompt, teleportCost, teleportCostPrompt,
} from './travelMapOptions.js';
import { DOT_SCALE } from './travelPathsOverlay.js';
import { TRAVEL_OPTIONS_TEXT as TO_TEXT, format as toFormat } from '../systems/travelOptionsText.js';
import { readPartyMarks, partyMarksKey, PARTY_DOT_RGB, PARTY_OFFLINE_DOT_RGB } from './partyMapMarks.js';   // SOC6: the party's marks, the one reading both maps share
import { MAP_WIDTH, MAP_HEIGHT } from '../formats/woodsFile.js';
import { layoutMessageBox, drawMessageBox, messageBoxHit, MB_BUTTONS, messageBoxArtLoaded } from './messageBox.js';
import { ListPickerWindow, preloadListPickerArt, listPickerArtLoaded } from './listPicker.js';
import { TravelPopUpWindow, preloadTravelPopUpArt, NOT_ENOUGH_GOLD_TEXT_ID } from './travelPopUp.js';
import { TeleportPopUpWindow, preloadTeleportPopUpArt } from './teleportPopUp.js';   // G5
import { drawText } from './text.js';
import { bindings } from './input.js';
import { InputMessageBoxWindow } from './inputMessageBox.js';   // CM8: Find is a pushed DaggerfallInputMessageBox
import { firstHotkey } from '../systems/dialogShortcuts.js';   // AUDIT 64 F23: the DaggerfallShortcut table, IsUpWith's modifier mask and all
import { codeMeans } from '../systems/inputActions.js';   // UXB1-S: its own key, shared or not
import { ImgFile } from '../formats/imgFile.js';
import { DFPalette } from '../formats/dfPalette.js';
import { TextRsc } from '../formats/textRsc.js';
import { REGION_NAMES, LOCATION_TYPES, longitudeLatitudeToMapPixel, getPixelFromPixelID, patchRegionIndex } from '../formats/mapsFile.js';
import { locationSummaryAt } from '../systems/mapDirectory.js';
import { getDaggerfallDistance, MatchesCutOff } from '../systems/editDistance.js';
import { hasDiscoveredLocationId } from '../systems/discovery.js';
import { getBool } from '../systems/settings.js';
import { registerCommand, consoleLog, HELP_COMMAND } from '../systems/consoleCommands.js';   // E3: the console command database
import { travelMapFilters, travelMapPopUpState, setTravelMapPopUpState, travelMapSaveData, restoreTravelMapSaveData, travelMapMarkedMapId, setTravelMapMarkedMapId } from '../systems/travelMapState.js';
import { audio } from '../systems/audio.js';
import { SOUND } from '../systems/soundClips.js';

// --- DFU's fields (:38-63) ---
export const BETONY_INDEX = 19;
export const REGION_PANEL_OFFSET = 12;
export const IDENTIFY_FLASH_COUNT = 4;
export const IDENTIFY_FLASH_COUNT_SELECTED = 2;
export const IDENTIFY_FLASH_INTERVAL = 0.5;
export const DOTS_OUTLINE_THICKNESS = 1;
/** dotOutlineColor (:56) - half-transparent black. */
export const DOT_OUTLINE_RGBA = Object.freeze([0, 0, 0, 128]);
/** outlineDisplacements (:57-63), in SCREEN pixels once DFU's
 *  `/ LocalScale` and the panel's own scaling cancel out. */
export const OUTLINE_DISPLACEMENTS = Object.freeze([[-0.5, 0], [0, -0.5], [0, 0.5], [0.5, 0]]);
export const ZOOM_FACTOR = 2;
export const MAX_MATCHING_RESULTS = 1000;
/** regionTextureOverlayPanelRect (:121) - the region page. */
export const REGION_RECT = Object.freeze([0, REGION_PANEL_OFFSET, 320, 160]);
export const REGION_W = 320, REGION_H = 160;
/** SOC6: how often this window asks the host for its party, in seconds.
 *  Not DFU's - DFU has no party. Slower than the enhanced map's poll
 *  because the answer here costs a whole dots-buffer rebuild, and a
 *  member's dot is a pixel: half a second of lag on one pixel is
 *  invisible, and the gate means most of those polls cost a string. */
export const PARTY_POLL_S = 0.5;

/** The bottom bar (:463-527). */
export const BUTTON_RECTS = Object.freeze({
  exit: [278, 175, 39, 22],
  find: [3, 175, 45, 11],
  at: [3, 186, 45, 11],
  dungeons: [50, 175, 99, 11],
  temples: [50, 186, 99, 11],
  homes: [149, 175, 80, 11],
  towns: [149, 186, 80, 11],
  horizontalArrow: [231, 176, 22, 20],
  verticalArrow: [254, 176, 22, 20],
});
/** The filter sheets' source rects on DFSize(179,22) (:122-125) and
 *  the find/at cutouts on DFSize(45,22) (:126-127). */
export const FILTER_SRC = Object.freeze({
  dungeons: [0, 0, 99, 11], temples: [0, 11, 99, 11],
  homes: [99, 0, 80, 11], towns: [99, 11, 80, 11],
});
export const FIND_SRC = Object.freeze([0, 0, 45, 11]);
export const AT_SRC = Object.freeze([0, 11, 45, 11]);
/** Internal_Strings' findLocationPrompt and the field's width
 *  (:983-986 - the constructor's 31 is overridden to 32). */
export const FIND_PROMPT = 'Enter name of place : ';
export const FIND_MAX_CHARACTERS = 32;

/** locationPixelColors' palette indices (:253-269) and the identify
 *  flash colour (:271), read out of FMAP_PAL.COL. */
export const LOCATION_PIXEL_COLOR_INDICES = Object.freeze([
  237, 240, 243, 246, 0, 53, 51, 55, 96, 101, 39, 33, 35, 37,
]);
export const IDENTIFY_FLASH_COLOR_INDEX = 244;

/** PopulateRegionOffsetDict (:590-648): the map pixel the top-left
 *  of each region page sits on. */
export const OFFSET_LOOKUP = Object.freeze({
  'FMAPAI00.IMG': [212, 340], 'FMAPBI00.IMG': [322, 340],
  'FMAPAI01.IMG': [583, 279], 'FMAPBI01.IMG': [680, 279],
  'FMAPCI01.IMG': [583, 340], 'FMAPDI01.IMG': [680, 340],
  'FMAP0I05.IMG': [381, 4], 'FMAP0I09.IMG': [525, 114], 'FMAP0I11.IMG': [437, 340],
  'FMAPAI16.IMG': [578, 0], 'FMAPBI16.IMG': [680, 0],
  'FMAPCI16.IMG': [578, 52], 'FMAPDI16.IMG': [680, 52],
  'FMAP0I17.IMG': [39, 106], 'FMAP0I18.IMG': [20, 29],
  'FMAP0I19.IMG': [80, 123],   // Betony scale different
  'FMAP0I20.IMG': [217, 293], 'FMAP0I21.IMG': [263, 79], 'FMAP0I22.IMG': [548, 219],
  'FMAP0I23.IMG': [680, 146], 'FMAP0I26.IMG': [680, 80], 'FMAP0I32.IMG': [41, 0],
  'FMAP0I33.IMG': [660, 101], 'FMAP0I34.IMG': [578, 40], 'FMAP0I35.IMG': [525, 3],
  'FMAP0I36.IMG': [440, 40], 'FMAP0I37.IMG': [448, 0], 'FMAP0I38.IMG': [366, 0],
  'FMAP0I39.IMG': [300, 8], 'FMAP0I40.IMG': [202, 0], 'FMAP0I41.IMG': [223, 6],
  'FMAP0I42.IMG': [148, 76], 'FMAP0I43.IMG': [15, 340], 'FMAP0I44.IMG': [61, 340],
  'FMAP0I45.IMG': [86, 338], 'FMAP0I46.IMG': [132, 340], 'FMAP0I47.IMG': [344, 309],
  'FMAP0I48.IMG': [381, 251], 'FMAP0I49.IMG': [553, 255], 'FMAP0I50.IMG': [661, 217],
  'FMAP0I51.IMG': [672, 275], 'FMAP0I52.IMG': [680, 256], 'FMAP0I53.IMG': [680, 340],
  'FMAP0I54.IMG': [491, 340], 'FMAP0I55.IMG': [293, 340], 'FMAP0I56.IMG': [263, 340],
  'FMAP0I57.IMG': [680, 157], 'FMAP0I58.IMG': [17, 53],
  'FMAP0I59.IMG': [0, 0],      // Glenumbra Moors correct at 0,0
  'FMAP0I60.IMG': [107, 11], 'FMAP0I61.IMG': [255, 275],   // Cybiades
});

/** The eighteen regions with NO page in the offset table (:590-648):
 *  the wildernesses, the two generic villages and the four coast
 *  strips. DFU's UpdateMapLocationDotsTexture indexes offsetLookup
 *  directly (:677, :885, :1151), so opening one of these throws
 *  KeyNotFoundException; the port REFUSES the page instead - a recorded
 *  departure, since a crash is not a behaviour worth reproducing.
 *
 *  SEVENTEEN of the eighteen are genuinely empty in MAPS.BSA: all four of
 *  their BSA records are zero-length and loadRegion() returns false, so there
 *  is nothing to paint. THE EIGHTEENTH IS NOT, and this comment used to claim
 *  otherwise. Region 31, High Rock sea coast, holds THREE real locations -
 *  Mantellan Crux (mapId 1001, map pixel (1,1), DUNGAA00.RMB, one of the
 *  fourteen MAIN_STORY_DUNGEON_IDS) and both "Your Ship" moorings, mapId
 *  1050578 at (2,2) with SHIPAA00.RMB and mapId 2102157 at (5,5) with
 *  SHIPAA01.RMB.
 *
 *  What survives the correction is that the refusal withholds nothing DFU
 *  would have given. DFU's own page table has no FMAP0I31.IMG row either, so
 *  region 31 is unpageable in DFU too; GetPlayerRegion (:1609-1617) subtracts
 *  128 from the politic index and answers -1 at sea, where the sea coast's
 *  politic is 64, so "I'M AT" cannot open it; and a moored ship is not a
 *  travel-map destination in the first place - TransportManager.BoardShip
 *  teleports straight to DaggerfallBankManager.GetShipCoords()
 *  (TransportManager.cs:368-397), and getPixelColorIndex's empty
 *  HomeYourShips arm means the map would draw no dot for either mooring even
 *  with a page. Mantellan Crux is entered through the main quest, not
 *  travelled to. */
export const hasRegionPage = (region) => getRegionMapNames(region).every((n) => !!OFFSET_LOOKUP[n]);

/** GetRegionMapNames (:1660-1672) - three regions page across two
 *  or four screens. */
export function getRegionMapNames(region) {
  if (region === 0) return ['FMAPAI00.IMG', 'FMAPBI00.IMG'];
  if (region === 1) return ['FMAPAI01.IMG', 'FMAPBI01.IMG', 'FMAPCI01.IMG', 'FMAPDI01.IMG'];
  if (region === 16) return ['FMAPAI16.IMG', 'FMAPBI16.IMG', 'FMAPCI16.IMG', 'FMAPDI16.IMG'];
  return [`FMAP0I${String(region).padStart(2, '0')}.IMG`];
}

/** GetRegionMapScale (:1674-1680). */
export function getRegionMapScale(region) { return region === BETONY_INDEX ? 4 : 1; }

/** GetPixelColorIndex (:1369-1431): the type's dot colour, or -1
 *  when it has none or a filter hides it. `filters` is
 *  { dungeons, temples, homes, towns }. */
export function getPixelColorIndex(locationType, filters = {}) {
  let index = -1;
  switch (locationType) {
    case LOCATION_TYPES.DungeonLabyrinth: index = 0; break;
    case LOCATION_TYPES.DungeonKeep: index = 1; break;
    case LOCATION_TYPES.DungeonRuin: index = 2; break;
    case LOCATION_TYPES.Graveyard: index = 3; break;
    case LOCATION_TYPES.Coven: index = 4; break;
    case LOCATION_TYPES.HomeFarms: index = 5; break;
    case LOCATION_TYPES.HomeWealthy: index = 6; break;
    case LOCATION_TYPES.HomePoor: index = 7; break;
    case LOCATION_TYPES.HomeYourShips: break;   // C#'s empty arm: no dot
    case LOCATION_TYPES.ReligionTemple: index = 8; break;
    case LOCATION_TYPES.ReligionCult: index = 9; break;
    case LOCATION_TYPES.Tavern: index = 10; break;
    case LOCATION_TYPES.TownCity: index = 11; break;
    case LOCATION_TYPES.TownHamlet: index = 12; break;
    case LOCATION_TYPES.TownVillage: index = 13; break;
    default: break;
  }
  if (index < 0) return index;
  else if (index < 5 && filters.dungeons) index = -1;
  else if (index > 4 && index < 8 && filters.homes) index = -1;
  else if (index > 7 && index < 10 && filters.temples) index = -1;
  else if (index > 9 && index < 14 && filters.towns) index = -1;
  return index;
}

const inRect = ([rx, ry, rw, rh], x, y) => x >= rx && y >= ry && x < rx + rw && y < ry + rh;
const packRGBA = (r, g, b, a) => (((a << 24) >>> 0) | (b << 16) | (g << 8) | r) >>> 0;

// map_reveallocations / map_hidelocations (:1788-1884). E3 gave them
// the database DFU registers them in (the registrar is at the foot of
// this file); the flag they set is this one.
let _revealUndiscoveredLocations = false;
export function setRevealUndiscoveredLocations(on) { _revealUndiscoveredLocations = !!on; }
export const revealUndiscoveredLocations = () => _revealUndiscoveredLocations;

// The A1/A2 texture-key lesson: uploadTexture memoizes forever, so
// every generated texture gets a MODULE-level version in its key.
let _texVer = 0;

// AnimateIdentify compares against Time.realtimeSinceStartup, which
// is always far past `identifyLastChangeTime = 0` - so DFU's first
// flash is ON the frame after the window opens. A per-window
// accumulator would start at 0 and hold the map dark for half a
// second on EVERY open (the port mints a window per open), so the
// clock is module-level and monotonic, exactly as DFU's is.
let _clock = 0;

// DFU keeps ONE DaggerfallTravelMapWindow alive in DaggerfallUI and
// re-PUSHES it (OnPush :353-366 re-identifies and closes the region
// panel), so the four filters and the popup's three toggles survive
// every open - and the save envelope carries them. The port mints a
// window per open, so that state lives in systems/travelMapState.js
// (the A2 zoom-memory shape), where the save layer can reach it
// without importing a window.

let _art = null;
/** The window's whole art bundle: the overworld, the picker BITMAP
 *  (indices, not a texture - the region shapes are read out of it),
 *  the button sheets, the border, FMAP_PAL.COL and TEXT.RSC. */
/** TO1: a PNG out of a vendored mod folder, in the shape `drawImg`
 *  reads. The precedent is systems/handheldTorches.js:820-825 -
 *  `toScreenOrder`, not `toColor32`, because this is drawn on a screen
 *  quad and the flip would stand it on its head. A file that is not
 *  there answers null and the caller draws nothing. */
async function loadVendorPng(deps, name) {
  try {
    const fetchFn = deps?.fetchFn ?? globalThis.fetch;
    if (!fetchFn) return null;
    const url = new URL(`../../vendor/travel-options/Textures/${name}.png`, import.meta.url).href;
    const res = await fetchFn(url);
    if (!res?.ok) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    const { decodePng } = await import('../systems/textureReplacement.js');
    const { toScreenOrder } = await import('../formats/color32Order.js');
    // AUDIT-TO1 E2: toScreenOrder answers `{ width, height, colors }` -
    // what uploadTexture EATS - and the precedent this loader cited
    // (handheldTorches.js) uploads it before drawing. Stored as-is, the
    // pair reached drawImg with no `tex` and the PORTS button painted
    // as an opaque white 45x11 block in both of its states.
    const px = toScreenOrder(await decodePng(bytes));
    const tex = deps?.renderer?.uploadTexture?.('img', `travelopts:${name}`, px, { mips: false, variant: '#travelopts' }) ?? null;
    return tex ? { tex, w: px.width, h: px.height } : null;
  } catch { return null; }
}

export async function preloadTravelMapArt(deps) {
  if (_art) return _art;
  const { fetchBytes, palette } = deps;
  const fmapPalette = new DFPalette();
  fmapPalette.load(await fetchBytes('FMAP_PAL.COL'), 'FMAP_PAL.COL');
  const picker = new ImgFile();
  picker.load(await fetchBytes('TRAV0I01.IMG'), 'TRAV0I01.IMG', palette);
  const [overworld, findAt, filterOn, filterOff, downArrow, upArrow, rightArrow, leftArrow, border] =
    await Promise.all([
      loadImg(deps, 'TRAV0I00.IMG'), loadImg(deps, 'TRAV0I03.IMG'),
      loadImg(deps, 'TRAV01I0.IMG'), loadImg(deps, 'TRAV01I1.IMG'),
      loadImg(deps, 'TRAVAI05.IMG'), loadImg(deps, 'TRAVBI05.IMG'),
      loadImg(deps, 'TRAVCI05.IMG'), loadImg(deps, 'TRAVDI05.IMG'),
      loadImg(deps, 'MBRD00I0.IMG'),
    ]);
  let textRsc = null;
  try { textRsc = new TextRsc().load(await fetchBytes('TEXT.RSC')); } catch { textRsc = null; }
  // The dot colours and the flash colour are FMAP_PAL entries (:253-271).
  const locationPixelColors = LOCATION_PIXEL_COLOR_INDICES.map((i) =>
    packRGBA(fmapPalette.getRed(i), fmapPalette.getGreen(i), fmapPalette.getBlue(i), 255));
  const identifyFlashColor = packRGBA(
    fmapPalette.getRed(IDENTIFY_FLASH_COLOR_INDEX), fmapPalette.getGreen(IDENTIFY_FLASH_COLOR_INDEX),
    fmapPalette.getBlue(IDENTIFY_FLASH_COLOR_INDEX), 255);
  // TO1 (:80-84, :148-158): the mod's two PORTS textures, out of its
  // own vendored folder. They are the only art it ships for this
  // window, and a player without them gets no ports button - which is
  // the mod's own arm too (`TryImportImage` returning false RETURNS
  // from Setup before the button is made, :150-153).
  const [portsOff, portsOn] = await Promise.all([
    loadVendorPng(deps, 'TOportsOff'), loadVendorPng(deps, 'TOportsOn'),
  ]);
  _art = {
    overworld, findAt, filterOn, filterOff, downArrow, upArrow, rightArrow, leftArrow, border,
    portsOff, portsOn,
    pickerBitmap: picker.getDFBitmap(), fmapPalette, textRsc,
    locationPixelColors, identifyFlashColor,
    regionMaps: new Map(),   // lazily filled, DFU's regionTextures
    deps,
  };
  // Neither closes the map. A missing TRAV0I04 costs the popup its
  // frame and nothing else (it draws a flat panel with real rows);
  // a missing PICK00I0 costs the LIST entirely - listPicker refuses
  // to open without its art, so L and a multi-match find become
  // no-ops rather than a half-drawn window. preloadListPickerArt
  // swallows its own failure, which is why it is not caught here.
  await preloadTravelPopUpArt(deps).catch((e) => console.warn('[travelmap] TRAV0I04.IMG unavailable:', e?.message ?? e));
  await preloadTeleportPopUpArt(deps);   // G5: TELE00I0 - its own loader swallows an absent file
  await preloadListPickerArt(deps);
  return _art;
}
export const travelMapArtLoaded = () => !!_art;
/** Tests mount a hand-built bundle through the same door. */
export function _setTravelMapArtForTests(art) { _art = art; }

/** The region page's art, loaded on demand with the FMAP palette
 *  (DFU's UpdateMapTextures cache, :651-666). */
async function loadRegionMap(name) {
  if (!_art) return null;
  if (_art.regionMaps.has(name)) return _art.regionMaps.get(name);
  const img = await loadImg({ ..._art.deps, palette: _art.fmapPalette }, name);
  _art.regionMaps.set(name, img);
  return img;
}

/** checkLocationDiscovered (:1121-1131) - the ONE visibility test: the
 *  runtime store, the BAKED flag, or the reveal cheat. */
export function checkLocationDiscovered(summary) {
  if (!summary) return false;
  return hasDiscoveredLocationId(summary.id) || !!summary.discovered || _revealUndiscoveredLocations;
}

/** CanFindPlace (:1134-1146) - the same test through a NAME, which is
 *  why the journal's find-place gate can ask it: a location the player
 *  has not discovered cannot be found on the map, so the dialog is
 *  never offered for one. */
export function canFindPlace(maps, mapDict, regionName, name) {
  const region = maps?.getRegionByName?.(regionName);
  const index = region?.mapNameLookup?.get(name);
  if (index === undefined || index === null) return false;
  const row = region.mapTable[index];
  const pixel = longitudeLatitudeToMapPixel(row.longitude, row.latitude);
  const summary = locationSummaryAt(mapDict, pixel.x, pixel.y);
  return summary ? checkLocationDiscovered(summary) : false;
}

export class TravelMapWindow {
  /** deps: { maps, mapDict, getPlayerPixel, getClimateIndex, gold,
   *  goldPieces, hasHorse, hasCart, hasShip, diseaseCount,
   *  poisonCount, onTravel, onClose, pick } - plus, SOC6, an optional
   *  `party: () => [{acct, name, px, py, in, loc, online, leader}]`,
   *  read on this window's own cadence and never at open alone.
   *
   *  NO LEGEND HERE, and that is the art's decision rather than one of
   *  ours: TRAV0I00's bottom bar is a baked strip of four filter
   *  buttons, a find button and an exit, with no room and no glyph for
   *  a fifth meaning - which is exactly why the classic map draws the
   *  party as a DOT (the one thing this page can say about a position)
   *  and the enhanced map, which owns its chrome, carries the legend
   *  and the names. */
  constructor(deps = {}) {
    this.deps = deps;
    this.done = false;
    this.isChoiceWindow = true;   // this window reads raw key codes
    // DFU's state (:135-163)
    this.selectedRegion = -1;
    this.mouseOverRegion = -1;
    this.mapIndex = 0;
    this.scale = 1;
    this.zoom = false;
    this.zoomOffset = [0, 0];
    this.zoomPosition = [0, 0];
    this.locationSelected = false;
    this.findingLocation = false;
    this.locationSummary = null;
    this.currentDFRegion = null;
    this.currentDFRegionIndex = -1;
    this.identifying = false;
    this.identifyState = false;
    this.identifyChanges = 0;
    this.identifyLastChangeTime = 0;
    this.filters = travelMapFilters();   // the store, so a filter outlives the window
    this.lastMousePos = [0, 0];
    this.selectedRegionMapNames = getRegionMapNames(this._getPlayerRegion());
    this.borderEnabled = false;
    // sub-windows and boxes, in the order they take input
    this.popUp = null;
    // G5: the TELEPORT popup is its OWN field, and that is DFU's own
    // structure rather than tidiness. CreatePopUpWindow (:1705-1730)
    // keeps the travel popup in the `popUp` FIELD and the teleport
    // popup in a LOCAL - it is pushed on the UI stack and the map
    // never holds it. The port has no UI stack, so the map has to
    // hold its sub-window; putting a teleport popup in `popUp` would
    // hand it to GetTravelMapSaveData, which reads the three travel
    // toggles off whatever is there and would write `undefined` for
    // all three into a quicksave taken with the box open.
    this.telePopUp = null;
    this.picker = null;
    this.top = null;            // 'find' | 'notfound' | 'confirm'
    // G5: teleportationTravel (:148). A ONE-SHOT arm: the guild's
    // teleport service sets it before the map is pushed and DFU
    // clears it in OnPop (:368), so it lasts exactly one visit -
    // closing the map without picking loses it, and the next M press
    // is an ordinary travel map again.
    this.teleportationTravel = false;
    // gotoPlace (:70, :214-217) - the journal's click-through. The
    // place is PENDING, not acted on where it is set: DFU's Update
    // consumes it (:443-455) and DFU's OnPop clears it (:370), so it
    // lasts exactly one visit the way teleportationTravel above does.
    this._gotoPlace = null;
    this.findBox = null;   // CM8: the pushed find box while `top` is 'find'
    this._box = null;
    // the generated textures
    this._dotsKey = null;
    this._outlineKey = null;
    this._identifyKey = null;
    // TO1 (:183-184): with roads integration on, the dots texture is
    // FIVE times the page in each direction, so a map pixel has room
    // for a road crossing it. Allocated only then - 1600x800 of uint32
    // is five megabytes, and a player without the mod pays none of it.
    this._dotsScale = 1;
    this._dotsBuf = new Uint32Array(REGION_W * REGION_H);
    this._outlineBuf = new Uint32Array(REGION_W * REGION_H);
    this._identifyBuf = new Uint32Array(REGION_W * REGION_H);
    this._dotsDirty = true;
    this._identifyDirty = true;
    // SOC6 (Mac: "Party members should be able to be seen on the world
    // map, regardless of their location"): the party's last drawn
    // signature and the seconds left until this window asks the host
    // again. The classic page has no per-frame overlay to hang a marker
    // on, so a member IS a dot in the dots buffer - and a buffer is
    // rebuilt, never nudged, so the rebuild has to be earned: it runs
    // only when a member's pixel, floor, name or presence changed.
    this._partyKey = '';
    this._partyPoll = 0;
    // TO1: Travel Options' own state on this window. `_to` is the mod
    // itself (null when it is off), read ONCE per open the way DFU
    // reads `TravelOptionsMod.Instance` in the constructor
    // (TravelOptionsMapWindow.cs:115-146). `portsFilter` is the mod's
    // own field (:96) and, unlike the four DFU filters, it does NOT
    // outlive the window - the mod's own is an instance field on a
    // window DFU keeps alive, and the port's window is per-open, so
    // this is the one place the two shapes differ and the bible says so.
    this._to = deps.travelOptions?.() ?? null;
    this.portsFilter = false;
    // AUDIT-TO1 G4: :102's `markedLocationId` is a field on the SAME
    // persistent window the eight filters ride, so it outlives an
    // open/close as they do - the whole point of a mark is to steer to
    // it on the junction map AFTER closing the map. It lives in
    // systems/travelMapState.js with the filters; the ports filter
    // remains the one field that does not (departure 6).
    Object.defineProperty(this, 'markedMapId', {
      get: () => travelMapMarkedMapId(),
      set: (v) => setTravelMapMarkedMapId(v),
      enumerable: true,
    });
    this.infoBox = null;            // :109, the I key's box
    this._resumeAsked = false;      // :322-345, the resume prompt, once per open
    this._teleportChargeDone = false;
    this._distance = null;
    this._distanceRegionName = null;
    if (this._to?.settings?.roadsIntegration) {
      this._dotsScale = DOT_SCALE;
      this._dotsBuf = new Uint32Array(REGION_W * DOT_SCALE * REGION_H * DOT_SCALE);
    }
    this._regionMapName = null;   // the page whose art is mounted
    // Setup's tail (:343-347) - identify the player's region.
    this._startIdentify();
    this._updateIdentifyTextureForPlayerRegion();
  }

  // --- properties (:175-207) ---
  get hasMultipleMaps() { return this.selectedRegionMapNames.length > 1; }
  get hasVerticalMaps() { return this.selectedRegionMapNames.length > 2; }
  get regionSelected() { return this.selectedRegion !== -1; }
  get mouseOverRegionValid() { return this.mouseOverRegion !== -1; }
  get mouseOverOtherRegion() { return this.regionSelected && this.selectedRegion !== this.mouseOverRegion; }
  get findingLocationActive() { return this.identifying && this.findingLocation && this.regionSelected; }
  get outlineEnabled() { return getBool('GUI', 'TravelMapLocationsOutline'); }

  _click() { audio.playOneShot(SOUND.ButtonClick, 1); }

  // --- helpers (:1609-1680) ---

  /** GetPlayerRegion (:1609-1618) - DFU's own raw politic read, not
   *  PlayerGPS's patched one. */
  _getPlayerRegion() {
    const maps = this.deps.maps;
    if (!maps) return -1;
    const pos = this.deps.getPlayerPixel();
    const region = maps.getPoliticIndex(pos.x, pos.y) - 128;
    if (region < 0 || region >= maps.regionCount) return -1;
    return region;
  }

  _getRegionName(region) { return REGION_NAMES[region] ?? ''; }

  /** GetLocationNameInCurrentRegion (:1630-1658). The fallback arm
   *  reads locationSummary.MapIndex rather than the argument - DFU's
   *  own quirk, kept. */
  _getLocationNameInCurrentRegion() {
    if (this.currentDFRegionIndex === -1) return '';
    return this.currentDFRegion?.mapNames?.[this.locationSummary?.mapIndex] ?? '';
  }

  /** checkLocationDiscovered (:1121-1131) - the instance door onto the
   *  module member below, which is where the law lives. */
  checkLocationDiscovered(summary) {
    // TO1 (:828-844): with the PORTS filter on, a place without a
    // harbour is not on the map at all - the mod's override answers
    // false before DFU's own discovery test is even reached.
    if (!portsFilterAllows(this.portsFilter, summary?.mapID ?? summary?.mapId)) return false;
    return checkLocationDiscovered(summary);
  }

  /** CanFindPlace (:1134-1146) - likewise. The journal's click-through
   *  asks this question from a host that has no map window open yet, so
   *  the member cannot live only on an instance. */
  canFindPlace(regionName, name) { return canFindPlace(this.deps.maps, this.deps.mapDict, regionName, name); }

  // --- the region page (:651-809) ---

  _updateMapTextures() {
    if (!this.regionSelected) return;
    const mapName = this.selectedRegionMapNames[this.mapIndex];
    this._regionMapName = mapName;
    loadRegionMap(mapName).catch((e) => console.warn(`[travelmap] ${mapName} unavailable:`, e?.message ?? e));
    this._updateMapLocationDotsTexture();
  }

  /** UpdateMapLocationDotsTexture (:673-734). The buffers are built
   *  in DFU's BOTTOM-UP order; the upload flips them. */
  _updateMapLocationDotsTexture() {
    const maps = this.deps.maps;
    if (!maps || !this.regionSelected) return;
    const mapName = this.selectedRegionMapNames[this.mapIndex];
    const origin = OFFSET_LOOKUP[mapName] ?? [0, 0];
    const originX = origin[0], originY = origin[1];
    const width = REGION_W, height = REGION_H;
    const colors = _art?.locationPixelColors ?? [];
    const outline = packRGBA(...DOT_OUTLINE_RGBA);
    const outlineOn = this.outlineEnabled;

    this.scale = getRegionMapScale(this.selectedRegion);
    // TO1 (:579-591): with roads integration on the whole page is drawn
    // by the mod's own routine instead - five texels a map pixel, his
    // roads and tracks as LINES under the dots, and each dot a square
    // sized by its type. Cybiades (region 61) is the mod's own
    // exception (:582) and takes the classic walk: its page is a
    // quarter-scale zoom whose pixel coordinates are not scaled to
    // match, so a five-times buffer would plot it in the wrong place.
    if (this._to?.settings?.roadsIntegration && this.selectedRegion !== 61 && this._dotsScale === DOT_SCALE) {
      this._updateMapLocationDotsWithPaths(originX, originY, width, height, colors, outline, outlineOn);
      this._drawPartyMarks(originX, originY, width, height);
      this._dotsDirty = true;
      return;
    }
    this._dotsBuf.fill(0);
    this._outlineBuf.fill(0);
    // ROADS 13 (the ROADS 7 gap, named three times): THE CLASSIC MAP
    // DRAWS THE NETWORK TOO. Same loop, same texel-to-pixel law
    // (originX + x, originY + y), same "this region only" rule as the
    // dots, written UNDER them so a town's dot stays on top of the road
    // that reaches it. The flags are the shared store's - the enhanced
    // map's two chips flip them and the save carries them - because the
    // classic panel has no native art for two more buttons; a classic
    // player sees roads on and tracks on until the enhanced map says
    // otherwise, which is the same inversion the four DFU filters use.
    const net = this.deps.roads?.() ?? null;
    if (net) {
      const showRoads = !this.filters.roads, showTracks = !this.filters.tracks;
      const showRivers = !!net.water && !this.filters.rivers, showStreams = !!net.water && !this.filters.streams;   // ROADS 24
      const roadPx = packRGBA(OVERWORLD_ROAD[0], OVERWORLD_ROAD[1], OVERWORLD_ROAD[2], 255);
      const trackPx = packRGBA(OVERWORLD_TRACK[0], OVERWORLD_TRACK[1], OVERWORLD_TRACK[2], 255);
      const riverPx = packRGBA(OVERWORLD_RIVER[0], OVERWORLD_RIVER[1], OVERWORLD_RIVER[2], 255);
      const streamPx = packRGBA(OVERWORLD_STREAM[0], OVERWORLD_STREAM[1], OVERWORLD_STREAM[2], 255);
      for (let y = 0; y < height && (showRoads || showTracks || showRivers || showStreams); y++) {
        for (let x = 0; x < width; x++) {
          const px = originX + x, py = originY + y;
          if (px < 0 || py < 0 || px >= MAP_WIDTH || py >= MAP_HEIGHT) continue;
          const i = py * MAP_WIDTH + px;
          const kind = (showRoads && net.roads[i]) ? 2 : ((showTracks && net.tracks[i]) ? 1
            : ((showRivers && net.rivers?.[i]) ? 4 : ((showStreams && net.streams?.[i]) ? 3 : 0)));   // ROADS 24
          if (!kind) continue;
          const offset = Math.trunc((((height - y - 1) * width) + x) * this.scale);
          if (offset >= width * height) continue;
          if (maps.getPoliticIndex(px, py) - 128 !== this.selectedRegion) continue;
          this._dotsBuf[offset] = kind === 2 ? roadPx : kind === 1 ? trackPx : kind === 4 ? riverPx : streamPx;
        }
      }
    }
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        // the `* scale` on the whole offset is DFU's own (:691)
        const offset = Math.trunc((((height - y - 1) * width) + x) * this.scale);
        if (offset >= width * height) continue;
        const sampleRegion = maps.getPoliticIndex(originX + x, originY + y) - 128;
        if (sampleRegion !== this.selectedRegion) continue;
        const summary = locationSummaryAt(this.deps.mapDict, originX + x, originY + y);
        if (!summary) continue;
        if (!this.checkLocationDiscovered(summary)) continue;
        const index = getPixelColorIndex(summary.locationType, this.filters);
        if (index === -1) continue;
        if (outlineOn) this._outlineBuf[offset] = outline;
        this._dotsBuf[offset] = colors[index] ?? 0;
      }
    }
    // SOC6 (Mac: "Party members should be able to be seen on the world
    // map, regardless of their location"): THE PARTY, LAST - over the
    // roads and over the location dots, because a member standing in a
    // town is the thing the player opened the map to find, and a town
    // is on the page whether or not anyone is standing in it.
    //
    // The page's own two laws are kept exactly as the dots above keep
    // them: the texel is `originX + x, originY + y` off OFFSET_LOOKUP,
    // and a pixel whose politic is another province belongs to that
    // province's page, not this one - so a member in Wayrest does not
    // bleed onto Daggerfall's sheet just because the rectangle reaches.
    // Nothing is clamped to the border: a member off this page is
    // simply not on this page, and the region map they ARE on draws
    // them.
    //
    // REGARDLESS OF THEIR LOCATION: `in` is not read here at all. A
    // member in a dungeon or a building carries the PLACE's own pixel
    // (scenes/world.js composePartyPose), so the dot lands on the place
    // - which is the whole of what a 320x160 page can say. The word for
    // which is on the enhanced map's label, where there is room for it.
    this._drawPartyMarks(originX, originY, width, height);
    this._dotsDirty = true;
  }

  /** SOC6's marks, extracted whole when TO1 gave this page a second
   *  walk: both the classic page and the mod's five-texel one end with
   *  the party over everything, and one copy is the port's rule. On the
   *  five-texel page a member fills the same 5x5 cell a small dot does,
   *  so the marker stays the size of the places it stands among. */
  _drawPartyMarks(originX, originY, width, height) {
    const maps = this.deps.maps;
    const outlineOn = this.outlineEnabled;
    const outline = packRGBA(...DOT_OUTLINE_RGBA);
    const sc = this._dotsScale;
    const width5 = width * sc;
    const partyPx = packRGBA(PARTY_DOT_RGB[0], PARTY_DOT_RGB[1], PARTY_DOT_RGB[2], 255);
    const partyOffPx = packRGBA(PARTY_OFFLINE_DOT_RGB[0], PARTY_OFFLINE_DOT_RGB[1], PARTY_OFFLINE_DOT_RGB[2], 255);
    const marks = readPartyMarks(this.deps.party, { width: MAP_WIDTH, height: MAP_HEIGHT });
    this._partyKey = partyMarksKey(marks);
    for (const m of marks) {
      const x = m.px - originX, y = m.py - originY;
      if (x < 0 || y < 0 || x >= width || y >= height) continue;
      if (maps.getPoliticIndex(m.px, m.py) - 128 !== this.selectedRegion) continue;
      const offset = Math.trunc((((height - y - 1) * width) + x) * this.scale);
      if (offset >= width * height) continue;
      if (outlineOn) this._outlineBuf[offset] = outline;
      const px = m.online ? partyPx : partyOffPx;
      if (sc === 1) { this._dotsBuf[offset] = px; continue; }
      const offset5 = Math.trunc((((height - y - 1) * sc * width5) + (x * sc)) * this.scale);
      for (let yy = 1; yy < 4; yy++) for (let xx = 1; xx < 4; xx++) this._dotsBuf[offset5 + (yy * width5) + xx] = px;
    }
  }

  /** TO1: UpdateMapLocationDotsTextureWithPaths (:593-662) - the mod's
   *  own region page. The walk itself is ui/travelMapOptions.js; this
   *  is the window's half: which flags are on, which colours, and the
   *  four reads it hands over. */
  _updateMapLocationDotsWithPaths(originX, originY, width, height, colors, outline, outlineOn) {
    const maps = this.deps.maps;
    const net = this.deps.roads?.() ?? null;
    const s = this._to?.settings ?? {};
    // The four toggles are the port's shared store, inverted as every
    // DFU filter is (TRUE means HIDDEN) - see the ROADS 12 note above.
    // Rivers and streams also need the mod's own EnableWaterways, which
    // is what puts them on its map at all (:126-135).
    const water = !!net?.water && !!s.waterwaysEnabled;
    const showPaths = [!this.filters.roads, !this.filters.tracks,
      water && !this.filters.rivers, water && !this.filters.streams];
    drawRegionPageWithPaths(this._dotsBuf, this._outlineBuf, {
      originX, originY, width, height, scale: this.scale, selectedRegion: this.selectedRegion,
    }, {
      politicAt: (x, y) => maps.getPoliticIndex(x, y),
      summaryAt: (x, y) => locationSummaryAt(this.deps.mapDict, x, y),
      discovered: (summary) => this.checkLocationDiscovered(summary),
      colorIndexOf: (t) => getPixelColorIndex(t, this.filters),
      colors,
      pathsAt: (x, y, type) => {
        if (!net || x < 0 || y < 0 || x >= MAP_WIDTH || y >= MAP_HEIGHT) return 0;
        const arr = [net.roads, net.tracks, net.rivers, net.streams][type];
        return arr ? (arr[y * MAP_WIDTH + x] & 0xff) : 0;
      },
      showPaths,
      onlyLargeDots: !s.variableSizeDots,
      markedMapId: this.markedMapId,
      markColor: s.markLocationColor ?? null,
      outlineOn, outlineColor: outline,
    });
  }

  /** SOC6: the party moves while the page is up, so the page asks the
   *  host for it on a timer and repaints only on a CHANGE. The rebuild
   *  is the whole dots buffer (the buffer's own idiom - the filter
   *  chips pay the same price), which is why the signature gate is not
   *  an optimisation but the design: poses arrive on the hub's timer
   *  whether or not anyone moved, and a page that repainted per pose
   *  would repaint forever. */
  _pollParty(dt) {
    this._partyPoll -= dt;
    if (this._partyPoll > 0) return false;
    this._partyPoll = PARTY_POLL_S;
    if (!this.regionSelected) return false;
    if (partyMarksKey(readPartyMarks(this.deps.party, { width: MAP_WIDTH, height: MAP_HEIGHT })) === this._partyKey) return false;
    this._updateMapLocationDotsTexture();
    return true;
  }

  /** ZoomMapTextures (:736-803) - the crop's ORIGIN; the draw applies
   *  it. startY is bottom-up, exactly as Unity's tex coords are. */
  _zoomMapTextures() {
    if (!this.regionSelected || !this.zoom) { this._updateBorder(); return; }
    const width = REGION_W, height = REGION_H;
    const zoomWidth = width / (ZOOM_FACTOR * 2);
    const zoomHeight = height / (ZOOM_FACTOR * 2);
    let startX = Math.trunc(this.zoomPosition[0] - zoomWidth);
    let startY = Math.trunc(height + (-this.zoomPosition[1] - zoomHeight)) + REGION_PANEL_OFFSET;
    if (startX < 0) startX = 0;
    else if (startX + width / ZOOM_FACTOR >= width) startX = width - width / ZOOM_FACTOR;
    if (startY < 0) startY = 0;
    else if (startY + height / ZOOM_FACTOR >= height) startY = height - height / ZOOM_FACTOR;
    this.zoomOffset = [startX, startY];
    this._updateBorder();
  }

  /** UpdateBorder (:805-809). */
  _updateBorder() { this.borderEnabled = this.regionSelected && !this.zoom; }

  /** UpdateIdentifyTextureForPlayerRegion (:811-857) - the province
   *  shape, filled out of the picker bitmap. */
  _updateIdentifyTextureForPlayerRegion() {
    if (this.regionSelected) return;
    const playerRegion = this._getPlayerRegion();
    if (playerRegion === -1) return;
    this._identifyBuf.fill(0);
    const bmp = _art?.pickerBitmap;
    if (bmp) {
      const width = bmp.width, height = bmp.height;
      const diff = height - REGION_H - REGION_PANEL_OFFSET + 1;
      const flash = _art.identifyFlashColor;
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const srcOffset = y * width + x;
          const dstOffset = ((height - y - diff) * width) + x;
          // C# would throw on the rows above the page; the picker's
          // own top bar is blank, so DFU never reaches them.
          if (dstOffset < 0 || dstOffset >= this._identifyBuf.length) continue;
          if (bmp.data[srcOffset] - 128 === playerRegion) this._identifyBuf[dstOffset] = flash;
        }
      }
    }
    this._identifyDirty = true;
  }

  /** UpdateCrosshair (:859-865). */
  _updateCrosshair() {
    if (this.findingLocationActive) {
      const pos = getPixelFromPixelID(this.locationSummary.id);
      this._updateIdentifyTextureForPosition(pos.x, pos.y, this.locationSummary.regionIndex);
    } else {
      const pos = this.deps.getPlayerPixel();
      this._updateIdentifyTextureForPosition(pos.x, pos.y, this.selectedRegion);
    }
  }

  /** UpdateIdentifyTextureForPosition (:875-916) - the crosshair. */
  _updateIdentifyTextureForPosition(mapPixelX, mapPixelY, regionIndex) {
    if (!this.regionSelected) return;
    if (regionIndex === -1) regionIndex = this._getPlayerRegion();
    this._identifyBuf.fill(0);
    const mapName = this.selectedRegionMapNames[this.mapIndex];
    const origin = OFFSET_LOOKUP[mapName] ?? [0, 0];
    const scale = getRegionMapScale(regionIndex);
    const yAdjust = regionIndex === BETONY_INDEX ? -477 : 0;   // (:889-892)
    const scaledX = Math.trunc((mapPixelX - origin[0]) * scale);
    const scaledY = Math.trunc((mapPixelY - origin[1]) * scale) + REGION_PANEL_OFFSET + yAdjust;
    const width = REGION_W, height = REGION_H;
    const flash = _art?.identifyFlashColor ?? packRGBA(163, 39, 15, 255);
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        if (x === scaledX || y + REGION_PANEL_OFFSET === scaledY) {
          this._identifyBuf[(height - y - 1) * width + x] = flash;
        }
      }
    }
    this._identifyDirty = true;
  }

  // --- the region panel's life (:1072-1119) ---

  /** OpenRegionPanel (:1072-1098). */
  _openRegionPanel(region) {
    this._click();
    const mapNames = getRegionMapNames(region);
    if (!mapNames || mapNames.length === 0) return;
    if (!hasRegionPage(region)) return;   // the pageless regions (see hasRegionPage)
    this.mapIndex = 0;
    this.selectedRegion = region;
    this.selectedRegionMapNames = mapNames;
    this.findingLocation = false;
    this.currentDFRegion = this.deps.maps?.getRegion(region) ?? null;
    this.currentDFRegionIndex = region;
    this._updateMapTextures();
    this._updateBorder();
    this._startIdentify();
    this._updateCrosshair();
  }

  /** CloseRegionPanel (:1100-1119). */
  _closeRegionPanel() {
    this.selectedRegion = -1;
    this.mouseOverRegion = -1;
    this.locationSelected = false;
    this.mapIndex = 0;
    this.zoom = false;
    this._zoomMapTextures();
    this._startIdentify();
    this._updateIdentifyTextureForPlayerRegion();
  }

  /** ActivateTeleportationTravel (:209-212). Called BEFORE the window
   *  is shown; see the one-shot note on the field. */
  activateTeleportationTravel() { this.teleportationTravel = true; }

  /** CloseTravelWindows (:1288-1295). */
  closeTravelWindows(forceClose = false) {
    if (!this.regionSelected || forceClose) {
      this.done = true;
      // OnPop (:365-372) clears the one-shot arm as the window leaves
      // the stack. It matters even though the port mints a fresh
      // window per open: the SAME instance is reachable again while a
      // teleport popup is up over it, and a cancelled popup must not
      // leave the map armed for a destination the player then picks
      // by accident.
      this.teleportationTravel = false;
      this.telePopUp = null;
      this.deps.onClose?.();
    } else this._closeRegionPanel();
  }

  // --- mouse (:1148-1295) ---

  /** GetCoordinates (:1148-1172) - the map pixel under the cursor.
   *  `pos` is the cursor inside the REGION page, so the panel's own
   *  12px offset is already out. */
  _getCoordinates() {
    const mapName = this.selectedRegionMapNames[this.mapIndex];
    const origin = OFFSET_LOOKUP[mapName] ?? [0, 0];
    const height = REGION_H;
    const pos = [this.lastMousePos[0], this.lastMousePos[1] - REGION_PANEL_OFFSET];
    if (this.zoom) {
      const x = Math.floor(pos[0] / ZOOM_FACTOR + this.zoomOffset[0] + origin[0]);
      const diffy = height / ZOOM_FACTOR - pos[1];
      const y = Math.floor(height - pos[1] / ZOOM_FACTOR - this.zoomOffset[1] - diffy + origin[1]);
      return [x, y];
    }
    return [Math.floor(origin[0] + pos[0]), Math.floor(origin[1] + pos[1])];
  }

  /** UpdateMouseOverLocation (:1174-1239). */
  _updateMouseOverLocation() {
    if (!this.regionSelected || this.findingLocationActive) return;
    this.locationSelected = false;
    this.mouseOverRegion = this.selectedRegion;
    const maps = this.deps.maps;
    if (!maps) return;
    if (this.lastMousePos[0] < 0 || this.lastMousePos[0] > REGION_W
      || this.lastMousePos[1] < REGION_PANEL_OFFSET
      || this.lastMousePos[1] > REGION_H + REGION_PANEL_OFFSET) return;

    const scale = getRegionMapScale(this.selectedRegion);
    const coordinates = this._getCoordinates();
    let x = Math.trunc(coordinates[0] / scale);
    let y = Math.trunc(coordinates[1] / scale);

    if (this.selectedRegion === BETONY_INDEX) { x += 60; y += 212; }   // (:1193-1198)
    if (this.selectedRegion === 61) {                                   // Cybiades (:1200-1209)
      let xDiff = x - 440, yDiff = y - 340;
      xDiff = Math.trunc(xDiff / 4); yDiff = Math.trunc(yDiff / 4);
      x = 440 + xDiff; y = 340 + yDiff;
    }

    const sampleRegion = maps.getPoliticIndex(x, y) - 128;
    if (sampleRegion !== this.selectedRegion && sampleRegion >= 0 && sampleRegion < maps.regionCount) {
      this.mouseOverRegion = sampleRegion;
      return;
    }
    const summary = locationSummaryAt(this.deps.mapDict, x, y);
    if (summary && !this.findingLocationActive) {
      this.locationSummary = summary;
      if (summary.mapIndex < 0 || summary.mapIndex >= (this.currentDFRegion?.mapNames?.length ?? 0)) return;
      if (getPixelColorIndex(summary.locationType, this.filters) === -1) return;
      if (!this.checkLocationDiscovered(summary)) return;
      this.locationSelected = true;
    }
  }

  /** UpdateMouseOverRegion (:1241-1273) - the picker bitmap answers
   *  which province the cursor is over. */
  _updateMouseOverRegion() {
    this.mouseOverRegion = -1;
    const bmp = _art?.pickerBitmap;
    const maps = this.deps.maps;
    if (!bmp || !maps) return;
    let x = 0, y = 0;
    if (this.zoom) {
      const c = this._getCoordinates();
      x = Math.trunc(c[0]); y = Math.trunc(c[1]);
    } else {
      x = Math.trunc(this.lastMousePos[0]); y = Math.trunc(this.lastMousePos[1]);
    }
    const offset = y * bmp.width + x;
    if (offset < 0 || offset >= bmp.data.length) return;
    const region = bmp.data[offset] - 128;
    if (region < 0 || region >= maps.regionCount) return;
    this.mouseOverRegion = region;
  }

  /** UpdateRegionLabel (:1275-1286). */
  regionLabelText() {
    if (!this.regionSelected) return this._getRegionName(this.mouseOverRegion);
    if (this.locationSelected) {
      return `${this._getRegionName(this.mouseOverRegion)} : ${this._getLocationNameInCurrentRegion()}`;
    }
    if (this.mouseOverOtherRegion) return `Switch To: ${this._getRegionName(this.mouseOverRegion)} Region`;
    return this._getRegionName(this.mouseOverRegion);
  }

  // --- identify (:1732-1780) ---

  _startIdentify() {
    if (this.identifying) this._stopIdentify(false);
    this.identifying = true;
    this.identifyState = false;
    this.identifyChanges = 0;
    // C# stores 0 and compares against Time.realtimeSinceStartup,
    // which is ALWAYS past 0 + the interval - so the first flash is
    // on the very next frame. Storing 0 against a clock that starts
    // at 0 would hold the first map of a session dark for half a
    // second, so the port stores the same DISTANCE instead.
    this.identifyLastChangeTime = _clock - IDENTIFY_FLASH_INTERVAL;
  }

  _stopIdentify(createPopUp = true) {
    if (this.findingLocationActive && createPopUp) this._createConfirmationPopUp();
    this.identifying = false;
    this.identifyState = false;
    this.identifyChanges = 0;
    this.identifyLastChangeTime = 0;
  }

  _animateIdentify() {
    if (!this.identifying) return;
    const lastIdentifyState = this.identifyState;
    const time = _clock;
    if (time > this.identifyLastChangeTime + IDENTIFY_FLASH_INTERVAL) {
      this.identifyState = !this.identifyState;
      this.identifyLastChangeTime = time;
    }
    if (!lastIdentifyState && this.identifyState) {
      const flashCount = this.locationSelected ? IDENTIFY_FLASH_COUNT_SELECTED : IDENTIFY_FLASH_COUNT;
      if (++this.identifyChanges > flashCount) this._stopIdentify();
    }
  }

  // --- the find flow (:1435-1607) ---

  /** GetCurrentRegionLocalizedMapNames (:1465-1478) - deduped, in
   *  map-table order (the port's names are canonical). */
  _currentRegionMapNames() {
    const names = [];
    const seen = new Set();
    for (const name of this.currentDFRegion?.mapNames ?? []) {
      if (seen.has(name)) continue;
      seen.add(name);
      names.push(name);
    }
    return names;
  }

  _nameIndex(name) { return this.currentDFRegion?.mapNameLookup?.get(name) ?? -1; }

  /** FindLocation (:1483-1531). */
  findLocation(name) {
    const matching = [];
    if (!name) return matching;
    if (this._distanceRegionName !== this.currentDFRegion?.name) {
      this._distanceRegionName = this.currentDFRegion?.name ?? null;
      this._distance = getDaggerfallDistance();
      this._distance.setDictionary(this._currentRegionMapNames());
    }
    const bestMatches = this._distance.findBestMatches(name, MAX_MATCHING_RESULTS);
    let cutoff = null;
    for (const match of bestMatches) {
      const index = this._nameIndex(match.text);
      if (index < 0) continue;
      const row = this.currentDFRegion.mapTable[index];
      const pos = longitudeLatitudeToMapPixel(row.longitude, row.latitude);
      const summary = locationSummaryAt(this.deps.mapDict, pos.x, pos.y);
      if (!summary) continue;
      if (!this.checkLocationDiscovered(summary)) continue;
      if (cutoff === null) {
        cutoff = new MatchesCutOff(match.relevance);
        // the first result stands in when the picker is skipped
        this.locationSummary = summary;
      } else if (!cutoff.keep(match.relevance)) break;
      matching.push(match);
    }
    return matching;
  }

  /** HandleLocationFindEvent (:1435-1459). */
  _handleLocationFindEvent(locationName) {
    const matching = this.findLocation(locationName);
    if (matching.length === 0) { this.top = 'notfound'; return; }
    if (matching.length === 1) {
      this.locationSelected = true;
      this.findingLocation = true;
      this._startIdentify();
      this._updateCrosshair();
      return;
    }
    this._showLocationPicker(matching.map((m) => m.text), false);
  }

  /** ShowLocationPicker (:1578-1597). */
  _showLocationPicker(locations, applyFilters) {
    const filtered = [];
    for (const name of locations) {
      if (applyFilters) {
        const index = this._nameIndex(name);
        if (index < 0) continue;
        if (getPixelColorIndex(this.currentDFRegion.mapTable[index].locationType, this.filters) === -1) continue;
      }
      filtered.push(name);
    }
    // ShowLocationPicker pushes the picker over THIS window, and a
    // DaggerfallPopupWindow does not dim what it covers - the map
    // stays visible behind the list.
    if (!listPickerArtLoaded()) return;   // no PICK00I0, no list (listPicker.js's own law)
    this.picker = new ListPickerWindow({
      items: filtered,
      backdrop: 'none',
      onPick: (index, name) => this.handleLocationPickEvent(index, name),
      onCancel: () => { this.picker = null; },
    });
  }

  /** HandleLocationPickEvent (:1599-1607) - the picker pops, then
   *  the pick runs the find. */
  handleLocationPickEvent(index, locationName) {
    if (!this.regionSelected || (this.currentDFRegion?.locationCount ?? 0) < 1) return;
    this.picker = null;
    this._handleLocationFindEvent(locationName);
  }

  /** CreateConfirmationPopUp (:1682-1703) - TEXT.RSC 31 with %tcn
   *  swapped for the place's name. */
  _createConfirmationPopUp() {
    if (!this.locationSelected) return;
    this.top = 'confirm';
  }

  _confirmRows() {
    const name = this._getLocationNameInCurrentRegion();
    const rows = _art?.textRsc?.linesById?.(31) ?? [{ text: 'Do you wish to travel to %tcn?', center: true }];
    return rows.map((r) => {
      const text = (typeof r === 'string' ? r : r.text ?? '').replace('%tcn', name);
      return typeof r === 'string' ? text : { ...r, text };
    });
  }

  /** CreatePopUpWindow (:1705-1730). TWO popups, one pick: the
   *  teleport arm takes the same destination and skips the journey
   *  entirely - see ui/teleportPopUp.js. */
  _createPopUpWindow() {
    const pos = getPixelFromPixelID(this.locationSummary.id);
    if (this.teleportationTravel) {
      const name = this._getLocationNameInCurrentRegion();
      this.telePopUp = new TeleportPopUpWindow({ pixel: pos, name }, {
        onExit: () => { this.telePopUp = null; },
        onTeleport: (pixel, destName) => {
          this.telePopUp = null;
          this.deps.onTeleport?.({
            pixel,
            name: destName,
            region: this._getRegionName(this.locationSummary.regionIndex),
            mapId: this.locationSummary.mapID,
            regionIndex: this.locationSummary.regionIndex,
            locationIndex: this.locationSummary.mapIndex,
          });
          this.closeTravelWindows(true);
        },
      });
      return;
    }
    this.popUp = new TravelPopUpWindow(pos, {
      // TravelTimeCalculator.cs:163's Knightly Order consult, the
      // host's online word, TP1's entity for GuildManager.FastTravel
      // and TO1's mod handle all ride in the one shared bag
      // (_popUpDeps), so this popup and the coordinates one cannot drift.
      ...this._popUpDeps(),
      onExit: () => { this._rememberPopUpState(); this.popUp = null; },
      onTravel: (endPos, opts, computed) => {
        this._rememberPopUpState();
        this.popUp = null;
        this.deps.onTravel?.({
          pixel: endPos,
          name: this._getLocationNameInCurrentRegion(),
          region: this._getRegionName(this.locationSummary.regionIndex),
          mapId: this.locationSummary.mapID,
          regionIndex: this.locationSummary.regionIndex,
          locationIndex: this.locationSummary.mapIndex,
        }, opts, computed);
        this.closeTravelWindows(true);
      },
    });
    // The three toggles DFU's persistent popup would still be
    // holding (SetTravelMapFromSaveData's half, :1325-1336).
    Object.assign(this.popUp, travelMapPopUpState());
    // AUDIT-TO1 D2: ...and THEN the mod's OnPush guard (TravelOptionsPopUp.cs
    // :53-67), which was ported and never called: with the ports
    // restriction on, a trip that cannot sail does not START on the
    // ship toggle. Every popup opened on SHIP before this.
    this.popUp.enforceShipRestriction();
    this.popUp.refresh();
  }

  /** TO1 (:505-530 and TravelOptionsPopUp.cs:151-163): the popup on
   *  BARE COORDINATES. The pixel is the one under the cursor
   *  (GetClickMPCoords, which is this window's own `_getCoordinates`
   *  divided by the region's scale with the same Betony and Cybiades
   *  fixups - :552-577 is `_updateMouseOverLocation`'s arithmetic, and
   *  the port has it once, so this reads it rather than repeating it).
   *  The journey is the mod's, always: a place with no name cannot be
   *  fast-travelled to, so `CallFastTravelGoldCheck`'s first arm goes
   *  straight to BeginTravelToCoords. */
  _createCoordsPopUpWindow() {
    const pos = this._mapPixelUnderCursor();
    if (!pos) return;
    this.popUp = new TravelPopUpWindow(pos, {
      ...this._popUpDeps(),
      coordsOnly: true,
      onExit: () => { this._rememberPopUpState(); this.popUp = null; },
      onTravel: (endPos, opts) => {
        this._rememberPopUpState();
        this.popUp = null;
        this.deps.onTravelToCoords?.({ pixel: endPos, name: toFormat(TO_TEXT.MsgTargetCoords, endPos.x, endPos.y) }, opts);
        this.closeTravelWindows(true);
      },
    });
    Object.assign(this.popUp, travelMapPopUpState());
    this.popUp.enforceShipRestriction();   // AUDIT-TO1 D2: OnPush's guard, here too
    this.popUp.refresh();
  }

  /** The cursor's map pixel, in the same two steps
   *  `_updateMouseOverLocation` takes: the page coordinates, then the
   *  region's scale and its two fixups. */
  _mapPixelUnderCursor() {
    if (!this.regionSelected) return null;
    const scale = getRegionMapScale(this.selectedRegion);
    const c = this._getCoordinates();
    let x = Math.trunc(c[0] / scale);
    let y = Math.trunc(c[1] / scale);
    if (this.selectedRegion === BETONY_INDEX) { x += 60; y += 212; }
    if (this.selectedRegion === 61) {
      const xDiff = Math.trunc((x - 440) / 4), yDiff = Math.trunc((y - 340) / 4);
      x = 440 + xDiff; y = 340 + yDiff;
    }
    if (x < 0 || y < 0 || x >= MAP_WIDTH || y >= MAP_HEIGHT) return null;
    return { x, y };
  }

  /** TO1 (:199-220): where the ports button and the two arrows sit on
   *  this page. The ports button shows only while the mod restricts
   *  ship travel to ports (:148); the shuffle happens whenever either
   *  arrow is enabled, which is the mod's own condition. */
  _portsBar() {
    const portsShown = !!this._to?.settings?.shipTravelPortsOnly;
    const paging = this.regionSelected && (this.hasMultipleMaps || this.hasVerticalMaps);
    const anchors = portsBarAnchors(portsShown && paging);
    return { ...anchors, portsShown };
  }

  /** TO1 (:532-550), MarkLocationHandler - the MIDDLE click marks the
   *  location under the cursor, or clears the mark when it is already
   *  this one. The ring is drawn by the five-texel page (drawLocation's
   *  `highlight`), so on a classic page the mark is remembered and not
   *  seen, which is what the mod does without its roads integration. */
  _markLocationHandler() {
    if (!(this.regionSelected && this.locationSelected && !this.mouseOverOtherRegion)) return;
    const id = this.locationSummary?.mapID ?? this.locationSummary?.mapId ?? -1;
    this.markedMapId = this.markedMapId === id ? -1 : id;
    this._updateMapLocationDotsTexture();
  }

  /** TO1 (:374-464), DisplayLocationInfo - the I key over a selected
   *  place. The rows are ui/travelMapOptions.js's; this holds the box. */
  _displayLocationInfo() {
    if (!this.locationSelected || this.infoBox) return;
    const summary = this.locationSummary;
    const info = locationInfoRows(summary?.locationType,
      this.deps.discoveredBuildings?.(summary) ?? null,
      (t) => this.deps.buildingTypeName?.(t) ?? String(t));
    const title = this._getLocationNameInCurrentRegion();
    if (!info) {
      this.infoBox = { rows: [{ text: toFormat(TO_TEXT.MsgNoKnowledge, title), center: true }], anywhere: true };
      return;
    }
    const rows = [{ text: title, center: true, highlight: true }, { text: '', center: true }];
    if (info.guilds) rows.push({ text: info.guilds, center: false });
    // :437-441 - two columns, on the mod's own three tab stops
    for (let i = 0; i < info.rows.length; i += 2) {
      const a = info.rows[i], b = info.rows[i + 1];
      const left = `${a.name}${' '.repeat(Math.max(1, 14 - a.name.length))}${a.count}`;
      rows.push({ text: b ? `${left}   ${b.name}${' '.repeat(Math.max(1, 14 - b.name.length))}${b.count}` : left, center: false });
    }
    this.infoBox = { rows, anywhere: true, tabs: INFO_TABS };
  }

  /** The popup's dep bag, shared by the location popup and the
   *  coordinates one so the two cannot drift. */
  _popUpDeps() {
    return {
      getPlayerPixel: this.deps.getPlayerPixel,
      getClimateIndex: this.deps.getClimateIndex,
      gold: this.deps.gold,
      goldPieces: this.deps.goldPieces,
      hasHorse: this.deps.hasHorse,
      hasCart: this.deps.hasCart,
      hasShip: this.deps.hasShip,
      freeTavernRooms: this.deps.freeTavernRooms,
      noWorldTime: this.deps.noWorldTime,
      diseaseCount: this.deps.diseaseCount,
      poisonCount: this.deps.poisonCount,
      textRsc: _art?.textRsc ?? null,
      pick: this.deps.pick,
      playerEntity: this.deps.playerEntity,
      travelOptions: this.deps.travelOptions,
      locationSummary: () => this.locationSummary,
      // AUDIT-TO1 D1: TravelOptionsPopUp.cs:85-94 read PlayerGPS.CurrentLocation
      // and TransportManager.IsOnShip - neither was ever handed over, so
      // IsNotAtPort answered TRUE in every one of the 378 harbours and
      // the ship button refused at Daggerfall's own quay.
      currentLocationMapId: this.deps.currentLocationMapId,
      isOnShip: this.deps.isOnShip,
      // AUDIT-TO1 I5: the popup's own I (:69-80) - the map draws the box
      // ABOVE the popup (see draw / input / click below).
      displayLocationInfo: () => this._displayLocationInfo(),
    };
  }

  /** The popup is minted per trip here where DFU keeps one; its three
   *  toggles go back to the module store as it closes. */
  _rememberPopUpState() {
    if (!this.popUp) return;
    setTravelMapPopUpState(this.popUp);
  }

  // --- the save envelope (:1324-1363) ---

  getTravelMapSaveData() { return travelMapSaveData(this.popUp); }

  /** SetTravelMapFromSaveData (:1342-1363) - a NULL envelope means
   *  the struct's defaults, which is how a pre-U41 save loads. */
  setTravelMapFromSaveData(data) {
    this.filters = restoreTravelMapSaveData(data);
    if (this.popUp) Object.assign(this.popUp, travelMapPopUpState());
    if (this.regionSelected) this._updateMapLocationDotsTexture();
  }

  // --- event handlers (:918-1070) ---

  /** ClickHandler (:918-946). */
  _clickHandler(vx, vy) {
    const y = vy - REGION_PANEL_OFFSET;
    if (vx < 0 || vx > REGION_W || y < 0 || y > REGION_H) return;
    // TO1 (:505-530), ClickHandler's own first arm: with
    // AllowTargetingMapCoordinates set, a click on an EMPTY map pixel
    // inside an open region opens the travel popup on those bare
    // coordinates - a journey to a place with no name. The mod runs its
    // own bounds check in the region texture's own coordinates, which
    // is the `y` above, and falls through to DFU's handler otherwise.
    // AUDIT-TO1 I4: ...and only where the host can HONOUR it. A bare
    // pixel has no DFU fast travel to fall back on, so the online lane
    // (which stands the journey down) must not open a popup that
    // promises an arrival and then does nothing (`coordsAllowed`).
    if (this._to?.settings?.targetCoordsAllowed && (this.deps.coordsAllowed?.() ?? true)
      && this.regionSelected && !this.locationSelected && !this.mouseOverOtherRegion) {
      this._createCoordsPopUpWindow();
      return;
    }
    if (!this.regionSelected) {
      if (this.mouseOverRegionValid) this._openRegionPanel(this.mouseOverRegion);
    } else if (this.locationSelected) {
      if (this.findingLocationActive) this._stopIdentify(true);
      else this._createPopUpWindow();
    } else if (this.mouseOverOtherRegion) {
      this._openRegionPanel(this.mouseOverRegion);
    }
  }

  /** AtButtonClickHandler (:951-957). On the province map
   *  UpdateCrosshair falls straight back out (:875-878), so I'M AT
   *  there re-flashes the region shape CloseRegionPanel already
   *  built rather than rebuilding it - DFU's own shape, kept. */
  _atButtonClick() {
    this.findingLocation = false;
    this._startIdentify();
    this._updateCrosshair();
  }

  /** FindlocationButtonClickHandler (:959-975) - the input box. */
  _findLocationButtonClick() {
    if (!this.regionSelected) return;
    this._click();
    // `new DaggerfallInputMessageBox(uiManager, null, findLocationPrompt,
    // ...)` (:965), 32 characters (:968). CM8: pushed; `top` stays 'find'
    // so the map under it neither hovers nor scrolls, as under any box.
    this.top = 'find';
    this.findBox = new InputMessageBoxWindow({
      label: FIND_PROMPT,
      value: '',
      maxCharacters: FIND_MAX_CHARACTERS,
      onSubmit: (text) => { this.top = null; this._handleLocationFindEvent(text); },
      onCancel: () => { this.top = null; },
    });
  }

  /** ArrowButtonClickHandler (:990-1022). */
  _arrowButtonClick(which) {
    if (!this.regionSelected || !this.hasMultipleMaps) return;
    let newIndex = this.mapIndex;
    if (which === 'horizontal') newIndex += (newIndex % 2 === 0) ? 1 : -1;
    else if (which === 'vertical') newIndex += (newIndex > 1) ? -2 : 2;
    else return;
    this.mapIndex = newIndex;
    this._updateMapTextures();
    this._updateCrosshair();
  }

  /** FilterButtonClickHandler (:1024-1070). */
  _filterButtonClick(which) {
    if (!(which in this.filters)) return;
    this.filters[which] = !this.filters[which];
    this._updateMapLocationDotsTexture();
  }

  // --- the host seam ---

  /** D4: THE KEY-UP EDGE. A DFU Button with an OnKeyboardEvent handler
   *  is raised on BOTH edges of its Hotkey (Button.cs:79-92), and this
   *  window's travel popup is the one place in the port that needs the
   *  release: EXIT plays its click on the press and pops on the
   *  release (DaggerfallTravelPopUp.cs:482-495). Routed exactly like
   *  `input` above - to whichever sub-window owns the keyboard - and
   *  nothing else on this map reads a key-up, so the map's own arms
   *  answer nothing rather than mirroring the ladder. */
  keyup(code, e = null) {
    if (this.telePopUp) {
      this.telePopUp.keyup?.(code, e);
      if (this.telePopUp?.done) this.telePopUp = null;
      return;
    }
    if (this.popUp) {
      this.popUp.keyup?.(code, e);
      if (this.popUp?.done) this.popUp = null;
    }
  }

  input(code, e = null) {
    if (this.telePopUp) {
      this.telePopUp.input(code, e);
      if (this.telePopUp?.done) this.telePopUp = null;
      return;
    }
    // AUDIT-TO1 I5: the info box the popup's own I raised is dismissed
    // ABOVE the popup (ClickAnywhereToClose), or it could never go.
    if (this.popUp && this.infoBox) { this.infoBox = null; return; }
    if (this.popUp) {
      this.popUp.input(code, e);
      if (this.popUp?.done) this.popUp = null;
      return;
    }
    if (this.picker) {
      this.picker.input(code, e);
      if (this.picker?.done) this.picker = null;
      return;
    }
    if (this.top === 'find') {
      // the pushed box owns the keyboard: its Return runs the find, its
      // Escape closes it, both through the box (HandleLocationFindEvent :1435)
      const box = this.findBox;
      box?.input(code, e);
      if (box?.done && this.findBox === box) this.findBox = null;
      return;
    }
    if (this.top === 'notfound') { this.top = null; return; }     // ClickAnywhereToClose
    if (this.top === 'confirm') {
      // ConfirmTravelPopupButtonClick (:977-988)
      if (code === 'KeyY') { this._click(); this.top = null; this._createPopUpWindow(); return; }
      if (code === 'KeyN' || code === 'Escape') { this._click(); this.top = null; this._stopIdentify(); }
      return;
    }
    // TO1 (:330-344): YES resumes the journey and CLOSES the map twice
    // over - the mod calls CloseWindow before the branch and again
    // inside it, which is what takes the player straight back to the
    // world rather than to the region page.
    if (this.top === 'resume') {
      if (code === 'KeyY') { this._click(); this.top = null; this.deps.onResumeTravel?.(); this.closeTravelWindows(true); return; }
      // AUDIT-TO1 G3 (:334-343): the handler's first CloseWindow pops the
      // BOX and the second, inside the Yes branch alone, pops the map -
      // so No leaves the player ON the map to pick somewhere else. The
      // port closed the whole map on No, and because the window is
      // per-open the prompt came straight back on the next M: no way
      // onto the map while a destination was pending short of resuming
      // the journey just declined.
      if (code === 'KeyN' || code === 'Escape') { this._click(); this.top = null; }
      return;
    }
    // TO1 (:477-497): the teleport fee. Yes pays it, No closes the map.
    if (this.top === 'teleportcost') {
      if (code === 'KeyY') { this._click(); this.top = null; this.deps.payTeleport?.(this._teleportCost ?? 0); return; }
      if (code === 'KeyN' || code === 'Escape') { this._click(); this.top = null; this.closeTravelWindows(true); }
      return;
    }
    if (this.top === 'teleportpoor') { this.top = null; this.closeTravelWindows(true); return; }
    // TO1 (:348-370), Update's own two keys. The info box is
    // ClickAnywhereToClose, so ANY key closes it and nothing else
    // happens that frame (:451-453, `infoBox.ClickAnywhereToClose`).
    if (this.infoBox) { this.infoBox = null; return; }
    if (this._to) {
      // :360-366 - I over a selected place; the mod guards on
      // `infoBox == null`, which the arm above has just made true.
      if (code === 'KeyI' && this.locationSelected) { this._displayLocationInfo(); return; }
      // :367-370 - H anywhere on the map opens the mod's help.
      // AUDIT-TO1 H1: the help in this window's own box (the I key's slot),
    // one row per line as DisplayHelpInfo's Split('\n') gives it.
    if (code === 'KeyH') {
      const rows = this.deps.helpRows?.();
      if (rows?.length) this.infoBox = { rows: rows.map((t) => ({ text: t, center: false })), anywhere: true };
      else this.deps.onHelp?.();
      return;
    }
    }
    // Update's own keys (:378-425)
    // Update's toggle-closed binding and the back button (:376-386)
    if (code === 'Escape' || codeMeans(bindings(), code, 'TravelMap')) {
      this.closeTravelWindows();
      return;
    }
    if (this.regionSelected) {
      // AUDIT 64 F23 - Update (:418, :427) asks the SHORTCUT TABLE, not
      // a key code: `DaggerfallShortcut.GetBinding(Buttons.TravelMapList)
      // .IsUpWith(keyModifiers)` and the same for TravelMapFind, with
      // keyModifiers taken at :388. IsUpWith (HotkeySequence.cs:169-172)
      // is the binding's key AND CheckSetModifiers, whose second clause
      // rejects any virtual modifier the sequence did not ask for - and
      // both rows are bare F/L (DialogShortcuts.txt:81-82), so Ctrl+L
      // and Shift+F do NOTHING in DFU. Shift is not hypothetical here:
      // it is the held key that scrolls a zoomed region map (:397-402,
      // `hover` below). The two rows already existed in the port's
      // table (systems/dialogShortcuts.js) and nothing read them.
      //
      // Order is DFU's if / else-if: List is asked before Find, and
      // firstHotkey walks the array in that order.
      switch (firstHotkey(['TravelMapList', 'TravelMapFind'], code, e)) {
        case 'TravelMapList':
          if ((this.currentDFRegion?.locationCount ?? 0) < 1) return;   // (:420-421)
          // OrderBy(p => p) (:424-425) - ordinal here, see the header
          this._showLocationPicker(this._currentRegionMapNames().sort(), true);
          return;
        case 'TravelMapFind':
          this._findLocationButtonClick();   // (:427-428)
          return;
        default:
          // DFU's region branch never reaches the Return/KeypadEnter arm
          // (:430-434), so every other key is swallowed here.
          return;
      }
    }
    if (code === 'Enter' || code === 'NumpadEnter') {
      if (this.identifying) this._openRegionPanel(this._getPlayerRegion());
    }
  }

  /** ROAD-E E1: the release edge, forwarded to the teleport list the
   *  way `hover` is - the thumb latches on the press, and until the
   *  hosts routed pointer UP nothing dropped it but the next move. */
  release() { this.picker?.release(); }

  hover(vx, vy, e = null) {
    if (this.telePopUp) return;   // a yes/no box has nothing to hover
    if (this.popUp) { this.popUp.hover(vx, vy); return; }
    if (this.picker) { this.picker.hover(vx, vy, e); return; }   // ROAD-A7: the teleport list's own hover
    if (this.top) return;
    if (vx === this.lastMousePos[0] && vy === this.lastMousePos[1]) return;
    this.lastMousePos = [vx, vy];
    if (this.regionSelected) this._updateMouseOverLocation();
    else this._updateMouseOverRegion();
    // Scrolling while zoomed (:397-402)
    if (this.regionSelected && this.zoom && e?.shiftKey && vx >= 0 && vy >= 0) {
      this.zoomPosition = [vx, vy];
      this._zoomMapTextures();
    }
  }

  click(vx, vy, right = false, middle = false) {
    // TO1 (:539, NativePanel.OnMiddleMouseClick += MarkLocationHandler):
    // the middle button marks the place under the cursor and does
    // nothing else - it never reaches a sub-window or the bar.
    if (middle) {
      this.lastMousePos = [vx, vy];
      if (this.regionSelected) this._updateMouseOverLocation();
      this._markLocationHandler();
      return true;
    }
    if (this.telePopUp) {
      this.telePopUp.click(vx, vy);
      if (this.telePopUp?.done) this.telePopUp = null;
      return true;
    }
    if (this.popUp && this.infoBox) { this.infoBox = null; return true; }   // AUDIT-TO1 I5
    if (this.popUp) {
      this.popUp.click(vx, vy);
      if (this.popUp?.done) this.popUp = null;
      return true;
    }
    if (this.picker) {
      this.picker.click(vx, vy, this._font);
      if (this.picker?.done) this.picker = null;
      return true;
    }
    if (this.top === 'confirm' || this.top === 'resume' || this.top === 'teleportcost') {
      const hit = this._box ? messageBoxHit(this._box, vx, vy) : null;
      if (hit === MB_BUTTONS.Yes) this.input('KeyY');
      else if (hit === MB_BUTTONS.No) this.input('KeyN');
      return true;
    }
    // TO1: the two ClickAnywhereToClose boxes - the mod's own info box
    // (:449) and the "not enough gold" (:500).
    if (this.top === 'teleportpoor') { this.input('KeyN'); return true; }
    if (this.infoBox) { this.infoBox = null; return true; }
    // TEXT.RSC 13 is ClickAnywhereToClose (:1454); the find box is a
    // FIELD and answers only Return and Escape.
    if (this.top === 'notfound') { this.top = null; return true; }
    if (this.top) return true;
    if (right) {
      // Zoom to mouse position (:388-395)
      if (this.regionSelected) {
        this.zoomPosition = [vx, vy];
        this.zoom = !this.zoom;
        this._zoomMapTextures();
      }
      return true;
    }
    // the bottom bar first, then the map surface
    if (inRect(BUTTON_RECTS.exit, vx, vy)) { this._click(); this.closeTravelWindows(); return true; }
    if (this.regionSelected && inRect(BUTTON_RECTS.find, vx, vy)) { this._findLocationButtonClick(); return true; }
    if (inRect(BUTTON_RECTS.at, vx, vy)) { this._atButtonClick(); return true; }
    for (const which of ['dungeons', 'temples', 'homes', 'towns']) {
      if (inRect(BUTTON_RECTS[which], vx, vy)) { this._filterButtonClick(which); return true; }
    }
    // Both arrow buttons are created Enabled=false and are turned on
    // only by SetupArrowButtons, which no province map ever calls -
    // so on the province map they neither draw nor take a click, even
    // when the player's own region happens to page (:511, :519,
    // :529-549, :1111-1112).
    {
      const bar = this._portsBar();
      // TO1 (:191-197): the ports filter, hit-tested BEFORE the arrows
      // because it may be sitting on top of where they were.
      if (bar.portsShown && inRect([bar.ports[0], bar.ports[1], PORTS_SIZE[0], PORTS_SIZE[1]], vx, vy)) {
        this._click();
        this.portsFilter = !this.portsFilter;
        this._updateMapLocationDotsTexture();
        return true;
      }
      const [, , hw, hh] = BUTTON_RECTS.horizontalArrow;
      const [, , vw, vh] = BUTTON_RECTS.verticalArrow;
      if (this.regionSelected && this.hasMultipleMaps && inRect([bar.horizontalArrow[0], bar.horizontalArrow[1], hw, hh], vx, vy)) { this._arrowButtonClick('horizontal'); return true; }
      if (this.regionSelected && this.hasVerticalMaps && inRect([bar.verticalArrow[0], bar.verticalArrow[1], vw, vh], vx, vy)) { this._arrowButtonClick('vertical'); return true; }
    }
    // A click lands where the cursor is: keep the hover state honest
    // for hosts that never send a move (touch).
    this.lastMousePos = [vx, vy];
    if (this.regionSelected) this._updateMouseOverLocation();
    else this._updateMouseOverRegion();
    this._clickHandler(vx, vy);
    return true;
  }

  /** The wheel belongs to whatever is on top: the picker scrolls, the
   *  popup's option pairs toggle under the cursor. */
  wheel(dir) {
    if (this.popUp) { this.popUp.wheel(dir); return; }
    this.picker?.wheel?.(dir);
  }

  /** GotoPlace (:214-217). The journal hands the map a quest Place and
   *  posts the open message; the map opens ALREADY on that region with
   *  the find already run, which is what makes the click-through feel
   *  like one action rather than two. */
  gotoPlace(place) { this._gotoPlace = place ?? null; }

  tick(dt) {
    // TO1 (:322-345), OnPush's own tail. The map opens either ON the
    // player's region, because a journey is running and the player is
    // steering it, or on a YES/NO asking whether to take the active
    // destination up again. Once per open: the mod does it in OnPush
    // and the port's window is per-open, so the first tick is that
    // moment. It is a tick rather than the constructor because the box
    // wants the window drawn underneath it, which is the same reason
    // the mod moved its own teleport charge out of OnPush (:352-355).
    if (!this._resumeAsked) {
      this._resumeAsked = true;
      if (this._to) {
        if (this._to.isTravelActive) this._openRegionPanel(this._getPlayerRegion());
        else if (this._to.destinationName) { this.top = 'resume'; }
      }
    }
    // TO1 (:352-355, :470-503): the teleport charge, once, and only
    // for a teleport visit with the paid service on.
    if (!this._teleportChargeDone && this.teleportationTravel && this._to?.settings?.teleportCost) {
      this._teleportChargeDone = true;
      const cost = teleportCost(this.deps.magesGuildRank?.() ?? 0);
      if (cost > 0) {
        this._teleportCost = cost;
        this.top = (this.deps.gold?.() ?? 0) >= cost ? 'teleportcost' : 'teleportpoor';
      }
    }
    // :443-455 - DFU runs this at the tail of Update, unconditionally.
    // The only setter is GotoPlace, which fires before this window is
    // ever shown, so it is consumed on the first tick either way.
    if (this._gotoPlace) {
      const site = this._gotoPlace.siteDetails ?? {};
      this._gotoPlace = null;
      // The legacy-save workaround, and it is the map's as much as the
      // journal's - both call it on the same SiteDetails (:450).
      this.mouseOverRegion = patchRegionIndex(site.regionIndex ?? 0, site.regionName ?? '');
      this._openRegionPanel(this.mouseOverRegion);
      this._handleLocationFindEvent(site.locationName ?? '');
    }
    // SOC6: ABOVE the sub-window returns. A popup, a box or the picker
    // freezes the map's own animation (DFU's "only the top window
    // updates"), but the party is not this window's animation - it is
    // another player walking - and the page behind the box must still
    // be right when the box comes down.
    this._pollParty(dt);
    if (this.popUp) {
      this.popUp.tick(dt);
      if (this.popUp?.done) this.popUp = null;
      return;
    }
    // DFU's UI manager updates only the TOP window, so the flash is
    // frozen while a box or the picker is up - and that is what keeps
    // an ending flash from creating a confirmation UNDER them.
    if (this.top || this.picker) return;
    _clock += dt;
    this._animateIdentify();
  }

  dispose() {
    const r = this._renderer;
    if (!r) return;
    for (const key of [this._dotsKey, this._outlineKey, this._identifyKey]) {
      if (key) r.releaseTexture('travelmap', key);
    }
    this._dotsKey = this._outlineKey = this._identifyKey = null;
  }

  /** One generated buffer to a texture: DFU's bottom-up buffer
   *  flipped into the port's top-down upload, under a versioned key
   *  the dispose releases. */
  _upload(renderer, kind, buf, w = REGION_W, h = REGION_H) {
    const flipped = new Uint32Array(w * h);
    for (let y = 0; y < h; y++) {
      flipped.set(buf.subarray((h - y - 1) * w, (h - y) * w), y * w);
    }
    const key = `${kind}-${++_texVer}`;
    const tex = renderer.uploadTexture('travelmap', key, { width: w, height: h, colors: flipped });
    return { key, tex };
  }

  _ensureTextures(renderer) {
    this._renderer = renderer;
    if (this._dotsDirty) {
      const prevDots = this._dotsKey, prevOutline = this._outlineKey;
      const dots = this._upload(renderer, 'dots', this._dotsBuf, REGION_W * this._dotsScale, REGION_H * this._dotsScale);   // TO1: five times the page with roads integration on
      const outline = this._upload(renderer, 'outline', this._outlineBuf);
      this._dotsKey = dots.key; this._dotsTex = dots.tex;
      this._outlineKey = outline.key; this._outlineTex = outline.tex;
      if (prevDots) renderer.releaseTexture('travelmap', prevDots);
      if (prevOutline) renderer.releaseTexture('travelmap', prevOutline);
      this._dotsDirty = false;
    }
    if (this._identifyDirty) {
      const prev = this._identifyKey;
      const id = this._upload(renderer, 'identify', this._identifyBuf);
      this._identifyKey = id.key; this._identifyTex = id.tex;
      if (prev) renderer.releaseTexture('travelmap', prev);
      this._identifyDirty = false;
    }
  }

  /** The zoom crop as a TOP-DOWN source rect on a texture of the
   *  given size (DFU's BackgroundCroppedRect, whose y is bottom-up). */
  _cropRect(texW, texH, dx = 0, dy = 0) {
    const ratioX = texW / REGION_W, ratioY = texH / REGION_H;
    const sw = (REGION_W / ZOOM_FACTOR) * ratioX;
    const sh = (REGION_H / ZOOM_FACTOR) * ratioY;
    // The outline copies displace the CROP as well as the panel
    // (:784-792), which the 2x zoom then magnifies - that is why the
    // outline thickens when you zoom in rather than thinning. dx/dy
    // arrive in classic (320x160) pixels, DFU's own units there.
    const sx = (this.zoomOffset[0] + dx) * ratioX;
    const sy = texH - ((this.zoomOffset[1] + dy) * ratioY + sh);
    return [sx, sy, sw, sh];
  }

  _drawPage(renderer, m, tex, texW, texH, dx, dy, opts = {}) {
    const dst = { x: m.ox + (REGION_RECT[0] + dx) * m.s, y: m.oy + (REGION_RECT[1] + dy) * m.s, w: REGION_W * m.s, h: REGION_H * m.s };
    let src = { u0: 0, v0: 0, u1: 1, v1: 1 };
    if (this.zoom) {
      const [sx, sy, sw, sh] = this._cropRect(texW, texH, dx, dy);
      src = { u0: sx / texW, v0: sy / texH, u1: (sx + sw) / texW, v1: (sy + sh) / texH };
    }
    renderer.drawScreenQuad(tex, dst, src, [1, 1, 1, 1], opts);
  }

  draw(renderer, canvas, font) {
    const m = nativeMetrics(canvas);
    this._font = font;
    this._ensureTextures(renderer);
    if (_art) drawImg(renderer, _art.overworld, m, 0, 0);
    else drawRect(renderer, m, 0, 0, NATIVE_W, 200, [0.04, 0.03, 0.02, 0.95]);

    if (this.regionSelected) {
      const art = _art?.regionMaps?.get(this._regionMapName ?? '');
      if (art) this._drawPage(renderer, m, art.tex, art.w, art.h, 0, 0);
      // the outline copies ride half a SCREEN pixel out (:295-311)
      if (this.outlineEnabled && this._outlineTex) {
        for (const [dx, dy] of OUTLINE_DISPLACEMENTS) {
          this._drawPage(renderer, m, this._outlineTex, REGION_W, REGION_H,
            dx * DOTS_OUTLINE_THICKNESS / m.s, dy * DOTS_OUTLINE_THICKNESS / m.s, { blend: true });
        }
      }
      if (this._dotsTex) this._drawPage(renderer, m, this._dotsTex, REGION_W * this._dotsScale, REGION_H * this._dotsScale, 0, 0);   // TO1: _cropRect already scales by the texture's own size
    }
    if (this.identifying && this.identifyState && this._identifyTex) {
      this._drawPage(renderer, m, this._identifyTex, REGION_W, REGION_H, 0, 0);
    }
    if (this.borderEnabled && _art?.border) {
      drawImg(renderer, _art.border, m, REGION_RECT[0], REGION_RECT[1], REGION_W, REGION_H);
    }

    // the bottom bar
    if (_art) {
      if (this.regionSelected) drawImgCrop(renderer, _art.findAt, m, FIND_SRC, BUTTON_RECTS.find);
      drawImgCrop(renderer, _art.findAt, m, AT_SRC, BUTTON_RECTS.at);
      for (const which of ['dungeons', 'temples', 'homes', 'towns']) {
        const sheet = this.filters[which] ? _art.filterOff : _art.filterOn;
        drawImgCrop(renderer, sheet, m, FILTER_SRC[which], BUTTON_RECTS[which]);
      }
      // SetupArrowButtons (:529-549): the button is 22x20 and the
      // texture is a Button BackgroundTexture, so it stretches to the
      // BUTTON, not to its own size.
      // TO1 (:199-220): the mod's PORTS button lives where the arrows
      // do, so when a region pages it moves all three - the ports
      // button up seven pixels, both arrows down eight.
      const bar = this._portsBar();
      if (this.regionSelected && this.hasMultipleMaps) {
        const [hx, hy] = bar.horizontalArrow;
        const [, , hw, hh] = BUTTON_RECTS.horizontalArrow;
        drawImg(renderer, (this.mapIndex % 2 === 0) ? _art.rightArrow : _art.leftArrow, m, hx, hy, hw, hh);
      }
      if (this.regionSelected && this.hasVerticalMaps) {
        const [vx, vy] = bar.verticalArrow;
        const [, , vw, vh] = BUTTON_RECTS.verticalArrow;
        drawImg(renderer, (this.mapIndex > 1) ? _art.upArrow : _art.downArrow, m, vx, vy, vw, vh);
      }
      // :148-158 - the ports button itself, only while the mod is
      // restricting ship travel to ports (there is nothing to filter
      // for otherwise).
      if (bar.portsShown && _art.portsOn && _art.portsOff) {
        drawImg(renderer, this.portsFilter ? _art.portsOn : _art.portsOff, m, bar.ports[0], bar.ports[1], PORTS_SIZE[0], PORTS_SIZE[1]);
      }
    }

    if (!font) return;
    // the centred region label at y=2 (:280-282)
    const label = this.regionLabelText();
    if (label) shadowText(renderer, font, label, m, 0, 2, { align: 'center', w: NATIVE_W });

    if (this.telePopUp) { this.telePopUp.draw(renderer, canvas, font); return; }
    if (this.popUp) {
      this.popUp.draw(renderer, canvas, font);
      // AUDIT-TO1 I5: the mod's info box is pushed OVER the popup
      // (TravelOptionsPopUp.cs:69-80 raises it from the popup's Update)
      if (this.infoBox) {
        this._box = layoutMessageBox(font, this.infoBox.rows, []);
        this._drawBox(renderer, m, font);
      }
      return;
    }
    if (this.picker) { this.picker.draw(renderer, canvas, font); return; }
    if (this.top === 'find') {
      // DaggerfallInputMessageBox with NULL tokens (:965): the box is
      // the LABEL and the field, on one line, 32 characters wide.
      this._box = null;
      this.findBox?.draw(renderer, canvas, font);
    } else if (this.top === 'notfound') {
      this._box = layoutMessageBox(font, _art?.textRsc?.linesById?.(13) ?? ['That place does not exist.'], []);
      this._drawBox(renderer, m, font);
    } else if (this.top === 'confirm') {
      this._box = layoutMessageBox(font, this._confirmRows(), [MB_BUTTONS.Yes, MB_BUTTONS.No]);
      this._drawBox(renderer, m, font);
    } else if (this.top === 'resume') {
      // TO1 (:326-345) - the mod's own YES/NO over the map.
      this._box = layoutMessageBox(font, [{ text: resumePrompt(this._to?.destinationName ?? ''), center: true }], [MB_BUTTONS.Yes, MB_BUTTONS.No]);
      this._drawBox(renderer, m, font);
    } else if (this.top === 'teleportcost') {
      this._box = layoutMessageBox(font, [{ text: teleportCostPrompt(this._teleportCost ?? 0), center: true }], [MB_BUTTONS.Yes, MB_BUTTONS.No]);
      this._drawBox(renderer, m, font);
    } else if (this.top === 'teleportpoor') {
      this._box = layoutMessageBox(font, _art?.textRsc?.linesById?.(NOT_ENOUGH_GOLD_TEXT_ID) ?? ['You do not have enough gold.'], []);   // TO1 (:500) - DFU's own record, one home (ui/travelPopUp.js)
      this._drawBox(renderer, m, font);
    } else if (this.infoBox) {
      this._box = layoutMessageBox(font, this.infoBox.rows, []);
      this._drawBox(renderer, m, font);
    } else this._box = null;
  }

  _drawBox(renderer, m, font) {
    if (messageBoxArtLoaded() && drawMessageBox(renderer, m, font, this._box)) return;
    (this._box.rows ?? []).forEach((r, i) => drawText(renderer, font, r.text ?? r,
      m.ox + 20 * m.s, m.oy + (20 + i * 10) * m.s, m.s, [0.9, 0.9, 0.75, 1]));
  }
}

// ── ROAD-E E3: TravelMapConsoleCommands ──────────────────────────────
// DaggerfallTravelMapWindow.cs:1786-1884, registered in the window's
// own constructor there (:226-234) and here by the host that builds
// this window - the port's windows are per-open and its hosts are what
// persist, which is also where `isPlayerInside` and PlayerGPS live.
// Three commands, not two: the recorded departure above named the pair
// this file's flag sets, and `map_reveallocation` (singular) is the
// third row of the same RegisterCommands.
export function registerTravelMapConsoleCommands(deps = {}) {
  const inside = () => !!deps.isPlayerInside?.();
  try {
    registerCommand('map_reveallocations',
      'Reveals undiscovered locations on travelmap (temporary)',
      'map_reveallocations',
      () => {
        if (inside()) return 'this command only has an effect when outside';
        _revealUndiscoveredLocations = true;
        return 'undiscovered locations have been revealed (temporary) on the travelmap';
      });
    registerCommand('map_hidelocations',
      'Hides undiscovered locations on travelmap',
      'map_hidelocations',
      () => {
        if (inside()) return 'this command only has an effect when outside';
        _revealUndiscoveredLocations = false;
        return 'undiscovered locations have been hidden on the travelmap again';
      });
    // RevealLocation (:1846-1884). Its `error` field is declared and
    // never read in C#, which is why no string below is it. The
    // too-few-arguments arm LOGS the sentence and answers with HELP's
    // own details block for this command - and C#'s try/catch around
    // the log answers the same way either way, because the only thing
    // in the try is the log itself.
    registerCommand('map_reveallocation',
      'Permanently reveals the location with [locationName] in region [regionName] on travelmap',
      'map_reveallocation [regionName] [locationName] - inside the name strings use underscores instead of spaces, e.g Dragontail_Mountains',
      (args) => {
        if (args == null || args.length < 2) {
          consoleLog('please provide both a region name as well as a location name');
          return HELP_COMMAND.execute(['map_reveallocation']);
        }
        const regionName = String(args[0]).replaceAll('_', ' ');
        const locationName = String(args[1]).replaceAll('_', ' ');
        try {
          deps.discoverLocation?.(regionName, locationName);
          return `revealed location ${regionName} : ${locationName} on the travelmap`;
        } catch (ex) {
          return `Could not reveal location: ${ex?.message ?? ex}`;
        }
      });
  } catch (ex) {
    console.error(`Error Registering Travelmap Console commands: ${ex?.message ?? ex}`);
  }
}
