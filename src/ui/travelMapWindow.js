// W1-i: THE TRAVEL MAP - DaggerfallTravelMapWindow.cs (MIT,
// Daggerfall Workshop; original authors Lypyl and Gavin Clayton) on
// the real TRAV0I00.IMG. This is the classic world map the F-slice
// left routed: the province map with its clickable regions, the
// region pages with their location dots, the flashing identify, the
// four filter buttons, the find box and its list picker, and the
// travel popup behind it (ui/travelPopUp.js).
//
// It RETIRES ui/travelMap.js, the keyed typeahead that stood in for
// this window since the F-slice - the Ledger row called it INTERIM
// and this is the window it was standing in for. What it carried
// forward: the visibility law (checkLocationDiscovered, TV-slice)
// and the arrival seam (onTravel -> the host's fastTravelTo).
//
// THE NATIVE-WINDOW RULE, element by element:
// - the background is the whole 320x200 TRAV0I00.IMG (:325-326);
//   the region pages draw INTO the 320x160 window it frames, at
//   (0, regionPanelOffset=12) (:117).
// - the region label is a centred default-shadowed label at y=2
//   (:277-279).
// - the bottom bar's buttons: EXIT (278,175,39,22) - art already in
//   the background - FIND (3,175) and I'M AT (3,186) cut out of
//   TRAV0I03.IMG's 45x22 sheet, the four filter buttons cut out of
//   TRAV01I0/TRAV01I1's 179x22 sheets (enabled/disabled pairs) at
//   (50,175) (50,186) (149,175) (149,186), and the two 22x20 arrow
//   buttons at (231,176) and (254,176) (:449-522).
// - MBRD00I0.IMG borders the region page whenever it is not zoomed
//   (:319-322, :795-799).
// - the location dots are a GENERATED 320x160 texture, one pixel per
//   map pixel, coloured out of FMAP_PAL.COL by location type
//   (:249-267); with TravelMapLocationsOutline on, a second
//   half-transparent black copy draws four times at half-pixel
//   offsets to outline them (:296-311, :672-732).
//
// THE LAWS, verbatim:
// - the offset table (:600-645) that aligns each region page to map
//   pixels, Betony's scale of 4 and its -477/+60/+212 fixups, and
//   the Cybiades quarter-scale mouse fix (:1188-1199).
// - the dots walk (:677-720): politic index must equal the open
//   region, the pixel must carry a location, the location must be
//   discovered, and its type must survive the filters. DFU's own
//   `offset * scale` indexing quirk is kept - it is what makes the
//   Betony page plot at all.
// - the identify flash (:1815-1866): 0.5s per state, four flashes
//   for a region and two for a selected location, and the flash's
//   END is what pops the travel confirmation after a find.
// - the zoom (:731-800): right-click toggles a 2x crop centred on
//   the cursor, shift-move pans it, and the crop clamps to the page
//   edges. The port's textures are TOP-DOWN where Unity's are
//   bottom-up, so the buffers are built in DFU's bottom-up order and
//   flipped at upload; the crop rect is flipped with them.
// - the find box (:963-975) runs DFU's weighted edit distance over
//   the OPEN region's names (systems/editDistance.js), not a prefix
//   match, with MatchesCutOff's relevance gate.
//
// RECORDED DEPARTURES:
// - no localization layer: every name is the canonical MAPS.BSA one,
//   so GetLocalizedLocationName / GetLocalizedRegionName collapse to
//   the map table and REGION_NAMES, and the localizedMapNameLookup
//   dictionary reduces to the region's own name list.
// - no TextureReplacement: the imported region overlays and custom
//   region maps (:648-660, :821-833) have no door here.
// - no world data replacement: checkLocationDiscovered reads the
//   BAKED map table flag, which is what the TV-slice already did.
// - the console's map_reveallocations pair has no console to live
//   in; the flag survives as setRevealUndiscoveredLocations.
// - DFU's Update() polls the mouse every frame; the port's windows
//   are told (hover/click), so the same work happens on the move.
//
// FLAGGED, idling loudly: the journal's click-through travel
// (GotoPlace, :438-449), the guild TELEPORT mode
// (ActivateTeleportationTravel + DaggerfallTeleportPopUp, :1720-1728)
// which waits on the guild arc's teleport service, and DFU's
// TravelMapSaveData round trip, which is offered here
// (getTravelMapSaveData/setTravelMapFromSaveData) and waits on the
// host's save envelope to carry it.

