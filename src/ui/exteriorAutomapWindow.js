// A2 / ROAD-C c2/S10: THE EXTERIOR AUTOMAP - the town map on M,
// outdoors. The laws are ExteriorAutomap.cs +
// DaggerfallExteriorAutomapWindow.cs (MIT, Daggerfall Workshop;
// original author Nystul).
//
// c2/S10 REPLACED THE KEYED OVERLAY WITH THE NATIVE WINDOW AND MADE
// ROTATION REAL. What A2 shipped was a full-canvas parchment panel
// with stepped pan/zoom, north always up, and a circle-and-nose player
// marker. What DFU actually draws is an ORTHOGRAPHIC camera, straight
// down (Quaternion.Euler(90,0,0), ExteriorAutomap.cs:539-543), rotated
// only about -up (window :1101-1105), with layoutMultiplier the
// constant 1.0 (:165). Under that lens the whole map is
//
//     screen = R(yaw) * (p_layout - centre) * k,   k = panelH / (2*orthoSize)
//
// and the four objects' y-values are a PAINT ORDER, not depth:
//
//     circle  y = -20     12x12 units, (0.75, 0.71, 0.71)      (:1614, :1647)
//     stamp   y = -10     mesh 99900 x4.0, (0.353,0.086,0.086) (:1409-1412, :1624)
//     layout  y = +0.01   the block bitmap quad                 (:552-572)
//     arrow   y = +0.1    mesh 99900 x2.5, unlit texture        (:1399, :1616)
//
// THE PAINT ORDER IS LOAD-BEARING. Byte 0 of a block's automap data is
// TRANSPARENT (:1529-1534), so the circle and the dark stamp show
// THROUGH the layout's street pixels - that see-through halo under the
// player is what classic looks like. An opaque mesh pass at those
// y-offsets would delete it, which is why this window is a CPU
// composition of screen quads and not a second 3D scene. The only new
// GL in the arc is drawScreenQuad's optional `rotate` (renderer.js).
//
// VERBATIM FROM A2, UNCHANGED: the layout bitmap (64x64 px per RMB
// block, the per-block row flip :1481, the byte -> colour-group law
// :1482-1541 with the four Map colour settings, ground flats stripped
// except in the All view :318-337), the three view modes, the zoom
// band (orthographicSize 25..250 with the ExteriorMapDefaultZoomLevel
// start clamped by ComputeZoom, x8 blocks :1004-1014), zoom memory
// across reopen + the reset-on-new-location setting (:513-533), the
// player marker trio's colours and sizes (:1604-1649), the nameplate
// collision solver (nameplateLayout.js) with its "*" surrender, and
// the M-outside dispatch (DaggerfallUI.cs:633-650).
//
// NEW HERE: the native AMAP00I0 + TOWN00I0 chrome through the SHARED
// ui/automapChrome.js tables (the same nine rects the dungeon window
// uses, wired to EXTERIOR_ACTIONS), the compass on the MAP camera's
// yaw, the four border jumps on the arrows' right button, drag pan at
// dragSpeed 0.00345 x orthoSize and drag rotate at 5.0, max/min zoom,
// the four backgrounds, and the real mesh-99900 arrow through
// ui/meshStamp.js.
//
// DEPARTURES THAT STAND (recorded, Port-Ledger):
//  - THE KEYBOARD ARMS ARE EDGE-DRIVEN. DFU polls its ExtAutomap
//    hotkeys with IsPressedWith EVERY frame (window :641-720), so a
//    held key pans at 100 units/SECOND. The port has no DaggerfallShortcut
//    registry and townTalk's overlay seam delivers keydown only (no
//    keyup), so each press applies ONE FRAME of DFU's per-second speed
//    and the browser's key repeat supplies the hold. The MOUSE arms
//    have no such gap: the chrome's press-hold machine and both drags
//    run off the real down/move/up seam and are frame-exact.
//  - the residence-with-active-quest plate arm (:682-709) is FLAGGED -
//    the port's quest bridge exposes no locationWasMarkedOnMapByNPC.
//  - the plate label is the port's FNT text, not DFU's yellow-reloaded
//    DaggerfallFont Texture2D, so TextScale is halved for the port's
//    16px-cell glyphs (the A2 legibility pick, kept).
//  - the arrow draws as a WHITE silhouette tinted at the blit, not with
//    mesh 99900's own skin. DFU's arrow carries Unlit/Texture and its
//    stamp Unlit/Color, so only the ARROW loses anything - and at
//    ~8.5 native px across (see meshStamp.js's arithmetic) what it
//    loses is a handful of texels.
//
// FLAGGED, both awaiting a seam this stage does not own:
//  - the eight BUTTON tooltips. ToolTipText for the exterior chrome is
//    the Internal_Strings automap block with hotkey substitution, which
//    ui/automapText.js carries for the dungeon window; the PLATE
//    tooltips (ToolTipDelay 0, the canonical name) ship here.
//  - map_revealbuildings / map_hidebuildings (:1796-1830). The flag
//    they set - `revealUndiscoveredBuildings` - is live on this window
//    and pinned; the port has no console for them to live in, exactly
//    as ui/travelMapWindow.js records for map_reveallocations.
//
// THE COPY LAW: getBlockAutoMap's removeGroundFlats mutates the
// CACHED block array in place, and cityNavigation carves the navgrid
// from that same array - so this window never touches it: bytes are
// read straight from the retained autoMapData and 0xfb is dropped
// per-pixel during the paint.

