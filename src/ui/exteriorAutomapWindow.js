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
// ui/meshStamp.js. THE HOTKEYS ARE DFU'S OWN: all thirty ExtAutomap*
// rows of systems/dialogShortcuts.js (DialogShortcuts.txt:267-296)
// through the same ShortcutOrFallback door ui/automapWindow.js reads
// the Automap* half with, in DFU's two poll classes.
//
// ROAD-E E1 RETIRED ONE OF THE DEPARTURES THIS HEADER CARRIED. It read:
// "THE HELD KEYBOARD ARMS ARE EDGE-DRIVEN... townTalk's overlay seam
// delivers keydown and no keyup, so each press applies ONE FRAME of
// DFU's per-second speed and the browser's key repeat supplies the
// hold." The key-UP route now exists in every host that owns an
// overlay slot, so this window keeps InputManager's held-key
// dictionary (`_heldCodes`) and polls the twenty IsPressedWith arms
// once per FRAME in tick() - the same per-frame hold the chrome's
// mouse machine always had, at the per-SECOND speeds the constants
// name. The two-phase toggle-close closes on DFU's own key UP with it.
// DFU's focus, reset, view-mode and background arms are IsDownWith
// (:599-641), edge driven in the reference too, so those ten were
// always parity.
//
// DEPARTURES THAT STAND (recorded, Port-Ledger):
//  - the plate label is the port's FNT text, not DFU's yellow-reloaded
//    DaggerfallFont Texture2D, so TextScale is halved for the port's
//    16px-cell glyphs (the A2 legibility pick, kept).
//  - the arrow draws as a WHITE silhouette tinted at the blit, not with
//    mesh 99900's own skin. DFU's arrow carries Unlit/Texture and its
//    stamp Unlit/Color, so only the ARROW loses anything - and at
//    ~8.5 native px across (see meshStamp.js's arithmetic) what it
//    loses is a handful of texels.
//
// ROAD-D D5 CLOSED THE RESIDUE THIS WINDOW OWNED, and both halves
// closed because the blocker each was written against had gone stale:
//  - THE RESIDENCE-WITH-ACTIVE-QUEST PLATE ARM (:682-709). The port
//    DOES expose locationWasMarkedOnMapByNPC - systems/topicTree.js
//    :394-419 is IsBuildingQuestResource verbatim, flag and override
//    name both - it simply had no consumer. residenceQuestName +
//    stampResidenceQuestNames below are ExteriorAutomap.cs's own
//    double loop over it (its three quirks kept and named at the
//    site), stamped onto the summaries rows at window-open by the host
//    that has a quest machine, which is where DFU resolves the name
//    too. `questName` finally has a producer, so a quest-marked
//    residence is named on the town map instead of being silently
//    plateless.
//  - THE TEN BUTTON TOOLTIPS (UpdateButtonToolTipsText, :230-239).
//    Internal_Strings.csv:908-917 now sits beside the dungeon block in
//    ui/automapText.js, formatted by THE SAME two laws
//    (ShortcutOrFallback onto KeyCode.Home, String.Format over
//    HotkeySequence.ToString) with the ExtAutomap* shortcut names, and
//    the chrome's own hover clock - which already returned the rested
//    rect and was being thrown away here - drives them.
//
// ROAD-E E3 CLOSED THE LAST FLAG ON THIS HEADER (2026-09-02):
//  - map_revealbuildings / map_hidebuildings (:1796-1830) are
//    REGISTERED now, on the real ConsoleCommandsDatabase
//    (systems/consoleCommands.js - Wenzil.Console's own, which is what
//    was missing, not the flag). The registrar is at the foot of this
//    file, ExteriorAutoMapConsoleCommands verbatim: both names, both
//    descriptions, both usages, DFU's IsPlayerInside gate and its four
//    answer strings. `revealUndiscoveredBuildings` moved to MODULE
//    scope with them, because ExteriorAutomap.cs:230-234 is a property
//    on the persistent component and the console sets it with no map
//    open; the window's own property is an accessor over it, so every
//    reader and pin here is unchanged. The console WINDOW is a
//    recorded departure (Ledger A): DFU's is the third-party
//    UnityConsole addon's Unity uGUI prefab, not DFU source.
//
// THE COPY LAW: getBlockAutoMap's removeGroundFlats mutates the
// CACHED block array in place, and cityNavigation carves the navgrid
// from that same array - so this window never touches it: bytes are
// read straight from the retained autoMapData and 0xfb is dropped
// per-pixel during the paint.