import { loadImg, nativeMetrics, drawImg, drawImgCrop, drawRect, shadowText, NATIVE_W } from './nativePanel.js';
import { layoutMessageBox, drawMessageBox, messageBoxHit, MB_BUTTONS, messageBoxArtLoaded } from './messageBox.js';
import { ListPickerWindow, preloadListPickerArt } from './listPicker.js';
import { TravelPopUpWindow, preloadTravelPopUpArt } from './travelPopUp.js';
import { drawText } from './text.js';
import { typedChar, bindings } from './input.js';
import { actionForCode } from '../systems/inputActions.js';
import { ImgFile } from '../formats/imgFile.js';
import { DFPalette } from '../formats/dfPalette.js';
import { TextRsc } from '../formats/textRsc.js';
import { REGION_NAMES, LOCATION_TYPES, longitudeLatitudeToMapPixel, getPixelFromPixelID } from '../formats/mapsFile.js';
import { locationSummaryAt } from '../systems/mapDirectory.js';
import { getDaggerfallDistance, MatchesCutOff } from '../systems/editDistance.js';
import { hasDiscoveredLocationId } from '../systems/discovery.js';
import { getBool } from '../systems/settings.js';
import { audio } from '../systems/audio.js';
import { SOUND } from '../systems/soundClips.js';

// --- DFU's fields (:36-63) ---
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
/** regionTextureOverlayPanelRect (:117) - the region page. */
export const REGION_RECT = Object.freeze([0, REGION_PANEL_OFFSET, 320, 160]);
export const REGION_W = 320, REGION_H = 160;

/** The bottom bar (:449-522). */
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
/** The filter sheets' source rects on DFSize(179,22) (:118-121) and
 *  the find/at cutouts on DFSize(45,22) (:122-123). */
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

/** locationPixelColors' palette indices (:253-268) and the identify
 *  flash colour (:270), read out of FMAP_PAL.COL. */
export const LOCATION_PIXEL_COLOR_INDICES = Object.freeze([
  237, 240, 243, 246, 0, 53, 51, 55, 96, 101, 39, 33, 35, 37,
]);
export const IDENTIFY_FLASH_COLOR_INDEX = 244;

/** PopulateRegionOffsetDict (:598-645): the map pixel the top-left
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

/** The eighteen regions with NO page in the offset table (:598-645):
 *  the wildernesses, the two generic villages and the four coast
 *  strips. DFU's UpdateMapLocationDotsTexture indexes offsetLookup
 *  directly, so opening one of these throws KeyNotFoundException;
 *  the port REFUSES the page instead - a recorded departure, since
 *  a crash is not a behaviour worth reproducing. Nothing paints
 *  them in the region picker, so nothing normally clicks them. */
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

/** GetPixelColorIndex (:1355-1432): the type's dot colour, or -1
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

// map_reveallocations / map_hidelocations (:1870-1900) - the flag
// outlives the console the port does not have.
let _revealUndiscoveredLocations = false;
export function setRevealUndiscoveredLocations(on) { _revealUndiscoveredLocations = !!on; }
export const revealUndiscoveredLocations = () => _revealUndiscoveredLocations;

// The A1/A2 texture-key lesson: uploadTexture memoizes forever, so
// every generated texture gets a MODULE-level version in its key.
let _texVer = 0;

let _art = null;
/** The window's whole art bundle: the overworld, the picker BITMAP
 *  (indices, not a texture - the region shapes are read out of it),
 *  the button sheets, the border, FMAP_PAL.COL and TEXT.RSC. */
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
  // The dot colours and the flash colour are FMAP_PAL entries (:253-270).
  const locationPixelColors = LOCATION_PIXEL_COLOR_INDICES.map((i) =>
    packRGBA(fmapPalette.getRed(i), fmapPalette.getGreen(i), fmapPalette.getBlue(i), 255));
  const identifyFlashColor = packRGBA(
    fmapPalette.getRed(IDENTIFY_FLASH_COLOR_INDEX), fmapPalette.getGreen(IDENTIFY_FLASH_COLOR_INDEX),
    fmapPalette.getBlue(IDENTIFY_FLASH_COLOR_INDEX), 255);
  _art = {
    overworld, findAt, filterOn, filterOff, downArrow, upArrow, rightArrow, leftArrow, border,
    pickerBitmap: picker.getDFBitmap(), fmapPalette, textRsc,
    locationPixelColors, identifyFlashColor,
    regionMaps: new Map(),   // lazily filled, DFU's regionTextures
    deps,
  };
  await preloadTravelPopUpArt(deps);
  await preloadListPickerArt(deps).catch(() => { /* the picker keeps its own fallback */ });
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