import { drawText, measureText } from './text.js';
import { getBool, getInt, getString } from '../systems/settings.js';
import { hexColor32 } from './automapWindow.js';
import { resolveNameplates, nameplateAnchor } from './nameplateLayout.js';
import {
  nativeMetrics, drawImg, drawRect, loadImg, NATIVE_W, NATIVE_H, SCREEN_DIM,
} from './nativePanel.js';
import {
  AutomapChrome, CHROME_RECTS, CAPTION_STRIP, CAPTION_SWATCHES, EXTERIOR_ACTIONS,
  compassHeading01,
} from './automapChrome.js';
import {
  EXT_SCROLL_LEFT_RIGHT_SPEED, EXT_SCROLL_UP_DOWN_SPEED, EXT_ROTATE_SPEED,
  EXT_ZOOM_SPEED, EXT_ZOOM_SPEED_MOUSE_WHEEL, EXT_DRAG_ROTATE_SPEED,
  EXT_MAX_ZOOM, EXT_MIN_ZOOM, EXT_NUM_MAX_BLOCKS, EXT_LAYOUT_MULTIPLIER,
  computeExteriorZoom, exteriorZoom, exteriorApplyMinZoom, exteriorApplyMaxZoom,
  exteriorRotate, exteriorRotateAroundPlayerPos, exteriorDragPan, getLocationBorderPos,
} from './automapCamera.js';
import { rasterizeTopDown, rasterizeDisc } from './meshStamp.js';
import { compassScroll, COMPASS_BOX_OUTLINE, COMPASS_BOX_INTERIOR } from './hud.js';
import { GLOBAL_SCALE } from '../world/meshReader.js';

export const BLOCK_PX = 64;                      // blockSizeWidth/Height (ExteriorAutomap.cs:153-154)
const WORLD_PER_PX = 102.4 / BLOCK_PX;           // 1.6 world units per layout pixel (RMBDimension * GlobalScale / 64)
export const ZOOM_MIN = EXT_MAX_ZOOM;            // 25 - DFU's maxZoom, "the minimum camera height"
export const ZOOM_MAX = EXT_MIN_ZOOM;            // 250 - DFU's minZoom (the names invert the meaning)
const NAMEPLATE_YELLOW = [243 / 255, 239 / 255, 44 / 255, 1];   // DaggerfallDefaultTextColor (DaggerfallUI.cs:52)
/** MapsFile.WorldMapTerrainDim (MapsFile.cs:33) - one map pixel's
 *  terrain in Daggerfall units; x GlobalScale it is 819.2 world units,
 *  and it is EXACTLY the 8x8-block span the player marker is placed
 *  against (:1382-1403). */
export const WORLD_MAP_TERRAIN_DIM = 32768;
export const MARKER_TILE_SCALE = WORLD_MAP_TERRAIN_DIM * GLOBAL_SCALE;   // 819.2
/** refWidth/refHeight (:1396-1397): blockSize x numMaxBlocks x layoutMultiplier. */
export const MARKER_REF_SPAN = BLOCK_PX * EXT_NUM_MAX_BLOCKS * EXT_LAYOUT_MULTIPLIER;   // 512
/** the custom-location offsets (:1391-1395) - CUST-prefixed 1x1 towns
 *  are laid out differently, and DFU corrects the marker by hand */
export const CUSTOM_LOCATION_OFFSET = Object.freeze([-64, +3]);
// the marker trio's colours and sizes (:1616-1649)
const MARKER_CIRCLE_RGBA = [0.75, 0.71, 0.71, 1];        // :1646
const MARKER_STAMP_RGBA = [0.353, 0.086, 0.086, 1];      // :1624
export const MARKER_CIRCLE_UNITS = 12.0;                 // localScale (12,1,12) :1647
export const MARKER_ARROW_SCALE = 2.5;                   // :1616
export const MARKER_STAMP_SCALE = 4.0;                   // :1626
export const MARKER_STAMP_BIAS = 0.8;                    // -normalize(forward) * 0.8 (:1411)
const STAMP_PX = 128;                                    // the rasteriser's edge (meshStamp.js records the oversampling)

// the byte groups (ExteriorAutomap.cs:1482-1541; byte = BuildingType + 1)
const TEMPLE_SET = new Set([12, 15]);
const SHOP_SET = new Set([1, 3, 4, 6, 7, 9, 10, 11, 13, 14]);
const TAVERN_BYTE = 16;
const HOUSE_SET = new Set([2, 5, 8, 17, 18, 19, 20, 21, 22, 23, 24]);
const SHOWALL_SET = new Set([25, 117, 224, 250, 251]);
export const VIEW_MODES = ['original', 'extra', 'all'];   // (showAll, removeGroundFlats) = (f,t) (t,t) (t,f) (:318-337)

/**
 * The four backgrounds (window :283-327). "original" draws NOTHING -
 * dummyPanelAutomap.BackgroundTexture is set to null and AMAP00I0's
 * own map-area art shows through. The three alternatives are FLAT
 * fills, and note they are NOT the dungeon window's three: the
 * exterior's third is the gold (0.7, 0.52, 0.18).
 */
export const BACKGROUNDS = Object.freeze({
  original: null,
  alt1: Object.freeze([0.0, 0.0, 0.0, 1.0]),
  alt2: Object.freeze([0.2, 0.1, 0.3, 1.0]),
  alt3: Object.freeze([0.7, 0.52, 0.18, 1.0]),
});
export const BACKGROUND_NAMES = Object.freeze(['original', 'alt1', 'alt2', 'alt3']);

const DEG = Math.PI / 180;

// zoom memory across close/reopen; recomputed on a new location when
// the reset setting holds (window :513-533)
let _zoomLevel = -1;
let _zoomLocation = null;
let _texVer = 0;   // module-level, the A1 lesson: versioned keys never collide across instances
export function _resetZoomForTests() { _zoomLevel = -1; _zoomLocation = null; }