import { drawText, measureText } from './text.js';
import { getBool, getInt, getString } from '../systems/settings.js';
import { hexColor32 } from './automapWindow.js';
import { shortcutOrFallback, exteriorAutomapTooltipFor } from './automapText.js';
import { bindings } from './input.js';
import { getBinding } from '../systems/inputActions.js';
import { normalizeCode, keyboardModifiers, checkSetModifiers } from '../systems/dialogShortcuts.js';
import { audio } from '../systems/audio.js';
import { SOUND } from '../systems/soundClips.js';
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
import { drawCompassStrip } from './hud.js';   // ONE HOME for the strip (hud.js:377-378)
import { drawToolTipBox } from './toolTip.js';
import { GLOBAL_SCALE } from '../world/meshReader.js';
import { registerCommand } from '../systems/consoleCommands.js';   // E3: the console command database

// E3: RevealUndiscoveredBuildings (:230-234) - the persistent
// component's flag, set by the console with no window open and read by
// the next one that opens.
let _revealUndiscoveredBuildings = false;   // map_revealbuildings / map_hidebuildings (:1796-1830)

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
/** the custom-location offsets (:1391-1395). DFLocation.HasCustomLocationPosition
 *  (DFLocation.cs:87-97, ported at world/locationLayout.js:30) picks out 1x1
 *  locations whose block 0 carries the CUST prefix; those are laid out
 *  differently, and DFU corrects the marker by hand.
 *
 *  NOT towns - this comment said "towns" until a MAPS.BSA sweep counted them.
 *  EXACTLY EIGHT locations in the whole file qualify, and every one is
 *  locationType 4 (DungeonLabyrinth): the main-story dungeon exteriors
 *  Scourg Barrow (CUSTAA10, Dragontail Mountains), Direnni Tower (CUSTAA06,
 *  Isle of Balfiera), Shedungent (CUSTAA19, Wrothgarian Mountains),
 *  Privateer's Hold (CUSTAA30, Daggerfall), Woodborne Hall (CUSTAA29,
 *  Wayrest), Orsinium (CUSTAA09, Orsinium Area), Lysandus' Tomb (CUSTAA08,
 *  Menevia) and Castle Llugwych (CUSTAA07, Ykalon) - eight of the fourteen
 *  MAIN_STORY_DUNGEON_IDS. Zero towns take the correction, and DFU's own
 *  wording (DFLocation.cs:87) says "1x1 locations", not towns. */
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
/** ROTATION memory across close/reopen, and it is DFU's own field, not
 *  a convenience: `cameraTransformRotationSaved` (ExteriorAutomap.cs:88
 *  - "camera rotation is saved so that after closing and reopening
 *  exterior automap the camera transform settings can be restored") is
 *  written by UpdateAutomapStateOnWindowPop (:285-288) and re-applied
 *  by UpdateAutomapStateOnWindowPush (:263-270), which the window runs
 *  at the top of every OnPush (:500). The zoom lives in the WINDOW and
 *  the rotation in the automap script precisely because the
 *  orthographicSize line beside that assignment is commented out. */
let _yawDeg = 0;
let _texVer = 0;   // module-level, the A1 lesson: versioned keys never collide across instances
export function _resetZoomForTests() { _zoomLevel = -1; _zoomLocation = null; _yawDeg = 0; }

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

/**
 * THE DOWN-CLASS HOTKEYS (:599-641), in DFU's own poll order.
 * `IsDownWith` is InputManager.GetKeyDown - the EDGE - so these ten
 * are parity here, not a departure: the port's seam delivers exactly
 * one down per press.
 */
export const EXT_HOTKEYS_DOWN = Object.freeze([
  'ExtAutomapFocusPlayerPosition',
  'ExtAutomapResetView',
  'ExtAutomapSwitchToNextExteriorAutomapViewMode',
  'ExtAutomapSwitchToExteriorAutomapViewModeOriginal',
  'ExtAutomapSwitchToExteriorAutomapViewModeExtra',
  'ExtAutomapSwitchToExteriorAutomapViewModeAll',
  'ExtAutomapSwitchToExteriorAutomapBackgroundOriginal',
  'ExtAutomapSwitchToExteriorAutomapBackgroundAlternative1',
  'ExtAutomapSwitchToExteriorAutomapBackgroundAlternative2',
  'ExtAutomapSwitchToExteriorAutomapBackgroundAlternative3',
]);

/**
 * THE PRESSED-CLASS HOTKEYS (:642-720), in DFU's own poll order.
 * `IsPressedWith` is InputManager.GetKey - HELD, polled every frame,
 * which is why every speed these carry is per-SECOND. ROAD-E E1 built
 * the key-UP route the module header's departure was waiting on, so
 * this class is polled once per FRAME here too (`_tickHeldHotkeys`)
 * rather than fired on the browser's auto-repeat.
 */