export class TravelMapWindow {
  /** deps: { maps, mapDict, getPlayerPixel, getClimateIndex, gold,
   *  goldPieces, hasHorse, hasCart, hasShip, diseaseCount, onTravel,
   *  onClose, pick }. */
  constructor(deps = {}) {
    this.deps = deps;
    this.done = false;
    this.isChoiceWindow = true;   // this window reads raw key codes
    // DFU's state (:130-158)
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
    this._clock = 0;            // Time.realtimeSinceStartup's stand-in
    this.filters = { dungeons: false, temples: false, homes: false, towns: false };
    this.lastMousePos = [0, 0];
    this.selectedRegionMapNames = getRegionMapNames(this._getPlayerRegion());
    this.borderEnabled = false;
    // sub-windows and boxes, in the order they take input
    this.popUp = null;
    this.picker = null;
    this.top = null;            // 'find' | 'notfound' | 'confirm'
    this.findText = '';
    this._box = null;
    // the generated textures
    this._dotsKey = null;
    this._outlineKey = null;
    this._identifyKey = null;
    this._dotsBuf = new Uint32Array(REGION_W * REGION_H);
    this._outlineBuf = new Uint32Array(REGION_W * REGION_H);
    this._identifyBuf = new Uint32Array(REGION_W * REGION_H);
    this._dotsDirty = true;
    this._identifyDirty = true;
    this._distance = null;
    this._distanceRegionName = null;
    this._regionMapName = null;   // the page whose art is mounted
    // Setup's tail (:344-348) - identify the player's region.
    this._startIdentify();
    this._updateIdentifyTextureForPlayerRegion();
  }

  // --- properties (:170-200) ---
  get hasMultipleMaps() { return this.selectedRegionMapNames.length > 1; }
  get hasVerticalMaps() { return this.selectedRegionMapNames.length > 2; }
  get regionSelected() { return this.selectedRegion !== -1; }
  get mouseOverRegionValid() { return this.mouseOverRegion !== -1; }
  get mouseOverOtherRegion() { return this.regionSelected && this.selectedRegion !== this.mouseOverRegion; }
  get findingLocationActive() { return this.identifying && this.findingLocation && this.regionSelected; }
  get outlineEnabled() { return getBool('GUI', 'TravelMapLocationsOutline'); }

  _click() { audio.playOneShot(SOUND.ButtonClick, 1); }

  // --- helpers (:1637-1680) ---

  /** GetPlayerRegion (:1637-1646) - DFU's own raw politic read, not
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

  /** GetLocationNameInCurrentRegion (:1620-1650). The fallback arm
   *  reads locationSummary.MapIndex rather than the argument - DFU's
   *  own quirk, kept. */
  _getLocationNameInCurrentRegion() {
    if (this.currentDFRegionIndex === -1) return '';
    return this.currentDFRegion?.mapNames?.[this.locationSummary?.mapIndex] ?? '';
  }

  /** checkLocationDiscovered (:1121-1131) - the ONE visibility test:
   *  the runtime store, the BAKED flag, or the reveal cheat. */
  checkLocationDiscovered(summary) {
    if (!summary) return false;
    return hasDiscoveredLocationId(summary.id) || !!summary.discovered || _revealUndiscoveredLocations;
  }