// ---- the native art (the U23 preload shape) --------------------------
let _art = null;
/** AMAP00I0.IMG (the window) + TOWN00I0.IMG (the caption strip). The
 *  window keeps its keyed fallback for an art-less boot, exactly as
 *  the pause window's does. */
export async function preloadExteriorAutomapArt(deps) {
  if (_art) return _art;
  const [amap, town] = await Promise.all([loadImg(deps, 'AMAP00I0.IMG'), loadImg(deps, 'TOWN00I0.IMG')]);
  _art = { amap, town };
  return _art;
}
export const exteriorAutomapArtLoaded = () => !!_art;
export function _setExteriorAutomapArtForTests(a) { _art = a; }

/** The layout bitmap as an uploadTexture color32. blocks =
 *  [{ x, y, autoMap }] (grid coords + the retained 64x64 bytes);
 *  colours = { temple, shop, tavern, house } packed ABGR. Data row 0
 *  lands at the TOP of the drawn quad; north (+z, descending byte
 *  rows through the per-block flip) is up. Pure. */
export function buildExteriorLayout(gridW, gridH, blocks, mode, colours) {
  const showAll = mode !== 'original';
  const removeGroundFlats = mode !== 'all';
  const w = gridW * BLOCK_PX, h = gridH * BLOCK_PX;
  const colors = new Uint32Array(w * h);   // cleared transparent, byte 0's own colour (:1529-1534)
  for (const b of blocks) {
    const data = b.autoMap;
    if (!data) continue;
    for (let y = 0; y < BLOCK_PX; y++) {
      for (let x = 0; x < BLOCK_PX; x++) {
        let byte = data[y * BLOCK_PX + x];
        if (removeGroundFlats && byte === 0xfb) byte = 0;   // the copy-side strip (BlocksFile.cs:434-440; never in place here)
        if (byte === 0) continue;
        let c;
        if (TEMPLE_SET.has(byte)) c = colours.temple;
        else if (SHOP_SET.has(byte)) c = colours.shop;
        else if (byte === TAVERN_BYTE) c = colours.tavern;
        else if (HOUSE_SET.has(byte)) c = colours.house;
        else if (SHOWALL_SET.has(byte)) { if (!showAll) continue; c = colours.house; }   // ships + specials (:1519-1528)
        else c = (0xff000000 | (byte << 16) | 0x0000ff) >>> 0;   // the debug red (255, 0, byte) (:1535-1540)
        // per-block row flip (:1481) = the navgrid's own law; then
        // whole-map flip so north lands at data row 0 (drawn top)
        const worldRow = b.y * BLOCK_PX + (BLOCK_PX - 1 - y);
        colors[(h - 1 - worldRow) * w + b.x * BLOCK_PX + x] = c;
      }
    }
  }
  return { width: w, height: h, colors };
}

/**
 * UpdatePlayerMarker (:1379-1417) - THE ONE PLACE THE MARKER'S PLACE
 * IS DECIDED, and it is not the location-local position the A2 window
 * used. DFU takes the player's world XZ MODULO one map pixel's terrain
 * span, normalises it, and multiplies by the 8x8-BLOCK reference span
 * (512), NOT by the location's own size - then centres it and applies
 * the custom-location correction. `tileXZ` is the player's position in
 * that map pixel's own frame (world position minus the pixel
 * translation); the answer is in the layout WORLD frame, whose origin
 * is the layout quad's centre and whose unit is one layout pixel.
 * C#'s `%` keeps the sign of its left operand and so does JS's -
 * verbatim, negative frames included.
 */
export function playerMarkerLayoutPos(tileXZ, isCustomLocation = false) {
  const fx = (tileXZ[0] % MARKER_TILE_SCALE) / MARKER_TILE_SCALE;
  const fz = (tileXZ[2] % MARKER_TILE_SCALE) / MARKER_TILE_SCALE;
  const [xOffset, zOffset] = isCustomLocation ? CUSTOM_LOCATION_OFFSET : [0, 0];
  return [
    fx * MARKER_REF_SPAN - MARKER_REF_SPAN * 0.5 + xOffset,
    0,
    fz * MARKER_REF_SPAN - MARKER_REF_SPAN * 0.5 + zOffset,
  ];
}

/**
 * The camera transform, made explicit and PURE so it can be pinned:
 * an orthographic camera looking straight down, turned about -up.
 * Unity's WorldToScreenPoint for such a camera is
 *   px = w/2 + dot(p - c, right) / orthoSize * (h/2) / aspect * aspect
 * which reduces to h/(2*orthoSize) pixels per world unit in BOTH axes
 * (window :864 then :866-867 flips y into the panel's top-down space).
 * `cam` is ui/automapCamera.js's exterior lens; `rect` is the panel in
 * canvas pixels, top-left origin. The yaw sign is automapCamera's own
 * (screen-right = (cos, 0, -sin)).
 */
export function toPanelScreen(cam, rect, worldX, worldZ) {
  const yaw = cam.yawDeg * DEG;
  const k = rect.h / (2 * cam.orthoSize);
  const dx = worldX - cam.center[0], dz = worldZ - cam.center[2];
  const sx = dx * Math.cos(yaw) + dz * -Math.sin(yaw);
  const sy = dx * Math.sin(yaw) + dz * Math.cos(yaw);
  return [rect.x + rect.w / 2 + sx * k, rect.y + rect.h / 2 - sy * k];
}