export const EXT_HOTKEYS_HELD = Object.freeze([
  'ExtAutomapMoveForward', 'ExtAutomapMoveBackward',
  'ExtAutomapMoveLeft', 'ExtAutomapMoveRight',
  'ExtAutomapMoveToNorthLocationBorder', 'ExtAutomapMoveToSouthLocationBorder',
  'ExtAutomapMoveToWestLocationBorder', 'ExtAutomapMoveToEastLocationBorder',
  'ExtAutomapRotateLeft', 'ExtAutomapRotateRight',
  'ExtAutomapRotateAroundPlayerPosLeft', 'ExtAutomapRotateAroundPlayerPosRight',
  'ExtAutomapUpstairs', 'ExtAutomapDownstairs',
  'ExtAutomapZoomIn', 'ExtAutomapZoomOut',
  'ExtAutomapMaxZoom1', 'ExtAutomapMinZoom1', 'ExtAutomapMinZoom2', 'ExtAutomapMaxZoom2',
]);

/** Which chrome VERB each hotkey runs - the same table the buttons
 *  answer, so a button and its hotkey cannot drift apart (the dungeon
 *  window's HOTKEY_VERBS, one window over). */
export const EXT_HOTKEY_VERBS = Object.freeze({
  ExtAutomapFocusPlayerPosition: 'ActionFocusPlayerPosition',
  ExtAutomapResetView: 'ActionResetView',
  ExtAutomapSwitchToNextExteriorAutomapViewMode: 'ActionSwitchToNextExteriorAutomapViewMode',
  ExtAutomapSwitchToExteriorAutomapViewModeOriginal: 'ActionSwitchToExteriorAutomapViewModeOriginal',
  ExtAutomapSwitchToExteriorAutomapViewModeExtra: 'ActionSwitchToExteriorAutomapViewModeExtra',
  ExtAutomapSwitchToExteriorAutomapViewModeAll: 'ActionSwitchToExteriorAutomapViewModeAll',
  ExtAutomapMoveForward: 'ActionMoveForward',
  ExtAutomapMoveBackward: 'ActionMoveBackward',
  ExtAutomapMoveLeft: 'ActionMoveLeft',
  ExtAutomapMoveRight: 'ActionMoveRight',
  ExtAutomapMoveToNorthLocationBorder: 'ActionMoveToNorthLocationBorder',
  ExtAutomapMoveToSouthLocationBorder: 'ActionMoveToSouthLocationBorder',
  ExtAutomapMoveToWestLocationBorder: 'ActionMoveToWestLocationBorder',
  ExtAutomapMoveToEastLocationBorder: 'ActionMoveToEastLocationBorder',
  ExtAutomapRotateLeft: 'ActionRotateLeft',
  ExtAutomapRotateRight: 'ActionRotateRight',
  ExtAutomapRotateAroundPlayerPosLeft: 'ActionRotateAroundPlayerPosLeft',
  ExtAutomapRotateAroundPlayerPosRight: 'ActionRotateAroundPlayerPosRight',
  ExtAutomapUpstairs: 'ActionMoveUpstairs',
  ExtAutomapDownstairs: 'ActionMoveDownstairs',
  // :700-708 - the ZoomIn/ZoomOut arms are `ActionZoom(-/+zoomSpeed *
  // Time.unscaledDeltaTime)` written out inline, which is BODY FOR
  // BODY what ActionMoveUpstairs/Downstairs do (:1132-1150). Two key
  // rows, one law - so they take the same verb rather than a new name
  // the reference does not have.
  ExtAutomapZoomIn: 'ActionMoveUpstairs',
  ExtAutomapZoomOut: 'ActionMoveDownstairs',
  // and the four band-end rows, with DFU's own odd pairing kept:
  // MinZoom2 is Ctrl-KeypadPlus and MaxZoom2 is Ctrl-KeypadMinus
  ExtAutomapMaxZoom1: 'ActionApplyMaxZoom',
  ExtAutomapMinZoom1: 'ActionApplyMinZoom',
  ExtAutomapMinZoom2: 'ActionApplyMinZoom',
  ExtAutomapMaxZoom2: 'ActionApplyMaxZoom',
});

/** The four background rows are not verbs - each assigns a texture to
 *  dummyPanelAutomap and nothing else (:1258-1290). */
export const EXT_BACKGROUND_HOTKEYS = Object.freeze({
  ExtAutomapSwitchToExteriorAutomapBackgroundOriginal: 'original',
  ExtAutomapSwitchToExteriorAutomapBackgroundAlternative1: 'alt1',
  ExtAutomapSwitchToExteriorAutomapBackgroundAlternative2: 'alt2',
  ExtAutomapSwitchToExteriorAutomapBackgroundAlternative3: 'alt3',
});