  /** CanFindPlace (:1134-1146) - the same test through a name. */
  canFindPlace(regionName, name) {
    const maps = this.deps.maps;
    const region = maps?.getRegionByName?.(regionName);
    const index = region?.mapNameLookup?.get(name);
    if (index === undefined || index === null) return false;
    const row = region.mapTable[index];
    const pixel = longitudeLatitudeToMapPixel(row.longitude, row.latitude);
    const summary = locationSummaryAt(this.deps.mapDict, pixel.x, pixel.y);
    return summary ? this.checkLocationDiscovered(summary) : false;
  }

  // --- the region page (:648-800) ---

  _updateMapTextures() {
    if (!this.regionSelected) return;
    const mapName = this.selectedRegionMapNames[this.mapIndex];
    this._regionMapName = mapName;
    loadRegionMap(mapName).catch((e) => console.warn(`[travelmap] ${mapName} unavailable:`, e?.message ?? e));
    this._updateMapLocationDotsTexture();
  }

  /** UpdateMapLocationDotsTexture (:669-732). The buffers are built
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
    this._dotsBuf.fill(0);
    this._outlineBuf.fill(0);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        // the `* scale` on the whole offset is DFU's own (:679)
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
    this._dotsDirty = true;
  }

  /** ZoomMapTextures (:734-800) - the crop's ORIGIN; the draw applies
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

  /** UpdateBorder (:802-806). */
  _updateBorder() { this.borderEnabled = this.regionSelected && !this.zoom; }

  /** UpdateIdentifyTextureForPlayerRegion (:808-870) - the province
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

  /** UpdateCrosshair (:872-878). */
  _updateCrosshair() {
    if (this.findingLocationActive) {
      const pos = getPixelFromPixelID(this.locationSummary.id);
      this._updateIdentifyTextureForPosition(pos.x, pos.y, this.locationSummary.regionIndex);
    } else {
      const pos = this.deps.getPlayerPixel();
      this._updateIdentifyTextureForPosition(pos.x, pos.y, this.selectedRegion);
    }
  }