/** The screen-space rotation a WORLD-axis-aligned quad takes under
 *  that camera: world +x lands at (cos yaw, -sin yaw) in a y-DOWN
 *  screen, which is a rotation of -yaw. */
export const layoutQuadRotation = (cam) => -cam.yawDeg * DEG;

export class ExteriorAutomapWindow {
  /** deps: { locationName, locationId, gridW, gridH,
   *  blocks [{x,y,autoMap}], playerPos() -> location-local [x,y,z],
   *  locOrigin -> the location's origin inside its map pixel (so the
   *  marker law above can see the TILE frame DFU's modulo needs),
   *  isCustomLocation, playerYaw() -> rad, arrowMesh -> the CPU mesh
   *  99900 ({positions, indices}) or null, buildings() -> the
   *  Position-bearing subrecord walk (world/buildingSummaries.js),
   *  discovered() -> discovery records, directory() -> the talk
   *  directory (the pre-S10 name source, still the fallback),
   *  rename(buildingKey, name), compassArt -> { compass, compassBox }
   *  or null }. */
  constructor(deps) {
    this.deps = deps;
    this.done = false;
    this.isChoiceWindow = false;
    this.mode = VIEW_MODES[0];
    this.background = 'original';
    this.chrome = new AutomapChrome(EXTERIOR_ACTIONS);
    this.layoutW = deps.gridW * BLOCK_PX;
    this.layoutH = deps.gridH * BLOCK_PX;
    // ComputeZoom (:1004-1015) through the shared lens; remembered
    // across reopen unless a new location + the reset setting
    const reset = getBool('Map', 'ExteriorMapResetZoomLevelOnNewLocation');
    if (_zoomLevel < 0 || (_zoomLocation !== deps.locationId && reset)) {
      _zoomLevel = computeExteriorZoom(getInt('Map', 'ExteriorMapDefaultZoomLevel', 4, 31));
    }
    _zoomLocation = deps.locationId;
    this.cam = { center: [0, 0, 0], yawDeg: 0, orthoSize: _zoomLevel };
    this.actionFocusPlayerPosition();   // OnPush's last act before UpdateAutomapView (:544)
    this._renderer = null;
    this._tex = null;     // { key, tex, w, h, mode }
    this._stamp = null;   // { key, tex, span, worldPerPx }
    this._disc = null;
    this._plates = null;  // cached solver output for the current view
    this._platesKey = '';
    this._hoverPlate = null;
    this.revealUndiscoveredBuildings = false;   // map_revealbuildings / map_hidebuildings (:1796-1830)
  }

  // ---- the verb table (ui/automapChrome.js answers NAMES) -----------

  /** ActionFocusPlayerPosition (:1293-1299): the camera goes to the
   *  player marker, keeping its own height - here, its centre does. */
  actionFocusPlayerPosition() {
    const p = this.markerPos();
    this.cam = { ...this.cam, center: [p[0], 0, p[2]] };
  }

  /** ActionResetView (:1304-1313): reset the camera position, recompute
   *  the zoom, and reset the nameplate rotation - which in the port is
   *  free, because the corners are always axis-aligned (see the
   *  nameplateLayout header and RotateBuildingNameplates below). */
  actionResetView() {
    this.actionFocusPlayerPosition();
    _zoomLevel = computeExteriorZoom(getInt('Map', 'ExteriorMapDefaultZoomLevel', 4, 31));
    this.cam = { ...this.cam, orthoSize: _zoomLevel, yawDeg: 0 };
  }

  markerPos() {
    const local = this.deps.playerPos?.() ?? [0, 0, 0];
    const o = this.deps.locOrigin ?? [0, 0, 0];
    return playerMarkerLayoutPos([local[0] + o[0], 0, local[2] + o[2]], !!this.deps.isCustomLocation);
  }