/**
 * THE RESIDENCE-WITH-ACTIVE-QUEST NAME (ExteriorAutomap.cs:693-709),
 * ported as its own double loop rather than folded into
 * IsBuildingQuestResource, because DFU's two loops do NOT ask the same
 * question and the difference is observable.
 *
 *   foreach active quest -> foreach Place resource
 *     if (place.SiteDetails.buildingKey == discoveredBuilding.buildingKey
 *         && TalkManager.IsBuildingQuestResource(CurrentMapID, key, ...))
 *       if (locationWasMarkedOnMapByNPC)
 *         buildingQuestName = place.SiteDetails.buildingName;
 *
 * THREE QUIRKS, all kept:
 *  - the OUTER guard tests the buildingKey ALONE while
 *    IsBuildingQuestResource tests mapID AND buildingKey (topicTree.js
 *    :394-419). A buildingKey is location-relative
 *    (BuildingDirectory.MakeBuildingKey over layout x/y + record
 *    index), so two towns really can share one - and when a place in
 *    ANOTHER town matches the key while a place HERE is the one that
 *    was marked on the map, the name that lands is the OUTER place's,
 *    not the matched one's. The C# comment beside it ("same as
 *    overrideBuildingName") is true of the common case only;
 *  - `&&` SHORT-CIRCUITS, so IsBuildingQuestResource is never called
 *    for a place whose key does not match. That matters because the
 *    call is not free and because it is what makes the outer guard
 *    load-bearing at all;
 *  - there is NO break. The loops run to the end, so the LAST marked
 *    match wins, not the first.
 *
 * `questSource` is the port's QuestMachine + TalkManager pair:
 * { getAllActiveQuestIds(), getQuest(id), isBuildingQuestResource(
 * mapID, buildingKey) }. Pure - no host, no window.
 */
export function residenceQuestName(questSource, mapID, buildingKey) {
  let buildingQuestName = '';   // string.Empty if building not involved in active quest
  for (const questID of questSource?.getAllActiveQuestIds?.() ?? []) {
    const quest = questSource.getQuest?.(questID);
    if (!quest) continue;
    for (const resource of quest.resources?.values?.() ?? []) {
      if (!resource.isPlace) continue;   // GetAllResources(typeof(Place))
      if (resource.siteDetails?.buildingKey !== buildingKey) continue;
      const r = questSource.isBuildingQuestResource?.(mapID, buildingKey);
      if (!r?.isQuestResource) continue;
      if (r.locationWasMarkedOnMapByNPC) buildingQuestName = resource.siteDetails.buildingName ?? '';
    }
  }
  return buildingQuestName;
}

/**
 * The stamp CreateBuildingNameplates makes on its way past each
 * building (:672-709), landed on the summaries rows the two hosts hand
 * this window - which is where DFU does it too: the name is resolved
 * ONCE per nameplate build (:273 on window push, :917 after a rename),
 * never per frame, and buildPlates below only reads the field.
 *
 * THE GATE IS DFU'S WHOLE LADDER, not just "is it a residence":
 * the quest arm is the `else if` of `!IsResidence || isOverrideName`
 * (:676-682), so an override-named residence takes the display-name
 * arm and never reaches this at all, and an UNdiscovered building
 * takes the revealUndiscoveredBuildings arm instead.
 *
 * Mutates and returns `summaries` - they are built fresh at every
 * open, and the field has no other producer.
 */