  /** UpdateIdentifyTextureForPosition (:888-928) - the crosshair. */
  _updateIdentifyTextureForPosition(mapPixelX, mapPixelY, regionIndex) {
    if (!this.regionSelected) return;
    if (regionIndex === -1) regionIndex = this._getPlayerRegion();
    this._identifyBuf.fill(0);
    const mapName = this.selectedRegionMapNames[this.mapIndex];
    const origin = OFFSET_LOOKUP[mapName] ?? [0, 0];
    const scale = getRegionMapScale(regionIndex);
    const yAdjust = regionIndex === BETONY_INDEX ? -477 : 0;   // (:900-903)
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

  // --- the region panel's life (:1069-1119) ---

  /** OpenRegionPanel (:1071-1097). */
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

  /** CloseTravelWindows (:1290-1296). */
  closeTravelWindows(forceClose = false) {
    if (!this.regionSelected || forceClose) { this.done = true; this.deps.onClose?.(); }
    else this._closeRegionPanel();
  }

  // --- mouse (:1148-1288) ---

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

  /** UpdateMouseOverLocation (:1176-1240). */
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

    if (this.selectedRegion === BETONY_INDEX) { x += 60; y += 212; }   // (:1194-1198)
    if (this.selectedRegion === 61) {                                   // Cybiades (:1200-1210)
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

  /** UpdateMouseOverRegion (:1243-1270) - the picker bitmap answers
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

  /** UpdateRegionLabel (:1273-1283). */
  regionLabelText() {
    if (!this.regionSelected) return this._getRegionName(this.mouseOverRegion);
    if (this.locationSelected) {
      return `${this._getRegionName(this.mouseOverRegion)} : ${this._getLocationNameInCurrentRegion()}`;
    }
    if (this.mouseOverOtherRegion) return `Switch To: ${this._getRegionName(this.mouseOverRegion)} Region`;
    return this._getRegionName(this.mouseOverRegion);
  }

  // --- identify (:1815-1866) ---

  _startIdentify() {
    if (this.identifying) this._stopIdentify(false);
    this.identifying = true;
    this.identifyState = false;
    this.identifyChanges = 0;
    this.identifyLastChangeTime = 0;
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
    const time = this._clock;
    if (time > this.identifyLastChangeTime + IDENTIFY_FLASH_INTERVAL) {
      this.identifyState = !this.identifyState;
      this.identifyLastChangeTime = time;
    }
    if (!lastIdentifyState && this.identifyState) {
      const flashCount = this.locationSelected ? IDENTIFY_FLASH_COUNT_SELECTED : IDENTIFY_FLASH_COUNT;
      if (++this.identifyChanges > flashCount) this._stopIdentify();
    }
  }

  // --- the find flow (:1435-1600) ---

  /** GetCurrentRegionLocalizedMapNames (:1462-1478) - deduped, in
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

  /** FindLocation (:1481-1531). */
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
    this.picker = new ListPickerWindow({
      items: filtered,
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

  /** CreateConfirmationPopUp (:1682-1706) - TEXT.RSC 31 with %tcn
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

  /** CreatePopUpWindow (:1708-1728) - the travel popup (the teleport
   *  arm is FLAGGED). */
  _createPopUpWindow() {
    const pos = getPixelFromPixelID(this.locationSummary.id);
    this.popUp = new TravelPopUpWindow(pos, {
      getPlayerPixel: this.deps.getPlayerPixel,
      getClimateIndex: this.deps.getClimateIndex,
      gold: this.deps.gold,
      goldPieces: this.deps.goldPieces,
      hasHorse: this.deps.hasHorse,
      hasCart: this.deps.hasCart,
      hasShip: this.deps.hasShip,
      diseaseCount: this.deps.diseaseCount,
      textRsc: _art?.textRsc ?? null,
      pick: this.deps.pick,
      onExit: () => { this.popUp = null; },
      onTravel: (endPos, opts, computed) => {
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
    // SetTravelMapFromSaveData's popup half (:1325-1336): the three
    // toggles a save restored land on the popup when it is minted.
    if (this._pendingPopUpState) Object.assign(this.popUp, this._pendingPopUpState);
    this.popUp.refresh();
  }

  // --- the save envelope (:1298-1340) ---

  getTravelMapSaveData() {
    return {
      filterDungeons: this.filters.dungeons,
      filterHomes: this.filters.homes,
      filterTemples: this.filters.temples,
      filterTowns: this.filters.towns,
      sleepInn: this.popUp?.sleepModeInn ?? true,
      speedCautious: this.popUp?.speedCautious ?? true,
      travelShip: this.popUp?.travelShip ?? true,
    };
  }

  setTravelMapFromSaveData(data) {
    const d = data ?? {};
    this.filters = {
      dungeons: !!d.filterDungeons, homes: !!d.filterHomes,
      temples: !!d.filterTemples, towns: !!d.filterTowns,
    };
    this._pendingPopUpState = {
      sleepModeInn: d.sleepInn ?? true,
      speedCautious: d.speedCautious ?? true,
      travelShip: d.travelShip ?? true,
    };
    if (this.regionSelected) this._updateMapLocationDotsTexture();
  }

  // --- event handlers (:930-1064) ---

  /** ClickHandler (:933-960). */
  _clickHandler(vx, vy) {
    const y = vy - REGION_PANEL_OFFSET;
    if (vx < 0 || vx > REGION_W || y < 0 || y > REGION_H) return;
    if (!this.regionSelected) {
      if (this.mouseOverRegionValid) this._openRegionPanel(this.mouseOverRegion);
    } else if (this.locationSelected) {
      if (this.findingLocationActive) this._stopIdentify(true);
      else this._createPopUpWindow();
    } else if (this.mouseOverOtherRegion) {
      this._openRegionPanel(this.mouseOverRegion);
    }
  }

  /** AtButtonClickHandler (:969-975). */
  _atButtonClick() {
    this.findingLocation = false;
    this._startIdentify();
    if (this.regionSelected) this._updateCrosshair();
    else this._updateIdentifyTextureForPlayerRegion();
  }

  /** FindlocationButtonClickHandler (:977-991) - the input box. */
  _findLocationButtonClick() {
    if (!this.regionSelected) return;
    this._click();
    this.top = 'find';
    this.findText = '';
  }

  /** ArrowButtonClickHandler (:1006-1039). */
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

  /** FilterButtonClickHandler (:1044-1064). */
  _filterButtonClick(which) {
    if (!(which in this.filters)) return;
    this.filters[which] = !this.filters[which];
    this._updateMapLocationDotsTexture();
  }

  // --- the host seam ---

  input(code, e = null) {
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
      if (code === 'Escape') { this.top = null; return; }
      if (code === 'Enter' || code === 'NumpadEnter') {
        const text = this.findText;
        this.top = null;
        this._handleLocationFindEvent(text);
        return;
      }
      if (code === 'Backspace') { this.findText = this.findText.slice(0, -1); return; }
      const ch = typedChar(code, e);
      if (ch && this.findText.length < FIND_MAX_CHARACTERS) this.findText += ch;   // (:986)
      return;
    }
    if (this.top === 'notfound') { this.top = null; return; }     // ClickAnywhereToClose
    if (this.top === 'confirm') {
      // ConfirmTravelPopupButtonClick (:993-1001)
      if (code === 'KeyY') { this._click(); this.top = null; this._createPopUpWindow(); return; }
      if (code === 'KeyN' || code === 'Escape') { this._click(); this.top = null; this._stopIdentify(); }
      return;
    }
    // Update's own keys (:378-425)
    // Update's toggle-closed binding and the back button (:376-386)
    if (code === 'Escape' || actionForCode(bindings(), code) === 'TravelMap') {
      this.closeTravelWindows();
      return;
    }
    if (this.regionSelected) {
      if (code === 'KeyL') {
        if ((this.currentDFRegion?.locationCount ?? 0) < 1) return;
        this._showLocationPicker([...this._currentRegionMapNames()].sort(), true);
        return;
      }
      if (code === 'KeyF') { this._findLocationButtonClick(); return; }
      return;
    }
    if (code === 'Enter' || code === 'NumpadEnter') {
      if (this.identifying) this._openRegionPanel(this._getPlayerRegion());
    }
  }

  hover(vx, vy, e = null) {
    if (this.popUp || this.picker || this.top) return;
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

  click(vx, vy, right = false) {
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
    if (this.top === 'confirm') {
      const hit = this._box ? messageBoxHit(this._box, vx, vy) : null;
      if (hit === MB_BUTTONS.Yes) this.input('KeyY');
      else if (hit === MB_BUTTONS.No) this.input('KeyN');
      return true;
    }
    if (this.top) { this.top = null; return true; }
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
    if (this.hasMultipleMaps && inRect(BUTTON_RECTS.horizontalArrow, vx, vy)) { this._arrowButtonClick('horizontal'); return true; }
    if (this.hasVerticalMaps && inRect(BUTTON_RECTS.verticalArrow, vx, vy)) { this._arrowButtonClick('vertical'); return true; }
    // A click lands where the cursor is: keep the hover state honest
    // for hosts that never send a move (touch).
    this.lastMousePos = [vx, vy];
    if (this.regionSelected) this._updateMouseOverLocation();
    else this._updateMouseOverRegion();
    this._clickHandler(vx, vy);
    return true;
  }

  /** The wheel belongs to whatever is on top (the picker scrolls). */
  wheel(dir) { this.picker?.wheel?.(dir); }

  tick(dt) {
    this._clock += dt;
    if (this.popUp) {
      this.popUp.tick(dt);
      if (this.popUp?.done) this.popUp = null;
      return;
    }
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
  _upload(renderer, kind, buf) {
    const flipped = new Uint32Array(REGION_W * REGION_H);
    for (let y = 0; y < REGION_H; y++) {
      flipped.set(buf.subarray((REGION_H - y - 1) * REGION_W, (REGION_H - y) * REGION_W), y * REGION_W);
    }
    const key = `${kind}-${++_texVer}`;
    const tex = renderer.uploadTexture('travelmap', key, { width: REGION_W, height: REGION_H, colors: flipped });
    return { key, tex };
  }

  _ensureTextures(renderer) {
    this._renderer = renderer;
    if (this._dotsDirty) {
      const prevDots = this._dotsKey, prevOutline = this._outlineKey;
      const dots = this._upload(renderer, 'dots', this._dotsBuf);
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
  _cropRect(texW, texH) {
    const ratioX = texW / REGION_W, ratioY = texH / REGION_H;
    const sw = (REGION_W / ZOOM_FACTOR) * ratioX;
    const sh = (REGION_H / ZOOM_FACTOR) * ratioY;
    const sx = this.zoomOffset[0] * ratioX;
    const sy = texH - (this.zoomOffset[1] * ratioY + sh);
    return [sx, sy, sw, sh];
  }

  _drawPage(renderer, m, tex, texW, texH, dx, dy, opts = {}) {
    const dst = { x: m.ox + (REGION_RECT[0] + dx) * m.s, y: m.oy + (REGION_RECT[1] + dy) * m.s, w: REGION_W * m.s, h: REGION_H * m.s };
    let src = { u0: 0, v0: 0, u1: 1, v1: 1 };
    if (this.zoom) {
      const [sx, sy, sw, sh] = this._cropRect(texW, texH);
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
      // the outline copies ride half a SCREEN pixel out (:296-311)
      if (this.outlineEnabled && this._outlineTex) {
        for (const [dx, dy] of OUTLINE_DISPLACEMENTS) {
          this._drawPage(renderer, m, this._outlineTex, REGION_W, REGION_H,
            dx * DOTS_OUTLINE_THICKNESS / m.s, dy * DOTS_OUTLINE_THICKNESS / m.s, { blend: true });
        }
      }
      if (this._dotsTex) this._drawPage(renderer, m, this._dotsTex, REGION_W, REGION_H, 0, 0);
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
      if (this.hasMultipleMaps) {
        const horiz = (this.mapIndex % 2 === 0) ? _art.rightArrow : _art.leftArrow;
        drawImg(renderer, horiz, m, BUTTON_RECTS.horizontalArrow[0], BUTTON_RECTS.horizontalArrow[1]);
      }
      if (this.hasVerticalMaps) {
        const vert = (this.mapIndex > 1) ? _art.upArrow : _art.downArrow;
        drawImg(renderer, vert, m, BUTTON_RECTS.verticalArrow[0], BUTTON_RECTS.verticalArrow[1]);
      }
    }

    if (!font) return;
    // the centred region label at y=2 (:277-279)
    const label = this.regionLabelText();
    if (label) shadowText(renderer, font, label, m, 0, 2, { align: 'center', w: NATIVE_W });

    if (this.popUp) { this.popUp.draw(renderer, canvas, font); return; }
    if (this.picker) { this.picker.draw(renderer, canvas, font); return; }
    if (this.top === 'find') {
      // DaggerfallInputMessageBox with NULL tokens (:983): the box is
      // the LABEL and the field, on one line, 32 characters wide.
      this._box = layoutMessageBox(font, [`${FIND_PROMPT}${this.findText}_`], [],
        { sizingRows: [`${FIND_PROMPT}${'M'.repeat(FIND_MAX_CHARACTERS)}_`] });
      this._drawBox(renderer, m, font);
    } else if (this.top === 'notfound') {
      this._box = layoutMessageBox(font, _art?.textRsc?.linesById?.(13) ?? ['That place does not exist.'], []);
      this._drawBox(renderer, m, font);
    } else if (this.top === 'confirm') {
      this._box = layoutMessageBox(font, this._confirmRows(), [MB_BUTTONS.Yes, MB_BUTTONS.No]);
      this._drawBox(renderer, m, font);
    } else this._box = null;
  }

  _drawBox(renderer, m, font) {
    if (messageBoxArtLoaded() && drawMessageBox(renderer, m, font, this._box)) return;
    (this._box.rows ?? []).forEach((r, i) => drawText(renderer, font, r.text ?? r,
      m.ox + 20 * m.s, m.oy + (20 + i * 10) * m.s, m.s, [0.9, 0.9, 0.75, 1]));
  }
}