  /** the DFU verb names ui/automapChrome.js's EXTERIOR_ACTIONS table
   *  answers, bound to this window's camera. `dt` is the frame's. */
  runVerb(verb, dt) {
    const c = this.cam;
    const pan = (dx, dz) => { this.cam = { ...c, center: [c.center[0] + dx, 0, c.center[2] + dz] }; };
    const yaw = c.yawDeg * DEG;
    // the camera's own screen basis, the same one exteriorDragPan uses
    const right = [Math.cos(yaw), -Math.sin(yaw)];
    const up = [Math.sin(yaw), Math.cos(yaw)];
    switch (verb) {
      // ActionMoveForward/Backward (:1116-1140): the camera's UP with
      // the y component zeroed - under a straight-down lens that is
      // the map's own north-ish axis at the current yaw.
      case 'ActionMoveForward': return pan(up[0] * EXT_SCROLL_UP_DOWN_SPEED * dt, up[1] * EXT_SCROLL_UP_DOWN_SPEED * dt);
      case 'ActionMoveBackward': return pan(-up[0] * EXT_SCROLL_UP_DOWN_SPEED * dt, -up[1] * EXT_SCROLL_UP_DOWN_SPEED * dt);
      case 'ActionMoveLeft': return pan(-right[0] * EXT_SCROLL_LEFT_RIGHT_SPEED * dt, -right[1] * EXT_SCROLL_LEFT_RIGHT_SPEED * dt);
      case 'ActionMoveRight': return pan(right[0] * EXT_SCROLL_LEFT_RIGHT_SPEED * dt, right[1] * EXT_SCROLL_LEFT_RIGHT_SPEED * dt);
      // the four border jumps (:1184-1220): ONE axis each, the other
      // left exactly where it was
      case 'ActionMoveToNorthLocationBorder': return this.jumpToBorder('Top');
      case 'ActionMoveToSouthLocationBorder': return this.jumpToBorder('Bottom');
      case 'ActionMoveToWestLocationBorder': return this.jumpToBorder('Left');
      case 'ActionMoveToEastLocationBorder': return this.jumpToBorder('Right');
      case 'ActionRotateLeft': this.cam = exteriorRotate(c, +EXT_ROTATE_SPEED, dt); return undefined;
      case 'ActionRotateRight': this.cam = exteriorRotate(c, -EXT_ROTATE_SPEED, dt); return undefined;
      case 'ActionRotateAroundPlayerPosLeft':
        this.cam = exteriorRotateAroundPlayerPos(c, +EXT_ROTATE_SPEED, dt, this.markerPos()); return undefined;
      case 'ActionRotateAroundPlayerPosRight':
        this.cam = exteriorRotateAroundPlayerPos(c, -EXT_ROTATE_SPEED, dt, this.markerPos()); return undefined;
      // ActionMoveUpstairs/Downstairs ARE the zoom (:1135-1148 - the
      // translate is commented out and the body is ActionZoom)
      case 'ActionMoveUpstairs': this.cam = exteriorZoom(c, -EXT_ZOOM_SPEED * dt); return undefined;
      case 'ActionMoveDownstairs': this.cam = exteriorZoom(c, +EXT_ZOOM_SPEED * dt); return undefined;
      case 'ActionApplyMaxZoom': this.cam = exteriorApplyMaxZoom(c); return undefined;
      case 'ActionApplyMinZoom': this.cam = exteriorApplyMinZoom(c); return undefined;
      case 'ActionSwitchToNextExteriorAutomapViewMode':
        this.mode = VIEW_MODES[(VIEW_MODES.indexOf(this.mode) + 1) % VIEW_MODES.length]; return undefined;
      case 'ActionFocusPlayerPosition': return this.actionFocusPlayerPosition();
      case 'ActionResetView': return this.actionResetView();
      case 'ActionExit': this.done = true; this.dispose(); return undefined;
      case 'ActionClickSoundOnly': return undefined;   // :1380 - the sound IS the whole handler
      default: return undefined;
    }
  }

  jumpToBorder(border) {
    const pos = getLocationBorderPos(border, this.layoutW, this.layoutH);
    const c = this.cam;
    this.cam = (border === 'Left' || border === 'Right')
      ? { ...c, center: [pos[0], 0, c.center[2]] }
      : { ...c, center: [c.center[0], 0, pos[2]] };
  }

  // ---- input ---------------------------------------------------------

  /** The keyed arms. RECORDED DEPARTURE (module header): one frame of
   *  DFU's per-second speed per press, because this seam has no keyup.
   *  `dt` is the last frame's, captured by tick(). */
  input(action) {
    const dt = this._dt || 1 / 60;
    switch (action) {
      case 'back': case 'char:m': case 'char:M': this.runVerb('ActionExit', dt); return;
      case 'up': case 'char:w': case 'char:W': this.runVerb('ActionMoveForward', dt); return;
      case 'down': case 'char:s': case 'char:S': this.runVerb('ActionMoveBackward', dt); return;
      case 'char:a': case 'char:A': this.runVerb('ActionMoveLeft', dt); return;
      case 'char:d': case 'char:D': this.runVerb('ActionMoveRight', dt); return;
      case 'char:q': case 'char:Q': this.runVerb('ActionRotateLeft', dt); return;
      case 'char:e': case 'char:E': this.runVerb('ActionRotateRight', dt); return;
      case 'plus': this.runVerb('ActionMoveUpstairs', dt); return;
      case 'minus': this.runVerb('ActionMoveDownstairs', dt); return;
      case 'char:1': this.runVerb('ActionApplyMaxZoom', dt); return;    // HotkeySequence_MaxZoom (:1176-1181)
      case 'char:2': this.runVerb('ActionApplyMinZoom', dt); return;
      case 'char:n': case 'char:N': this.jumpToBorder('Top'); return;
      case 'char:b': case 'char:B': this.jumpToBorder('Bottom'); return;
      case 'char:h': case 'char:H': this.jumpToBorder('Left'); return;
      case 'char:l': case 'char:L': this.jumpToBorder('Right'); return;
      case 'char:v': case 'char:V': this.runVerb('ActionSwitchToNextExteriorAutomapViewMode', dt); return;
      case 'char:f': case 'char:F': this.runVerb('ActionFocusPlayerPosition', dt); return;
      case 'char:c': case 'char:C': this.runVerb('ActionResetView', dt); return;
      // the four backgrounds, each on its own key (:1258-1290)
      case 'char:7': this.background = 'original'; return;
      case 'char:8': this.background = 'alt1'; return;
      case 'char:9': this.background = 'alt2'; return;
      case 'char:0': this.background = 'alt3'; return;
      default: return;
    }
  }

  /** The pointer seam (down/move/up) - the chrome's press-hold machine
   *  and the two panel drags. Native 320x200 coordinates. */
  pointer(phase, nx, ny, button = 0) {
    const out = this.chrome.pointer(phase, nx, ny, button);
    for (const v of out.verbs) this.runVerb(v, this._dt || 1 / 60);
    if (out.drag) {
      if (out.drag.kind === 'pan') {
        // dragSpeed is per NATIVE pixel here, as DFU's is per screen
        // pixel of its own native panel (:730-740)
        this.cam = exteriorDragPan(this.cam, out.drag.dx, out.drag.dy);
      } else if (out.drag.kind === 'rotate') {
        // ActionRotate(dragRotateSpeed * bias.x) with dt folded in as 1
        // - the drag's bias IS the amount (:748-752)
        this.cam = exteriorRotate(this.cam, EXT_DRAG_ROTATE_SPEED * out.drag.dx, 1);
      }
    }
    if (phase === 'move') this._hoverAt = [nx, ny];
    if (phase === 'down' && out.doubleClick && button === 0) this._renameAt(nx, ny);
    return out;
  }