export function stampResidenceQuestNames(summaries, discoveredRows, questSource, mapID) {
  const discovered = new Map((discoveredRows ?? []).map((r) => [r.buildingKey, r]));
  for (const b of summaries ?? []) {
    const rec = discovered.get(b.buildingKey);
    if (!rec || !b.isResidence || rec.isOverrideName) continue;
    b.questName = residenceQuestName(questSource, mapID, b.buildingKey);
  }
  return summaries;
}

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
    // The raw-code seam townTalk.js:312 forks on, the same one the
    // dungeon window takes (automapWindow.js:498) - it is that fork's
    // switch, not a semantic claim about choice windows, and without it
    // ui/input.js's cooked alphabet cannot spell an arrow, an F-key,
    // PageUp/Down, a keypad key or ANY modifier, which is nine tenths
    // of DFU's ExtAutomap table.
    this.isChoiceWindow = true;
    this.mode = VIEW_MODES[0];
    this.background = 'original';
    this.chrome = new AutomapChrome(EXTERIOR_ACTIONS);
    // "Store toggle closed binding for this window" - read ONCE at push
    // (window :489-495), so rebinding AutoMap while the map stands open
    // does not change the key that closes it.
    this.automapBinding = getBinding(bindings(), 'AutoMap');
    this.isCloseWindowDeferred = false;
    // ROAD-E E1: InputManager's held-key dictionary for this window,
    // the dungeon window's member verbatim (automapWindow.js's own
    // `_heldCodes`/`_keyModifiers`) - GetKey is a STATE, so the seam's
    // presses and releases are folded back into one.
    this._heldCodes = new Set();
    this._keyModifiers = keyboardModifiers();
    this.layoutW = deps.gridW * BLOCK_PX;
    this.layoutH = deps.gridH * BLOCK_PX;
    // ComputeZoom (:1004-1015) through the shared lens; remembered
    // across reopen unless a new location + the reset setting
    const reset = getBool('Map', 'ExteriorMapResetZoomLevelOnNewLocation');
    const newLocation = _zoomLocation !== deps.locationId;
    // THE NEW-LOCATION SIGNAL ZEROES THE ROTATION UNCONDITIONALLY: the
    // window's reset arm (:513-521) calls ResetCameraPosition() ->
    // ResetCameraTransform's Quaternion.Euler(90,0,0) (:1019-1032)
    // outside the setting's `if`, and only the zoom recompute beside it
    // is behind ExteriorMapResetZoomLevelOnNewLocation.
    if (newLocation) _yawDeg = 0;
    if (_zoomLevel < 0 || (newLocation && reset)) {
      _zoomLevel = computeExteriorZoom(getInt('Map', 'ExteriorMapDefaultZoomLevel', 4, 31));
    }
    _zoomLocation = deps.locationId;
    this.cam = { center: [0, 0, 0], yawDeg: _yawDeg, orthoSize: _zoomLevel };
    this.actionFocusPlayerPosition();   // OnPush's last act before UpdateAutomapView (:544)
    this._renderer = null;
    this._scale = 1;      // draw() captures the live letterbox factor
    this._tex = null;     // { key, tex, w, h, mode }
    this._stamp = null;   // { key, tex, span, worldPerPx }
    this._disc = null;
    this._plates = null;  // cached solver output for the current view
    this._platesKey = '';
    this._hoverPlate = null;
    this._tooltipRect = null;   // the chrome rect whose tooltip is due (automapChrome.tick)
  }

  /** E3: RevealUndiscoveredBuildings (ExteriorAutomap.cs:230-234) is a
   *  property on the PERSISTENT component, not on the window - the
   *  console sets it while no map is open and the next open reads it -
   *  so the flag lives at module scope here (the shape
   *  ui/travelMapWindow.js has always used for its own pair) and the
   *  window's property is the same value under the name the drawing
   *  code and its pins already read. */
  get revealUndiscoveredBuildings() { return _revealUndiscoveredBuildings; }

  set revealUndiscoveredBuildings(on) { _revealUndiscoveredBuildings = !!on; }

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
      // the three DIRECT view-mode verbs (:1235-1262) - F2/F3/F4 in
      // DFU's table, and each SETS the mode rather than cycling to it
      case 'ActionSwitchToExteriorAutomapViewModeOriginal': this.mode = VIEW_MODES[0]; return undefined;
      case 'ActionSwitchToExteriorAutomapViewModeExtra': this.mode = VIEW_MODES[1]; return undefined;
      case 'ActionSwitchToExteriorAutomapViewModeAll': this.mode = VIEW_MODES[2]; return undefined;
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

  /** ShortcutOrFallback (:216-223) against this window's live AutoMap
   *  binding - byte for byte the dungeon window's `_hotkeyHit`, over
   *  the ExtAutomap* half of the same table. */
  _hotkeyHit(button, code, e) {
    const seq = shortcutOrFallback(button, this.automapBinding);
    if (!seq.code) return false;
    if (normalizeCode(code, e) !== seq.code) return false;
    return checkSetModifiers(keyboardModifiers(e), seq.modifiers);
  }

  /** ROAD-E E1: InputManager's key dictionary, fed by the seam - the
   *  dungeon window's `_noteKey` verbatim. */
  _noteKey(code, e, down) {
    const nc = normalizeCode(code, e);
    if (nc) { if (down) this._heldCodes.add(nc); else this._heldCodes.delete(nc); }
    this._keyModifiers = keyboardModifiers(e, this._heldCodes);
  }

  /**
   * Update's keyboard half (:585-720), in DFU's order: the toggle-close
   * FIRST, then the IsDownWith hotkeys, then the IsPressedWith ones.
   *
   * THE TOGGLE-CLOSE IS TWO-PHASE (:586-597): DFU raises
   * `isCloseWindowDeferred` on the key DOWN and closes on the key UP,
   * so the press that opens the map cannot also close it in the same
   * frame. ROAD-E E1 gave the port the key-UP route, so the second
   * phase is `keyup` below rather than the next tick().
   *
   * THE HELD CLASS LEFT THIS METHOD with the same slice: `IsPressedWith`
   * is a per-frame STATE poll, so the twenty arms of :642-720 are
   * `tick`'s now and the press only records itself here.
   */
  input(code, e = null) {
    this._noteKey(code, e, true);
    if (this.automapBinding && normalizeCode(code, e) === this.automapBinding) {
      this.isCloseWindowDeferred = true;
      return;
    }
    // ":587 - GetBackButtonDown()" is the same statement as the toggle
    // key, so Escape takes the same door.
    if (normalizeCode(code, e) === 'Escape') { this.isCloseWindowDeferred = true; return; }
    const dt = this._dt || 1 / 60;
    for (const button of EXT_HOTKEYS_DOWN) {
      if (!this._hotkeyHit(button, code, e)) continue;
      const bg = EXT_BACKGROUND_HOTKEYS[button];
      if (bg) { this.background = bg; return; }
      this.runVerb(EXT_HOTKEY_VERBS[button], dt);
      return;
    }
  }

  /** ROAD-E E1: the release edge - :589-596 verbatim (`GetBackButtonUp()
   *  || GetKeyUp(automapBinding)) && isCloseWindowDeferred` -> the
   *  latch clears and CloseWindow() runs, playing no sound), plus the
   *  held dictionary's drain, which is what ends a held pan. */
  keyup(code, e = null) {
    this._noteKey(code, e, false);
    const nc = normalizeCode(code, e);
    const isToggle = (this.automapBinding && nc === this.automapBinding) || nc === 'Escape';
    if (isToggle && this.isCloseWindowDeferred && !this.done) {
      this.isCloseWindowDeferred = false;
      this.runVerb('ActionExit', this._dt || 1 / 60);   // CloseWindow() (:592-594), and it plays no sound
    }
  }

  /** The IsPressedWith class (:642-720), polled once per FRAME over the
   *  held dictionary. DFU's Update is a flat chain of independent ifs,
   *  so every matching hotkey runs on the same frame - there is no
   *  early return. */
  _tickHeldHotkeys(dt) {
    for (const button of EXT_HOTKEYS_HELD) {
      const seq = shortcutOrFallback(button, this.automapBinding);
      if (!seq.code || !this._heldCodes.has(seq.code)) continue;
      if (!checkSetModifiers(this._keyModifiers, seq.modifiers)) continue;
      if (this.done) return;
      this.runVerb(EXT_HOTKEY_VERBS[button], dt);
    }
  }

  /** The pointer seam (down/move/up) - the chrome's press-hold machine
   *  and the two panel drags. Native 320x200 coordinates. */
  pointer(phase, nx, ny, button = 0) {
    const out = this.chrome.pointer(phase, nx, ny, button);
    // PlayOneShot(SoundClips.ButtonClick) - DFU plays it FIRST in every
    // one of the twenty-one handlers (e.g. :1371-1372), which is also
    // why ActionClickSoundOnly (:1375-1381) is a whole handler.
    if (out.sound) audio.playOneShot(SOUND.ButtonClick, 1);
    for (const v of out.verbs) this.runVerb(v, this._dt || 1 / 60);
    if (out.drag) {
      // DFU measures the mouse bias in REAL SCREEN pixels -
      // `InputManager.MousePosition` (:731, :744), NOT
      // BaseScreenComponent's localScale-divided ScaledMousePosition -
      // and both drag speeds are tuned against that space, so the
      // chrome's NATIVE 320x200 delta is scaled back up by the
      // letterbox factor first. The dungeon window's identical idiom
      // is automapWindow.js's `_applyDrag`.
      const s = this._scale || 1;
      if (out.drag.kind === 'pan') {
        // dragSpeedCompensated = dragSpeed * orthographicSize, and this
        // arm carries NO dt at all (:733-740)
        this.cam = exteriorDragPan(this.cam, out.drag.dx * s, out.drag.dy * s);
      } else if (out.drag.kind === 'rotate') {
        // :748 hands `dragRotateSpeed * bias.x` to ActionRotate, and
        // the dt lives INSIDE ActionRotate (:1101-1105,
        // `-rotationAmount * Time.unscaledDeltaTime`) - so the bias is
        // the amount, not the angle.
        this.cam = exteriorRotate(this.cam, EXT_DRAG_ROTATE_SPEED * out.drag.dx * s, this._dt || 1 / 60);
      }
    }
    if (phase === 'move') this._hoverAt = [nx, ny];
    if (phase === 'down' && out.doubleClick && button === 0) this._renameAt(nx, ny);
    return out;
  }

  /** townTalk's click seam still exists; a native window that has a
   *  pointer seam takes the press through it so the two never disagree. */
  click(nx, ny, isRight = false) { this.pointer('down', nx, ny, isRight ? 2 : 0); }

  /** THE SENTINEL GUARD, and it is the dungeon window's law verbatim
   *  (automapWindow.js's own `hover`). townTalk's hover seam delivers
   *  (-1,-1) for any pointer outside the native 320x200 rect - the
   *  listener is on the window, not the canvas - and that is a
   *  FABRICATED coordinate, not a position: fed to the chrome it mints
   *  a drag delta of order -160 native px and teleports the map. DFU
   *  never has one; its Update() differences two real
   *  InputManager.MousePosition samples, so leaving the panel keeps
   *  tracking a real delta. Freezing the drag while the pointer is out
   *  and resuming from the re-entry point is the closest a
   *  clamped-coordinate seam gets to that. */
  hover(nx, ny) { if (nx >= 0 && ny >= 0) this.pointer('move', nx, ny, 0); }

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
    // the SHARED chrome answers both halves: the held verbs, and which
    // rect has rested under the pointer for ToolTipDelay (:22 - one
    // second, and SuppressToolTip while its own button is held)
    // ROAD-E E1: the IsPressedWith arms, before the mouse half - DFU's
    // Update runs the close check, the IsDownWith hotkeys, the
    // IsPressedWith hotkeys, THEN the mouse (:585-760). The first two
    // are the seam's edges (`keyup`, `input`); this is the frame poll
    // they cannot be.
    this._tickHeldHotkeys(dt);
    const { verbs, tooltip } = this.chrome.tick(dt);
    this._tooltipRect = tooltip;
    for (const v of verbs) this.runVerb(v, dt);
    _zoomLevel = this.cam.orthoSize;   // OnPop stores the level (:551)
    _yawDeg = this.cam.yawDeg;         // ...and the automap script stores the rotation
  }

  /**
   * OnReturn - the window is uncovered again after something was
   * pushed over it (windowStack.js's RemoveWindow), and the ONE thing
   * that pushes over this map is the plate rename box: the double
   * click that opens it is a press on the RENDER PANEL, so it also
   * armed the chrome's left panel drag (automapChrome.js's down
   * branch), and the matching release never arrives - it is routed to
   * townTalk's slot, which by then holds the input box.
   *
   * DFU has no such latch because its release is POLLED, not routed:
   * BaseScreenComponent.cs:643-648 fires OnMouseUp from the button
   * STATE ("can release from anywhere"), and the window's own Update
   * runs base.Update() - and with it panelRenderAutomap's poll - ahead
   * of the drag block (:581, DaggerfallBaseWindow.cs:98,
   * UserInterfaceWindow.cs:81, then :729). So the very first frame
   * after the box pops, PanelAutomap_OnMouseUp (:1343-1347) has
   * already cleared `leftMouseDownOnPanelAutomap` and the map pans
   * zero frames. Releasing every flag when the map comes back is the
   * routed seam's equivalent, and it covers any future push as well.
   */
  onReturn() { this.chrome.releaseAll(); }

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
    this._scale = m.s;   // the letterbox factor the two drags spend
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
   *    marked it (:682-709), which is the `questName` the host stamped
   *    on the row at open through stampResidenceQuestNames above. BOTH
   *    exterior hosts stamp (scenes/world.js and, since QX1,
   *    scenes/exterior.js); a residence no active quest marked simply
   *    leaves questName unset, which is DFU's own empty-set answer: no
   *    plate. `?exterior` supplies only two of the three source arms -
   *    `isBuildingQuestResource` is TalkManager's and that route runs
   *    no topic tree - and residenceQuestName's next line skips the
   *    only assignment without it, so that host's stamp resolves '' for
   *    every residence, which is still DFU's answer where no NPC can
   *    mark;
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
          // :705-707 - `if (!string.IsNullOrEmpty(buildingQuestName))`,
          // the empty string being the "not involved in an active
          // quest" answer stampResidenceQuestNames leaves behind
          name = b.questName;
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

  /**
   * TextLabel_OnMouseDoubleClick -> SetCustomBuildingName
   * (ExteriorAutomap.cs:867-899): a RESIDENCE cannot be renamed (its
   * name is quest-generated and temporary), and the input lands on the
   * discovery record.
   *
   * THE BOX OPENS ON THE DISPLAYED NAME, not the canonical one. DFU
   * fills the three TextBox fields from two different places (:881,
   * :887-889): `Name`/`DefaultText` take `renamingLabelRef.Name` - the
   * canonical - while the EDITABLE `Text` takes `renamingLabelRef.Text`,
   * which the window set to the custom name whenever one exists
   * (DaggerfallExteriorAutomapWindow.cs:882-885). `p.text` is that same
   * `custom || name`. The canonical is only the FALLBACK for an emptied
   * box (:923 `renamingLabelRef.Text = sender.TextBox.Name`), which
   * the port reaches through the empty store instead: discovery.js
   * keeps '' and buildPlates falls back to the canonical.
   */
  _renameAt(nx, ny) {
    const p = this._hoverPlate;
    if (!p || p.isResidence) return;
    this.deps.rename?.(p.buildingKey, p.text ?? p.name);
  }

  /** The native chrome: the caption strip's three live swatches
   *  (:466-476), the compass on the MAP camera's yaw, the rested
   *  BUTTON's tooltip and the hovered plate's, in DFU's own draw
   *  order. */
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
      // HUDCompass on the AUTOMAP camera (:454-458) - the strip reads
      // the MAP's yaw, never the player's - through hud.js's ONE strip
      // drawer, the same call the dungeon window makes
      // (automapWindow.js). THE DUMMY PANEL GIVES THE POSITION AND
      // NOTHING ELSE: `compass.Position = dummyPanelCompass.Rectangle.
      // position` (:456), while HUDCompass sizes the frame from the ART
      // (`boxRectSize = compassBoxSize * Scale`, HUDCompass.cs:132-135,
      // COMPBOX.IMG at 69x17). rectDummyPanelCompass' own 76x17 (:433)
      // is the click/tooltip target only and never reaches the compass.
      const r = CHROME_RECTS.compass;
      drawCompassStrip(renderer, art, m.ox + r.x * m.s, m.oy + r.y * m.s, m.s,
        compassHeading01(this.cam.yawDeg));
    }
    if (!font) return;
    if (!_art) {
      // the keyed fallback shell: the location name and the controls
      drawText(renderer, font, `${this.deps.locationName ?? ''} - ${this.mode} view`, m.ox + 4 * s, m.oy + 191 * s, s, [0.9, 0.9, 0.75, 1]);
    }
    // THE EIGHT BUTTON TOOLTIPS + THE COMPASS PANEL'S
    // (UpdateButtonToolTipsText, :230-239), through the block
    // ui/automapText.js now carries for BOTH windows. These ride the
    // window's SHARED `defaultToolTip`, so unlike the plate tooltip
    // below they ARE behind EnableToolTips (DaggerfallBaseWindow.cs
    // :50-56) - drawToolTipBox's own default - and they wait out
    // ToolTipDelay where the plate's shows at once.
    //
    // ORDER IS DFU'S: Draw() runs base.Draw() - which is where
    // defaultToolTip lands - and only then "Draw nameplate tooltip
    // last" (:566-573). Two tooltips can only overlap if the pointer
    // is over a chrome button AND a plate at once, which the render
    // panel's scissor rules out; the order is kept anyway because it
    // is free and it is the reference's.
    if (this._tooltipRect && this._hoverAt) {
      const tip = exteriorAutomapTooltipFor(this._tooltipRect, this.automapBinding);
      if (tip) drawToolTipBox(renderer, m, font, tip, this._hoverAt[0], this._hoverAt[1]);
    }
    // THE PLATE TOOLTIP, through ui/toolTip.js's ONE box - a real
    // ToolTip in DFU (window :870-878), so it is ToolTip.Draw's own
    // sizing, its MouseOffset (0,4) and both edge shifts, and the two
    // GUI colour settings DFU assigns it by hand (:874-875
    // `BackgroundColor = Settings.ToolTipBackgroundColor; TextColor =
    // Settings.ToolTipTextColor`). It carries the CANONICAL name even
    // when a custom one is drawn (:878, :882-885), at ToolTipDelay 0
    // (:873) - it shows the instant the pointer is over the label, so
    // there is no rest clock here at all.
    //
    // AND IT IS NOT GATED BY EnableToolTips. `nameplateToolTip` is a
    // bare `new ToolTip()` built in UpdateAutomapView (:870-871) and
    // drawn unconditionally in Draw() (:571-572); only
    // DaggerfallBaseWindow's SHARED `defaultToolTip` - which the eight
    // chrome buttons point at - sits behind the setting
    // (DaggerfallBaseWindow.cs:50-56). So this one caller bypasses the
    // master switch, and routing it through the gate would itself be a
    // departure.
    const t = this._hoverPlate;
    if (t && this._hoverAt) {
      drawToolTipBox(renderer, m, font, t.name, this._hoverAt[0], this._hoverAt[1],
        { ignoreEnableSetting: true });
    }
  }
}