  /** townTalk's click seam still exists; a native window that has a
   *  pointer seam takes the press through it so the two never disagree. */
  click(nx, ny, isRight = false) { this.pointer('down', nx, ny, isRight ? 2 : 0); }
  hover(nx, ny) { this.pointer('move', nx, ny, 0); }

  /** PanelAutomap_OnMouseScrollUp/Down (:1319-1327): ActionZoom at the
   *  wheel speed, and ONLY over the render panel - the exterior grid
   *  button registers no scroll handler at all. */
  wheel(dir) {
    const v = this._hoverAt ?? null;
    if (v && !(v[0] >= CHROME_RECTS.panel.x && v[0] < CHROME_RECTS.panel.x + CHROME_RECTS.panel.w
      && v[1] >= CHROME_RECTS.panel.y && v[1] < CHROME_RECTS.panel.y + CHROME_RECTS.panel.h)) return;
    this.cam = exteriorZoom(this.cam, dir < 0 ? -EXT_ZOOM_SPEED_MOUSE_WHEEL : +EXT_ZOOM_SPEED_MOUSE_WHEEL);
  }

  /** DFU's Update(): the held buttons run once per frame, in its own
   *  poll order. */
  tick(dt) {
    this._dt = dt;
    const { verbs } = this.chrome.tick(dt);
    for (const v of verbs) this.runVerb(v, dt);
    _zoomLevel = this.cam.orthoSize;   // OnPop stores the level (:551)
  }

  dispose() {
    const r = this._renderer;
    if (!r) return;
    if (this._tex) { r.releaseTexture('amap', this._tex.key); this._tex = null; }
    if (this._stamp) { r.releaseTexture('amap', this._stamp.key); this._stamp = null; }
    if (this._disc) { r.releaseTexture('amap', this._disc.key); this._disc = null; }
  }

  // ---- the composition ------------------------------------------------

  _ensureTexture(renderer) {
    if (this._tex?.mode === this.mode) return;
    const colours = {
      temple: hexColor32(getString('Map', 'AutomapTempleColor'), 0xffc37d45),
      shop: hexColor32(getString('Map', 'AutomapShopColor'), 0xff1855be),
      tavern: hexColor32(getString('Map', 'AutomapTavernColor'), 0xff307555),
      house: hexColor32(getString('Map', 'AutomapHouseColor'), 0xff283c45),
    };
    const bmp = buildExteriorLayout(this.deps.gridW, this.deps.gridH, this.deps.blocks, this.mode, colours);
    if (this._tex) renderer.releaseTexture('amap', this._tex.key);
    const key = `ext-${++_texVer}`;
    this._tex = { key, tex: renderer.uploadTexture('amap', key, bmp), w: bmp.width, h: bmp.height, mode: this.mode };
  }

  /** The arrow/stamp bitmap. Mesh 99900 arrives through an async
   *  pipeline, so a first frame with no mesh yet builds the EMPTY
   *  stamp (units 0 - the two mesh layers simply do not draw) and the
   *  first frame that has one replaces it, once. */
  _ensureStamp(renderer) {
    if (this._stamp && this._stamp.units > 0) return;
    const mesh = this.deps.arrowMesh?.() ?? null;
    if (this._stamp && !mesh) return;
    if (this._stamp) renderer.releaseTexture('amap', this._stamp.key);
    const bmp = rasterizeTopDown(mesh, STAMP_PX);
    const key = `ext-stamp-${++_texVer}`;
    this._stamp = {
      key, tex: renderer.uploadTexture('amap', key, bmp),
      // the whole bitmap covers this many world units at scale 1
      units: bmp.span > 0 ? bmp.width * bmp.worldPerPx : 0,
    };
    if (this._disc) return;
    const disc = rasterizeDisc(64);
    const dkey = `ext-disc-${++_texVer}`;
    this._disc = { key: dkey, tex: renderer.uploadTexture('amap', dkey, disc) };
  }

  /** The panel rect in canvas pixels (dummyPanelAutomap, :335-336). */
  panelRect(m) {
    const r = CHROME_RECTS.panel;
    return { x: m.ox + r.x * m.s, y: m.oy + r.y * m.s, w: r.w * m.s, h: r.h * m.s };
  }

  draw(renderer, canvas, font, s) {
    this._renderer = renderer;
    this._ensureTexture(renderer);
    this._ensureStamp(renderer);
    const m = nativeMetrics(canvas);
    // ScreenDimColor is Color.clear (nativePanel records why) - the
    // letterbox is painted, nothing is dimmed
    renderer.drawScreenQuad(null, { x: 0, y: 0, w: canvas.width, h: canvas.height }, undefined, SCREEN_DIM);
    if (_art) drawImg(renderer, _art.amap, m, 0, 0, NATIVE_W, NATIVE_H);
    else drawRect(renderer, m, 0, 0, NATIVE_W, NATIVE_H, [0.04, 0.03, 0.02, 1]);   // the art-less fallback shell
    const rect = this.panelRect(m);
    const bg = BACKGROUNDS[this.background];
    if (bg) renderer.drawScreenQuad(null, rect, undefined, bg);
    this._drawMap(renderer, rect, m);
    this._drawNameplates(renderer, rect, font, m);
    this._drawChrome(renderer, canvas, font, m, s);
  }

  /** THE PAINT ORDER (:1379-1417 read as y-order): circle, stamp,
   *  layout, arrow. The circle and the stamp show THROUGH the layout's
   *  transparent street pixels - do not reorder these four. */
  _drawMap(renderer, rect, m) {
    renderer.screenScissor(rect, () => {
      const k = rect.h / (2 * this.cam.orthoSize);
      const marker = this.markerPos();
      const [mx, my] = toPanelScreen(this.cam, rect, marker[0], marker[2]);
      const yaw = this.deps.playerYaw?.() ?? 0;
      // the arrow's screen angle: the player's yaw in world, then the
      // map's own turn (layoutQuadRotation)
      const rad = yaw + layoutQuadRotation(this.cam);
      const stampUnits = this._stamp.units;

      // 1. the circle (y = -20)
      const cd = MARKER_CIRCLE_UNITS * k;
      renderer.drawScreenQuad(this._disc.tex,
        { x: mx - cd / 2, y: my - cd / 2, w: cd, h: cd }, undefined, MARKER_CIRCLE_RGBA);

      // 2. the dark stamp (y = -10), offset by -normalize(forward)*0.8
      if (stampUnits > 0) {
        const fx = Math.sin(yaw), fz = Math.cos(yaw);   // the player's forward, port convention
        const [sx, sy] = toPanelScreen(this.cam, rect,
          marker[0] - fx * MARKER_STAMP_BIAS, marker[2] - fz * MARKER_STAMP_BIAS);
        const sd = stampUnits * MARKER_STAMP_SCALE * k;
        renderer.drawScreenQuad(this._stamp.tex,
          { x: sx - sd / 2, y: sy - sd / 2, w: sd, h: sd }, undefined, MARKER_STAMP_RGBA,
          { rotate: { rad, px: sx, py: sy } });
      }

      // 3. the layout quad (y = +0.01) - a WORLD-axis-aligned quad, so
      // on screen it is the map's own turn about its centre
      const [lx, ly] = toPanelScreen(this.cam, rect, 0, 0);
      const lw = this._tex.w * k, lh = this._tex.h * k;
      renderer.drawScreenQuad(this._tex.tex, { x: lx - lw / 2, y: ly - lh / 2, w: lw, h: lh }, undefined, undefined,
        { rotate: { rad: layoutQuadRotation(this.cam), px: lx, py: ly } });

      // 4. the arrow (y = +0.1), unlit texture - the port's stamp is a
      // silhouette, so it draws WHITE rather than mesh 99900's skin
      if (stampUnits > 0) {
        const ad = stampUnits * MARKER_ARROW_SCALE * k;
        renderer.drawScreenQuad(this._stamp.tex,
          { x: mx - ad / 2, y: my - ad / 2, w: ad, h: ad }, undefined, [1, 1, 1, 1],
          { rotate: { rad, px: mx, py: my } });
      }
    });
  }

  /**
   * The plates. c2/S10 HALF B moved the ANCHOR: DFU walks EVERY
   * building of EVERY block and anchors on the building subrecord's own
   * Position (ExteriorAutomap.cs:664-665), where the port used to
   * anchor on the discovered exterior DOOR. Every plate in every town
   * moves; the layout pins were re-baselined with the move.
   *
   * THE CORNERS STAY AXIS-ALIGNED. RotateBuildingNameplates (:370-386)
   * rotates the stored corners by Quaternion.AngleAxis(-angle,
   * forward), but every rotate action calls UpdateAutomapView, which
   * recomputes ALL FOUR corners axis-aligned from textLabel.Position
   * (window :892-896) BEFORE ComputeNameplateOffsets ever reads them,
   * and the drawn label is a screen-space TextLabel that never rotates
   * either. That corner rotation is DEAD CODE in DFU and is
   * deliberately not ported.
   */
  _drawNameplates(renderer, rect, font, m) {
    if (!font) return;
    const plates = this.buildPlates(font, m);
    if (!plates.length) { this._hoverPlate = null; return; }
    const key = `${this.cam.center[0]},${this.cam.center[2]},${this.cam.orthoSize},${this.cam.yawDeg},${plates.length}`;
    if (this._platesKey !== key) {
      this._platesKey = key;
      this._plates = resolveNameplates(plates);
    }
    renderer.screenScissor(rect, () => {   // RectRestrictedRenderArea (:868-869)
      this._hoverPlate = null;
      const hv = this._hoverAt ? [m.ox + this._hoverAt[0] * m.s, m.oy + this._hoverAt[1] * m.s] : null;
      for (let i = 0; i < plates.length; i++) {
        const p = plates[i], r = this._plates[i] ?? { offY: 0, replaced: false };
        const y = p.y + r.offY;
        drawText(renderer, font, r.replaced ? '*' : p.text, p.x, y - p.h / 2, p.scale, NAMEPLATE_YELLOW);
        if (hv && hv[0] >= p.x && hv[0] < p.x + p.w && hv[1] >= y - p.h / 2 && hv[1] < y + p.h / 2) {
          this._hoverPlate = p;   // ToolTipDelay 0 (:874) - it shows at once
        }
      }
    });
  }