// ── ROAD-E E3: ExteriorAutoMapConsoleCommands ────────────────────────
// ExteriorAutomap.cs:1777-1844. The two verbs this file's header
// carried as its last open item: the flag was live and pinned, and
// what was missing was the database to register them in. It exists now
// (systems/consoleCommands.js), so they are registered as C# registers
// them, with C#'s gate and C#'s four answer strings.
//
// `ExteriorAutomap.instance` is a persistent component in DFU and the
// port's window is per-open, so the INSTANCE test below is the one
// thing that cannot be a window reference: what the commands need is
// the flag, which lives at module scope with the window class, so the
// instance is always there and the null arm is DFU's unreachable-in-
// practice guard kept for its message. IsPlayerInside is the host's -
// a mounted interior or dungeon mode - and it is passed in, because a
// UI module cannot ask a host a question it was not handed.

/** map_revealbuildings / map_hidebuildings (:1793-1842). */
export function registerExteriorAutomapConsoleCommands(deps = {}) {
  const inside = () => !!deps.isPlayerInside?.();
  try {
    registerCommand('map_revealbuildings',
      'Reveals undiscovered buildings on exterior automap (temporary)',
      'map_revealbuildings',
      () => {
        if (inside()) return 'this command only has an effect when outside and at a location';
        _revealUndiscoveredBuildings = true;
        return 'undiscovered buildings have been revealed (temporary) on the exterior automap';
      });
    registerCommand('map_hidebuildings',
      'Hides undiscovered buildings on exterior automap',
      'map_hidebuildings',
      () => {
        if (inside()) return 'this command only has an effect when outside and at a location';
        _revealUndiscoveredBuildings = false;
        return 'undiscovered buildings have been hidden on the exterior automap again';
      });
  } catch (ex) {
    console.error(`Error Registering Exterior Automap Console commands: ${ex?.message ?? ex}`);
  }
}