  /**
   * UpdateAutomapView's plate build (:860-880) + CreateBuildingNameplates'
   * name law (:665-720). Exposed so the pins can read the plate set
   * without a renderer.
   *  - a discovered NON-residence (or an override name) shows its
   *    displayName, with customUserDisplayName drawn in its place while
   *    the TOOLTIP keeps the canonical one (:882-885);
   *  - a discovered RESIDENCE shows a plate only when an active quest
   *    marked it - FLAGGED, the port's quest bridge exposes no
   *    locationWasMarkedOnMapByNPC, so the arm reads a `questName` the
   *    host may supply and is otherwise silent;
   *  - an UNdiscovered building shows a plate only under
   *    revealUndiscoveredBuildings, from the BuildingNames table
   *    (:712-719);
   *  - a plate with an empty name is never created at all (:786).
   */
  buildPlates(font, m) {
    const rect = this.panelRect(m);
    const discovered = new Map((this.deps.discovered?.() ?? []).map((r) => [r.buildingKey, r]));
    const byKey = new Map((this.deps.directory?.() ?? []).map((d) => [d.buildingKey, d]));
    // TextScale = max(1.4, 60/orthographicSize * LocalScale) (:26-27,
    // :866), halved for the port's 16px-cell FNT glyphs (A2's pick)
    const scale = Math.max(1.4, (60 / this.cam.orthoSize) * m.s) / 2;
    const lineH = (font.fnt?.fixedHeight ?? 6) * scale;
    const out = [];
    for (const b of this.deps.buildings?.() ?? []) {
      const rec = discovered.get(b.buildingKey) ?? null;
      let name = '';
      let custom = '';
      if (rec) {
        if (!b.isResidence || rec.isOverrideName) {
          name = rec.displayName || byKey.get(b.buildingKey)?.name || '';
          custom = rec.customUserDisplayName || '';
        } else if (b.questName) {
          name = b.questName;   // FLAGGED: the port has no locationWasMarkedOnMapByNPC
        }
      } else if (this.revealUndiscoveredBuildings) {
        name = b.name || '';
      }
      if (!name) continue;
      const anchor = nameplateAnchor(b.blockX, b.blockY, b.position);
      const [sx, sy] = toPanelScreen(this.cam, rect, anchor[0] - this.layoutW / 2, anchor[1] - this.layoutH / 2);
      const text = custom || name;
      out.push({
        x: sx, y: sy, w: measureText(font.fnt, text) * scale, h: lineH,
        text, name, scale, buildingKey: b.buildingKey, isResidence: !!b.isResidence,
      });
    }
    return out;
  }

  /** TextLabel_OnMouseDoubleClick -> SetCustomBuildingName (:857-899):
   *  a RESIDENCE cannot be renamed (its name is quest-generated and
   *  temporary), and the input lands on the discovery record. */
  _renameAt(nx, ny) {
    const p = this._hoverPlate;
    if (!p || p.isResidence) return;
    this.deps.rename?.(p.buildingKey, p.name);
  }

  /** The native chrome: the caption strip's three live swatches
   *  (:466-476), the compass on the MAP camera's yaw, and the hovered
   *  plate's tooltip. */
  _drawChrome(renderer, canvas, font, m, s) {
    if (_art) {
      drawImg(renderer, _art.town, m, CAPTION_STRIP.x, CAPTION_STRIP.y, CAPTION_STRIP.w, CAPTION_STRIP.h);
      for (const [name, key] of [['temple', 'AutomapTempleColor'], ['shop', 'AutomapShopColor'], ['tavern', 'AutomapTavernColor']]) {
        const r = CAPTION_SWATCHES[name];
        const c = hexColor32(getString('Map', key), name === 'temple' ? 0xffc37d45 : name === 'shop' ? 0xff1855be : 0xff307555);
        drawRect(renderer, m, CAPTION_STRIP.x + r.x, CAPTION_STRIP.y + r.y, r.w, r.h,
          [(c & 0xff) / 255, ((c >>> 8) & 0xff) / 255, ((c >>> 16) & 0xff) / 255, 1]);
      }
    }
    const art = this.deps.compassArt ?? null;
    if (art?.compass && art?.compassBox) {
      // HUDCompass on the AUTOMAP camera (:459-463) - the strip reads
      // the MAP's yaw, never the player's
      const r = CHROME_RECTS.compass;
      const scroll = compassScroll(compassHeading01(this.cam.yawDeg));
      renderer.drawScreenQuad(art.compass.tex,
        {
          x: m.ox + (r.x + COMPASS_BOX_OUTLINE) * m.s, y: m.oy + (r.y + COMPASS_BOX_OUTLINE) * m.s,
          w: (r.w - COMPASS_BOX_OUTLINE * 2) * m.s, h: art.compass.h * m.s,
        },
        { u0: scroll / art.compass.w, v0: 0, u1: (scroll + COMPASS_BOX_INTERIOR) / art.compass.w, v1: 1 });
      renderer.drawScreenQuad(art.compassBox.tex,
        { x: m.ox + r.x * m.s, y: m.oy + r.y * m.s, w: r.w * m.s, h: r.h * m.s });
    }
    if (!font) return;
    if (!_art) {
      // the keyed fallback shell: the location name and the controls
      drawText(renderer, font, `${this.deps.locationName ?? ''} - ${this.mode} view`, m.ox + 4 * s, m.oy + 191 * s, s, [0.9, 0.9, 0.75, 1]);
    }
    // the hovered plate's tooltip carries the CANONICAL name even when
    // a custom one is drawn (:880-885), at ToolTipDelay 0
    const t = this._hoverPlate;
    if (t) {
      const w = measureText(font.fnt, t.name) * m.s + 4 * m.s;
      const x = Math.min(t.x, m.ox + (NATIVE_W - 2) * m.s - w);
      const y = t.y + 6 * m.s;
      renderer.drawScreenQuad(null, { x, y, w, h: (font.fnt?.fixedHeight ?? 6) * m.s + 2 * m.s }, undefined, [0, 0, 0, 0.75]);
      drawText(renderer, font, t.name, x + 2 * m.s, y + 1 * m.s, m.s, [1, 1, 1, 1]);
    }
  }
}
