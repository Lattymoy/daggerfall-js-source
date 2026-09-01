// ROAD-C c2/S5: THE NATIVE DUNGEON AUTOMAP WINDOW -
// DaggerfallAutomapWindow.cs (MIT, Daggerfall Workshop; original author
// Nystul) on the port's own native-panel idiom, and the FIRST CONSUMER
// of c2 flight 1. A1 shipped this window as a keyed full-canvas overlay
// with stepped controls and no art; what stands here is DFU's window:
// AMAP00I0.IMG, the nine buttons at their own rects, press-HOLD
// controls at DFU's per-second speeds, mouse drags, the compass on the
// MAP camera, the four backgrounds and the tooltips that document the
// whole surface.
//
// WHAT THIS FILE OWNS, AND WHAT IT DELIBERATELY DOES NOT. Flight 1 cut
// this window into four pieces and this is the assembly point:
//   - systems/automapModel.js   the reveal index + the draw partition
//   - render/renderer.js        the PANEL BRACKET (panelFrame) - the
//                               renderer owns GL state (EV6), so the
//                               scissor/viewport ordering, the DFU
//                               clear and the return of every global
//                               are NOT here
//   - ui/automapCamera.js       every control verb, as pure transitions
//   - ui/automapChrome.js       the rects, the press-hold machine, the
//                               drag protocol and the two action tables
//   - ui/automapText.js         Internal_Strings:874-890 + the hotkey
//                               substitution
// This file is the DFU window's own job: art, draw order, the OnPush /
// OnPop handshake, and binding chrome verb NAMES to camera functions.
//
// THE PASS IS UNLIT, and this is the correction A1/A2 could not make
// without the shader in front of them. Assets/Shaders/DaggerfallAutomap
// .shader's fragment is `outColor.rgb = albedo.rgb` with NO light term
// at all: the three directional lights CreateLightsForAutomapGeometry
// builds (Automap.cs:2025-2076) touch only the Standard-material
// beacons, never the geometry. So the geometry pass runs at ambient
// (1,1,1) with sun 0, no point lights, no indirect, no moon, no window
// emission and fog off - not A1's 0.9 stand-in, which was the three
// light intensities collapsed into an ambient the real shader never
// reads.
//
// THE LENS IS THE VIEW MODE'S, AND THE NEAR PLANE WITH IT. A1 pinned
// the camera's creation planes (0.7 / 5000, Automap.cs:2015-2016) and
// noted it was deliberately NOT using "the 2D mode's 100". But the
// window OVERWRITES nearClipPlane at every push and every grid switch
// (:552-560, :1751-1762), and DFU's own comment on the 100 says what it
// is for: "simulate classic Daggerfall near clip plane" (:44). With the
// top-down camera 150 above the player, a 100-unit near plane is what
// cuts away the ceilings between the camera and the floor - the classic
// look, not a mistake. Only the FAR plane is the camera's own.
//
// ── ROAD-C c2/S6: THE RENDER MODES ───────────────────────────────────
// The above-slice half of DaggerfallAutomap.shader now exists
// (renderer.js's AUTOMAP_MODE), so this window issues DFU's FOUR draw
// groups: below-slice colour, below-slice grayscale, the above-slice
// group by render mode, then the never-sliced markers. Cutout issues no
// above-slice group at all, which is exactly what DFU's `clip(-1.0)`
// arm amounts to. Two SUBSTITUTIONS are recorded here at their true
// size, and neither is a licence to improve on the original:
//
//  (a) WIREFRAME IS gl.LINES OVER AN EDGE INDEX BUFFER, standing in for
//      DFU's geometry-shader barycentric wireframe (WebGL2 has no
//      geometry stage). THE LOSS IS SMALL: DFU hard-clips its falloff
//      at I < 0.1 and writes a CONSTANT colour on what survives, so
//      there is no soft falloff to lose - only a ~0.9 px hard band that
//      becomes a 1 px line (WebGL2 caps lineWidth at 1). The other
//      delta, quad diagonals, is not a delta at all: DFU's per-triangle
//      barycentrics draw them too. Do NOT close this with a
//      de-indexed barycentric mesh variant - it doubles vertex memory
//      for every automap-eligible model to buy under a pixel.
//
//  (b) DFU RENDERS BOTH PASSES PER OBJECT (Unity queues each renderer's
//      two passes together); the port draws GROUP BY GROUP - every
//      below-slice model, then every above-slice one. The two differ
//      only where an above-slice TRANSPARENT fragment would have
//      blended before a LATER object's below-slice depth write. DFU
//      sorts nothing and writes depth from the transparent pass on
//      purpose ("Blend SrcAlpha OneMinusSrcAlpha" + "ZWrite On", no
//      queue sorting), so its own output is order-dependent already:
//      the artifacts ARE the classic look and are the target, not a bug
//      either implementation is trying to avoid.
//
// THE KEYED FALLBACK SURVIVES. A boot with no ARENA2 art still gets a
// working map: the same geometry pass in the same panel rect, with a
// text legend instead of AMAP00I0 - the shape ui/pauseWindow.js has
// carried since U23. `automapArtLoaded()` is the host's gate, and the
// window never throws for want of a texture.

import { drawText } from './text.js';
import { mirrorProjectionX, perspective, lookAt, trs, UP_Y } from '../world/mat4.js';
import { getBool, getString } from '../systems/settings.js';
import { slicingPositionY, DEFAULT_SLICING_BIAS_Y } from '../systems/automap.js';
import { RDB_SIDE } from '../world/dungeonLayout.js';
import { AUTOMAP_PANEL_NATIVE_RECT, AUTOMAP_MODE } from '../render/renderer.js';   // c2/S2: the bracket's rect; c2/S6: the six presentations
import {
  nativeMetrics, loadImg, drawImg, drawImgCrop, drawRect, shadowText,
  SCREEN_DIM, NATIVE_W, NATIVE_H,
} from './nativePanel.js';
import {
  AutomapChrome, DUNGEON_ACTIONS, CHROME_RECTS, HOVER_LABEL, compassHeading01,
} from './automapChrome.js';
import { automapTooltipFor, shortcutOrFallback } from './automapText.js';
import { drawToolTipBox } from './toolTip.js';
import { drawCompassStrip } from './hud.js';
import { bindings } from './input.js';
import { getBinding } from '../systems/inputActions.js';
import { normalizeCode, keyboardModifiers, checkSetModifiers } from '../systems/dialogShortcuts.js';
import { audio } from '../systems/audio.js';
import { SOUND } from '../systems/soundClips.js';
import {
  VIEW_2D, VIEW_3D, CAMERA_FAR, ZOOM_SPEED, ZOOM_SPEED_MOUSE_WHEEL,
  ROTATE_CAMERA_SPEED, ROTATE_YZ_SPEED_3D, DEFAULT_FIELD_OF_VIEW_3D,
  createAutomapCamera, cameraLens, cameraYawDeg, rotationPivot,
  resetCameraTransformViewFromTop, resetCameraTransformView3D, resetCameraPosition,
  saveCameraTransformViewFromTop, saveCameraTransformView3D,
  restoreCameraTransformViewFromTop, restoreCameraTransformView3D,
  resetRotationPivotAxisPosition, actionResetRotationPivotAxis,
  actionChangeAutomapGridMode, actionResetView,
  actionMoveForward, actionMoveBackward, actionMoveLeft, actionMoveRight,
  actionMovePivotForward, actionMovePivotBackward, actionMovePivotLeft, actionMovePivotRight,
  actionRotateLeft, actionRotateRight, actionRotateCamera, actionRotateCameraYZ,
  actionMoveUpstairs, actionMoveDownstairs,
  actionIncreaseSliceLevel, actionDecreaseSliceLevel, actionMoveSliceLevel,
  actionZoomIn, actionZoomOut, actionChangeFieldOfView,
  switchFocusToNextObject, switchFocusToGameObject,
  dragPan, dragRotate,
} from './automapCamera.js';

const DEG = Math.PI / 180;

/** nativeImgName / nativeImgNameGrid3D (:113-114). */
export const AUTOMAP_IMG = 'AMAP00I0.IMG';
export const AUTOMAP_IMG_GRID_3D = 'AMAP01I0.IMG';

/**
 * The 2D grid icon is CUT OUT OF THE BACKGROUND (:297-304):
 * `GetPixels(78, 200 - 171 - 19, 27, 19)` in Unity's bottom-left pixel
 * space, which in the port's top-down native space is the grid BUTTON's
 * own rect. So the 2D icon is the pixels already under the button, and
 * drawing it is a no-op the window does anyway - the 3D icon is what
 * actually changes (:1748, :1758).
 */
export const GRID_CUTOUT = Object.freeze({ x: 78, y: 171, w: 27, h: 19 });

/**
 * The FOUR backgrounds (:306-348, :1699-1733). DFU builds three solid
 * Color[] textures the size of the map area and assigns one to
 * dummyPanelAutomap, whose rect IS the render panel; `original` assigns
 * NULL, which draws nothing at all and lets AMAP00I0's own map-area art
 * show through the render texture's ~2% clear. That is the whole
 * feature, and an opaque fill on the `original` arm deletes it.
 */
export const AUTOMAP_BACKGROUNDS = Object.freeze({
  original: null,                                     // :1704 - BackgroundTexture = null
  alternative1: Object.freeze([0.0, 0.0, 0.0, 1.0]),  // :1313-1316
  alternative2: Object.freeze([0.2, 0.1, 0.3, 1.0]),  // :1326-1329
  alternative3: Object.freeze([0.3, 0.1, 0.2, 1.0]),  // :1339-1342
});
export const BACKGROUND_HOTKEYS = Object.freeze({
  AutomapSwitchToAutomapBackgroundOriginal: 'original',
  AutomapSwitchToAutomapBackgroundAlternative1: 'alternative1',
  AutomapSwitchToAutomapBackgroundAlternative2: 'alternative2',
  AutomapSwitchToAutomapBackgroundAlternative3: 'alternative3',
});

/** AutomapRenderMode (Automap.cs:197-202), in the enum's own order. */
export const RENDER_MODES = Object.freeze(['Cutout', 'Wireframe', 'Transparent']);

/**
 * SwitchToNextAutomapRenderMode (Automap.cs:464-486): `++` over the
 * enum with a wrap past `Enum.GetNames(...).Length - 1`. The CYCLE IS
 * THE ENUM'S ORDER, not the tooltip's or the hotkeys' - Cutout ->
 * Wireframe -> Transparent -> Cutout. An unknown mode answers the
 * enum's own default, Cutout(0).
 */
export function nextRenderMode(mode) {
  const i = RENDER_MODES.indexOf(mode);
  if (i < 0) return RENDER_MODES[0];
  return RENDER_MODES[(i + 1) % RENDER_MODES.length];
}

/**
 * Which uAutomapMode each (render mode, discovery tier) pair issues
 * ABOVE the slice. Cutout answers 0 in both tiers, which the draw loop
 * reads as "issue no above-slice group at all" - DFU's `clip(-1.0)`.
 * The COLOUR arm is geometry visited in this run, the GRAY arm is
 * geometry revealed on a prior one (RENDER_IN_GRAYSCALE, :60-79).
 */
export const ABOVE_SLICE_MODES = Object.freeze({
  Cutout: Object.freeze({ colour: AUTOMAP_MODE.OFF, gray: AUTOMAP_MODE.OFF }),
  Wireframe: Object.freeze({ colour: AUTOMAP_MODE.ABOVE_WIREFRAME_COLOUR, gray: AUTOMAP_MODE.ABOVE_WIREFRAME_GRAY }),
  Transparent: Object.freeze({ colour: AUTOMAP_MODE.ABOVE_TRANSPARENT_COLOUR, gray: AUTOMAP_MODE.ABOVE_TRANSPARENT_GRAY }),
});

/** the automap camera's far plane (Automap.cs:2016); the NEAR plane is
 *  the VIEW MODE's, not this one - the window overwrites it at every
 *  push and every grid switch (:552-560, :1751-1762). */
export const FAR_CLIP = CAMERA_FAR;

// The geometry pass's lighting, as VALUES: DaggerfallAutomap.shader has
// no light term, so ambient is the identity and every other term is off.
const UNLIT_AMBIENT = new Float32Array([1, 1, 1]);
const NO_POINT_LIGHTS = new Float32Array(0);
const ZERO3 = new Float32Array([0, 0, 0]);

export const MICRO_BLOCK_PX = 2;                  // microMapBlockSizeInPixels (Automap.cs:1771)
export const MICRO_SIZE_MIN = 7;                  // sizeMin (:1753)
const MICRO_YELLOW = 0xff00ffff;                  // Color.yellow blocks when QoL is off (:1799), ABGR
const MICRO_GREEN = 0xff00ff00;                   // entrance (:1815)
const MICRO_RED = 0xff0000ff;                     // player (:1828)

// ── THE PERSISTENT WINDOW STATE ──────────────────────────────────────
// DaggerfallAutomapWindow is a singleton the UI manager keeps forever,
// so its camera backups, view mode, FOV, background and render mode
// survive every close; SlicingBiasY lives one object over, on the
// equally persistent Automap component. The port builds a NEW window
// object per open (the overlay-slot idiom), so that lifetime is module
// scope here - the same place A1's remembered slice bias already lived.
let _cam = null;             // ui/automapCamera.js state: transforms, pivots, viewMode, fov3D, slicingBiasY
let _background = 'original';
let _renderMode = 'Cutout';  // currentAutomapRenderMode's default (Automap.cs:203)
let _resetSignal = false;

/**
 * `Automap.ResetAutomapSettingsSignalForExternalScript = true`
 * (Automap.cs:2486/:2494) - raised by InitWhenInInteriorOrDungeon when
 * the player enters a building or a dungeon, PULLED and erased by the
 * window's next OnPush. DFU's own comment says why it is a flag rather
 * than a call: "I wanted to make Automap unaware and independent of the
 * actual GUI implementation" (:206-209). The port's dungeon host raises
 * it at its automap mount, which is the same moment.
 */
export function signalAutomapReset() { _resetSignal = true; }

/** Probe surface: the live persistent camera, or null before any open. */
export const automapCameraState = () => _cam;
export const automapBackground = () => _background;
export const automapRenderMode = () => _renderMode;
/** Tests and a fresh session: forget everything the singleton kept. */
export function resetAutomapWindowState() {
  _cam = null; _background = 'original'; _renderMode = 'Cutout'; _resetSignal = false;
}

// The micro-map version counter is MODULE-level: uploadTexture
// memoizes by key forever, and a window torn down without dispose()
// (the death presenter's forced overwrite) would otherwise leave
// 'micro-1' cached - the next window's per-instance counter would
// re-mint the same key and be handed the dead session's bitmap
// (A1 review).
let _microVer = 0;

// ── ART ──────────────────────────────────────────────────────────────
let _art = null;   // { bg, grid3d, compass, compassBox }

/** Setup's texture loads (:288-304) plus the HUDCompass assets the
 *  window mounts at (3,172) (:503-508). One await, before any open. */
export async function preloadAutomapArt(deps) {
  if (_art) return _art;
  const [bg, grid3d, compass, compassBox] = await Promise.all([
    loadImg(deps, AUTOMAP_IMG),
    loadImg(deps, AUTOMAP_IMG_GRID_3D),
    loadImg(deps, 'COMPASS.IMG'),
    loadImg(deps, 'COMPBOX.IMG'),
  ]);
  _art = { bg, grid3d, compass, compassBox };
  return _art;
}
export const automapArtLoaded = () => !!_art;
/** Tests only: install (or with null, drop) the cached art, so BOTH
 *  draw paths - native and the art-less keyed fallback - can be driven
 *  without ARENA2. The fallback is a shipped path, not a nicety; a pin
 *  that could not reach it would leave it unproven forever. */
export function _setAutomapArt(art) { _art = art; }

/** "RRGGBBAA" -> packed ABGR uint32 (the settings colour law,
 *  settingsLaw.js's widget format). Bad strings answer the fallback. */
export function hexColor32(rrggbbaa, fallback) {
  if (!/^[0-9a-fA-F]{8}$/.test(rrggbbaa ?? '')) return fallback;
  const n = parseInt(rrggbbaa, 16);
  const r = (n >>> 24) & 0xff, g = (n >>> 16) & 0xff, b = (n >>> 8) & 0xff, a = n & 0xff;
  return ((a << 24) | (b << 16) | (g << 8) | r) >>> 0;
}

/** The micro-map bitmap (UpdateMicroMapTexture, Automap.cs:1739-1832),
 *  as an uploadTexture color32. blocks = [{x, z, name}] in block grid
 *  units; entrance/player = world [x,_,z] or null. Pure - the caller
 *  reads the settings. Data row 0 lands at the TOP of the drawn quad
 *  (the port's IMG convention), so north (+z) rows come first. */
export function buildMicroMap(blocks, entrance, player, { qol = true, inner = 0xffd087d4, border = 0xff03b4fa } = {}) {
  if (!blocks?.length) return null;
  let xMin = Infinity, xMax = -Infinity, zMin = Infinity, zMax = -Infinity;
  for (const b of blocks) {
    xMin = Math.min(xMin, b.x); xMax = Math.max(xMax, b.x);
    zMin = Math.min(zMin, b.z); zMax = Math.max(zMax, b.z);
  }
  // the +1 origin margin and the square max(sizeMin, extents) law (:1752-1769)
  const originX = -xMin + 1, originZ = -zMin + 1;
  const size = Math.max(MICRO_SIZE_MIN, Math.max(xMax + 1 + originX, zMax + 1 + originZ));
  const w = size * MICRO_BLOCK_PX, h = size * MICRO_BLOCK_PX;
  const colors = new Uint32Array(w * h);   // cleared transparent (:1777-1780)
  // put() speaks rows-from-bottom (DFU's SetPixel space) and flips
  const put = (x, yBottom, c) => {
    if (x < 0 || x >= w || yBottom < 0 || yBottom >= h) return;
    colors[(h - 1 - yBottom) * w + x] = c;
  };
  for (const b of blocks) {
    const c = qol ? ((b.name ?? '').startsWith('B') ? border : inner) : MICRO_YELLOW;   // border blocks are "B"-named (:1790-1799)
    const px = (originX + b.x) * MICRO_BLOCK_PX, py = (originZ + b.z) * MICRO_BLOCK_PX;
    for (let i = 0; i < MICRO_BLOCK_PX; i++) for (let j = 0; j < MICRO_BLOCK_PX; j++) put(px + i, py + j, c);
  }
  // entrance + player at half-block resolution, 1 px each (:1805-1830)
  const half = (p) => [Math.floor((p[0] / RDB_SIDE + originX) * 2), Math.floor((p[2] / RDB_SIDE + originZ) * 2)];
  if (entrance) { const [x, y] = half(entrance); put(x, y, MICRO_GREEN); }
  if (player) { const [x, y] = half(player); put(x, y, MICRO_RED); }
  return { width: w, height: h, colors };
}

/**
 * The DOWN-class hotkeys, in DFU's own Update() order (:730-781): every
 * one of these is `IsDownWith`, so one press is one action and the
 * port's keydown-only overlay seam carries them EXACTLY.
 */
// c2/S6: the four render-mode rows sit exactly where DFU polls them
// (:747-763) - between SwitchFocusToNextBeaconObject and the four
// backgrounds - and in DFU's own order: next, transparent, wireframe,
// cutout.
export const HOTKEYS_DOWN = Object.freeze([
  'AutomapSwitchAutomapGridMode',
  'AutomapResetView',
  'AutomapResetRotationPivotAxisView',
  'AutomapSwitchFocusToNextBeaconObject',
  'AutomapSwitchToNextAutomapRenderMode',
  'AutomapSwitchToAutomapRenderModeTransparent',
  'AutomapSwitchToAutomapRenderModeWireframe',
  'AutomapSwitchToAutomapRenderModeCutout',
  'AutomapSwitchToAutomapBackgroundOriginal',
  'AutomapSwitchToAutomapBackgroundAlternative1',
  'AutomapSwitchToAutomapBackgroundAlternative2',
  'AutomapSwitchToAutomapBackgroundAlternative3',
]);

/**
 * The PRESSED-class hotkeys (:783-870): `IsPressedWith` is
 * InputManager.GetKey - HELD, polled every frame, which is why every
 * speed they carry is per-SECOND.
 *
 * DEPARTURE, recorded (and it is ui/restWindow.js's, one window over):
 * the port's overlay key seam delivers key DOWNS only, so a held
 * hotkey repeats at the browser's auto-repeat rate rather than once per
 * frame. The MOUSE half of the same verbs is a true per-frame hold
 * (ui/automapChrome.js polls its own flags in tick()), so the buttons
 * are parity and only the keyboard is approximate. Closing this needs a
 * key-UP route through the four hosts, not a change here.
 */
export const HOTKEYS_HELD = Object.freeze([
  'AutomapMoveForward', 'AutomapMoveBackward', 'AutomapMoveLeft', 'AutomapMoveRight',
  'AutomapMoveRotationPivotAxisForward', 'AutomapMoveRotationPivotAxisBackward',
  'AutomapMoveRotationPivotAxisLeft', 'AutomapMoveRotationPivotAxisRight',
  'AutomapRotateLeft', 'AutomapRotateRight',
  'AutomapRotateCameraLeft', 'AutomapRotateCameraRight',
  'AutomapRotateCameraOnCameraYZplaneAroundObjectUp',
  'AutomapRotateCameraOnCameraYZplaneAroundObjectDown',
  'AutomapUpstairs', 'AutomapDownstairs',
  'AutomapIncreaseSliceLevel', 'AutomapDecreaseSliceLevel',
  'AutomapZoomIn', 'AutomapZoomOut',
  'AutomapIncreaseCameraFieldOfFiew', 'AutomapDecreaseCameraFieldOfFiew',
]);

/** Which chrome VERB each hotkey runs. The chrome's tables answer verb
 *  names for the buttons; the hotkeys answer the same names, so there
 *  is ONE dispatch and a button and its hotkey cannot drift apart. */
export const HOTKEY_VERBS = Object.freeze({
  AutomapSwitchAutomapGridMode: 'ActionChangeAutomapGridMode',
  AutomapResetView: 'ActionResetView',
  AutomapResetRotationPivotAxisView: 'ActionResetRotationPivotAxis',
  AutomapSwitchFocusToNextBeaconObject: 'ActionSwitchFocusToNextBeaconObject',
  AutomapSwitchToNextAutomapRenderMode: 'ActionSwitchToNextAutomapRenderMode',
  AutomapSwitchToAutomapRenderModeTransparent: 'ActionSwitchToAutomapRenderModeTransparent',
  AutomapSwitchToAutomapRenderModeWireframe: 'ActionSwitchToAutomapRenderModeWireframe',
  AutomapSwitchToAutomapRenderModeCutout: 'ActionSwitchToAutomapRenderModeCutout',
  AutomapMoveForward: 'ActionMoveForward',
  AutomapMoveBackward: 'ActionMoveBackward',
  AutomapMoveLeft: 'ActionMoveLeft',
  AutomapMoveRight: 'ActionMoveRight',
  AutomapMoveRotationPivotAxisForward: 'ActionMoveRotationPivotAxisForward',
  AutomapMoveRotationPivotAxisBackward: 'ActionMoveRotationPivotAxisBackward',
  AutomapMoveRotationPivotAxisLeft: 'ActionMoveRotationPivotAxisLeft',
  AutomapMoveRotationPivotAxisRight: 'ActionMoveRotationPivotAxisRight',
  AutomapRotateLeft: 'ActionRotateLeft',
  AutomapRotateRight: 'ActionRotateRight',
  AutomapRotateCameraLeft: 'ActionRotateCameraLeft',
  AutomapRotateCameraRight: 'ActionRotateCameraRight',
  AutomapRotateCameraOnCameraYZplaneAroundObjectUp: 'ActionRotateCameraYZUp',
  AutomapRotateCameraOnCameraYZplaneAroundObjectDown: 'ActionRotateCameraYZDown',
  AutomapUpstairs: 'ActionMoveUpstairs',
  AutomapDownstairs: 'ActionMoveDownstairs',
  AutomapIncreaseSliceLevel: 'ActionIncreaseSliceLevel',
  AutomapDecreaseSliceLevel: 'ActionDecreaseSliceLevel',
  AutomapZoomIn: 'ActionZoomIn',
  AutomapZoomOut: 'ActionZoomOut',
  AutomapIncreaseCameraFieldOfFiew: 'ActionIncreaseCameraFieldOfView',
  AutomapDecreaseCameraFieldOfFiew: 'ActionDecreaseCameraFieldOfView',
});

export class AutomapWindow {
  /** deps: { record() -> the live automap record, model (the c2/S1
   *  reveal model), drawList, dynamicDraws, texRemap,
   *  player() -> {feet, eye, yaw}, startMarker, blocks (block-grid
   *  [{x,z,name}]), arrowMesh (gpu 99900 or null), dungeonName,
   *  insideBuilding (IsPlayerInsideBuilding, for the reset arm's
   *  default render mode) }. */
  constructor(deps) {
    this.deps = deps;
    this.done = false;
    // U26's native routing: raw e.code keys, the real canvas, no
    // letterbox offset and no full-screen dim - this window IS the
    // 320x200 screen.
    this.isChoiceWindow = true;
    this.chrome = new AutomapChrome(DUNGEON_ACTIONS);
    // "Store toggle closed binding for this window" - read ONCE at push
    // (:530-538), so rebinding AutoMap while the map stands open does
    // not change the key that closes it.
    this.automapBinding = getBinding(bindings(), 'AutoMap');
    this.isCloseWindowDeferred = false;
    this.hoverText = '';
    this._renderer = null;
    this._micro = null;      // { key, tex, w, h, stamp }
    this._markers = null;    // { entrance, player } billboard batches
    this._panelRect = null;
    this._scale = 1;
    this._mouse = [0, 0];    // last native pointer position (the wheel's target)
    this._tooltipRect = null;
    this._onPush();
  }

  // ── OnPush (:516-638) ──────────────────────────────────────────────
  _onPush() {
    const p = this.deps.player?.() ?? null;
    // Camera.main.transform.position and gameObjectPlayerAdvanced's are
    // two DIFFERENT points in DFU and the window uses each where the C#
    // does: the camera resets frame the EYE, the focus jumps track the
    // PLAYER.
    const mainPos = p?.eye ?? p?.feet ?? [0, 0, 0];
    const playerPos = p?.feet ?? mainPos;
    if (!_cam) {
      // Setup's one-time arm (:519-527): the transforms are built and
      // the slice bias goes to default.
      _cam = createAutomapCamera(mainPos, playerPos);
      _cam = { ..._cam, slicingBiasY: DEFAULT_SLICING_BIAS_Y };
    }
    // :567-572 - reset the bias on EVERY open unless the setting holds
    if (!getBool('Map', 'AutomapRememberSliceLevel')) {
      _cam = { ..._cam, slicingBiasY: DEFAULT_SLICING_BIAS_Y };
    }
    // :575 - the pivot goes back to the player in BOTH modes, reset arm
    // or not
    _cam = resetRotationPivotAxisPosition(_cam, playerPos);

    if (_resetSignal) {
      // :577-604 - a fresh building or dungeon
      _cam = resetCameraTransformViewFromTop(_cam, mainPos);
      _cam = resetCameraTransformView3D(_cam, mainPos);
      _cam = resetCameraPosition(_cam, mainPos);
      _cam = { ..._cam, fov3D: DEFAULT_FIELD_OF_VIEW_3D };
      // :587-596 - cutout inside a building ("floors above the current
      // are often distracting"), transparent inside a dungeon or palace
      // ("people that don't know the map functionality often think
      // cutout mode is a bug"). DFU's own comments, and its own words.
      _renderMode = this.deps.insideBuilding ? 'Cutout' : 'Transparent';
      _cam = resetRotationPivotAxisPosition(_cam, playerPos);
      _cam = { ..._cam, slicingBiasY: DEFAULT_SLICING_BIAS_Y };
      _resetSignal = false;   // "indicate the settings were reset" - consumed EXACTLY ONCE
    } else {
      // :606-635 - THE DOUBLE REFOCUS. Both cameras are re-centred on
      // the player, each keeping ITS OWN orientation, by switching the
      // view mode under SwitchFocusToGameObject (whose 2D and 3D arms
      // differ) and switching it back. A port that refocused only the
      // live mode would leave the other one looking at where the player
      // was several dungeons ago.
      const backup = _cam.viewMode;
      _cam = { ..._cam, viewMode: VIEW_2D };
      _cam = restoreCameraTransformViewFromTop(_cam);
      _cam = switchFocusToGameObject(_cam, playerPos);
      _cam = saveCameraTransformViewFromTop(_cam);
      _cam = { ..._cam, viewMode: VIEW_3D };
      _cam = restoreCameraTransformView3D(_cam);
      _cam = switchFocusToGameObject(_cam, playerPos);
      _cam = saveCameraTransformView3D(_cam);
      _cam = { ..._cam, viewMode: backup };
      _cam = backup === VIEW_2D ? restoreCameraTransformViewFromTop(_cam) : restoreCameraTransformView3D(_cam);
    }
  }

  /** OnPop (:643-659): the live mode's transform is saved, and that is
   *  the whole of it that survives into the port - the render texture
   *  and its Texture2D that DFU destroys here never existed (the c2/S2
   *  bracket draws straight into the panel). */
  _onPop() {
    if (!_cam) return;
    _cam = _cam.viewMode === VIEW_2D ? saveCameraTransformViewFromTop(_cam) : saveCameraTransformView3D(_cam);
  }

  _click() { audio.playOneShot(SOUND.ButtonClick, 1); }

  _close() {
    this._onPop();
    this.done = true;
    this.dispose();
  }

  // ── the verb dispatch: chrome verb NAMES -> camera transitions ─────
  _focusTarget(focus) {
    const p = this.deps.player?.() ?? null;
    if (focus === 'Entrance') {
      const sm = this.deps.startMarker;
      return sm ? [sm.x, sm.y, sm.z] : (p?.feet ?? _cam.pos);
    }
    if (focus === 'RotationAxis') return rotationPivot(_cam);
    return p?.feet ?? _cam.pos;
  }

  /**
   * One verb, one frame. `dt` is unscaled delta time - DFU's speeds are
   * all per-second and Time.unscaledDeltaTime is what it multiplies by
   * (the automap runs with the game paused).
   */
  runVerb(verb, dt = 0) {
    if (!_cam) return;
    const p = this.deps.player?.() ?? null;
    const mainPos = p?.eye ?? p?.feet ?? [0, 0, 0];
    const playerPos = p?.feet ?? mainPos;
    switch (verb) {
      case 'ActionExit': this._close(); return;
      case 'ActionChangeAutomapGridMode': _cam = actionChangeAutomapGridMode(_cam); return;
      // c2/S6: the render-mode verbs (:1666-1696). Each is a bare
      // assignment on the persistent Automap component in DFU, so it
      // survives the window's close exactly as `_renderMode` does.
      case 'ActionSwitchToNextAutomapRenderMode': _renderMode = nextRenderMode(_renderMode); return;
      case 'ActionSwitchToAutomapRenderModeTransparent': _renderMode = 'Transparent'; return;
      case 'ActionSwitchToAutomapRenderModeWireframe': _renderMode = 'Wireframe'; return;
      case 'ActionSwitchToAutomapRenderModeCutout': _renderMode = 'Cutout'; return;
      case 'ActionResetRotationPivotAxis': _cam = actionResetRotationPivotAxis(_cam, playerPos); return;
      case 'ActionResetView': _cam = actionResetView(_cam, mainPos, playerPos); return;
      case 'ActionIncreaseCameraFieldOfView': _cam = actionChangeFieldOfView(_cam, +1, dt); return;
      case 'ActionDecreaseCameraFieldOfView': _cam = actionChangeFieldOfView(_cam, -1, dt); return;
      case 'ActionMoveForward': _cam = actionMoveForward(_cam, dt); return;
      case 'ActionMoveBackward': _cam = actionMoveBackward(_cam, dt); return;
      case 'ActionMoveLeft': _cam = actionMoveLeft(_cam, dt); return;
      case 'ActionMoveRight': _cam = actionMoveRight(_cam, dt); return;
      case 'ActionMoveRotationPivotAxisForward': _cam = actionMovePivotForward(_cam, dt); return;
      case 'ActionMoveRotationPivotAxisBackward': _cam = actionMovePivotBackward(_cam, dt); return;
      case 'ActionMoveRotationPivotAxisLeft': _cam = actionMovePivotLeft(_cam, dt); return;
      case 'ActionMoveRotationPivotAxisRight': _cam = actionMovePivotRight(_cam, dt); return;
      case 'ActionRotateLeft': _cam = actionRotateLeft(_cam, dt); return;
      case 'ActionRotateRight': _cam = actionRotateRight(_cam, dt); return;
      case 'ActionRotateCameraLeft': _cam = actionRotateCamera(_cam, +ROTATE_CAMERA_SPEED, dt); return;
      case 'ActionRotateCameraRight': _cam = actionRotateCamera(_cam, -ROTATE_CAMERA_SPEED, dt); return;
      case 'ActionRotateCameraYZUp': _cam = actionRotateCameraYZ(_cam, +ROTATE_YZ_SPEED_3D, dt); return;
      case 'ActionRotateCameraYZDown': _cam = actionRotateCameraYZ(_cam, -ROTATE_YZ_SPEED_3D, dt); return;
      case 'ActionMoveUpstairs': _cam = actionMoveUpstairs(_cam, dt); return;
      case 'ActionMoveDownstairs': _cam = actionMoveDownstairs(_cam, dt); return;
      case 'ActionIncreaseSliceLevel': _cam = actionIncreaseSliceLevel(_cam, dt); return;
      case 'ActionDecreaseSliceLevel': _cam = actionDecreaseSliceLevel(_cam, dt); return;
      // the hotkey arms scale by dt (:857, :861); the wheel does not
      // (:1859-1866) and hands its own raw speed in
      case 'ActionZoomIn': _cam = actionZoomIn(_cam, ZOOM_SPEED * dt, mainPos); return;
      case 'ActionZoomOut': _cam = actionZoomOut(_cam, ZOOM_SPEED * dt, mainPos); return;
      case 'ActionZoomInWheel': _cam = actionZoomIn(_cam, ZOOM_SPEED_MOUSE_WHEEL, mainPos); return;
      case 'ActionZoomOutWheel': _cam = actionZoomOut(_cam, ZOOM_SPEED_MOUSE_WHEEL, mainPos); return;
      case 'ActionSwitchFocusToNextBeaconObject': {
        // SwitchFocusToNextObject skips an UNDISCOVERED entrance, whose
        // beacon is inactive (Automap.cs:522-548)
        const rec = this.deps.record?.() ?? null;
        const next = switchFocusToNextObject(_cam, { entranceDiscovered: !!rec?.entranceDiscovered });
        _cam = switchFocusToGameObject(next.state, this._focusTarget(next.focus));
        return;
      }
      default: return;   // a verb this window does not own (the note/teleporter gestures are c2/S8)
    }
  }

  // ── input ─────────────────────────────────────────────────────────
  _hotkeyHit(button, code, e) {
    const seq = shortcutOrFallback(button, this.automapBinding);
    if (!seq.code) return false;
    if (normalizeCode(code, e) !== seq.code) return false;
    return checkSetModifiers(keyboardModifiers(e), seq.modifiers);
  }

  /**
   * Update's keyboard half (:713-870), in DFU's order: the toggle-close
   * FIRST, then the down-class hotkeys, then the held-class ones.
   *
   * THE TOGGLE-CLOSE IS TWO-PHASE and stays two-phase here (:718-733):
   * DFU raises `isCloseWindowDeferred` on the key DOWN and closes on the
   * key UP, so the press that opens the map cannot also close it in the
   * same frame. The port's overlay seam carries no key-up route at all
   * (ui/restWindow.js records the same gap), so the latch is drained by
   * the next tick() instead - the window still closes on a LATER frame
   * than the press, which is the behaviour the two phases exist for.
   */
  input(code, e = null) {
    if (this.automapBinding && normalizeCode(code, e) === this.automapBinding) {
      this.isCloseWindowDeferred = true;
      return;
    }
    // ":719 - GetBackButtonDown()" is the same statement as the toggle
    // key, so Escape takes the same door.
    if (normalizeCode(code, e) === 'Escape') { this.isCloseWindowDeferred = true; return; }
    for (const button of HOTKEYS_DOWN) {
      if (!this._hotkeyHit(button, code, e)) continue;
      const bg = BACKGROUND_HOTKEYS[button];
      if (bg) { _background = bg; return; }
      this.runVerb(HOTKEY_VERBS[button], this._dt ?? 0);
      return;
    }
    for (const button of HOTKEYS_HELD) {
      if (!this._hotkeyHit(button, code, e)) continue;
      this.runVerb(HOTKEY_VERBS[button], this._dt ?? 0);
      return;
    }
  }

  /** The pointer seam (ROAD-C c2/S4): native coords, all three phases.
   *  The chrome owns the press-hold flags, the click-on-release law and
   *  the drag protocol; this window owns only what a verb MEANS. */
  pointer(phase, nx, ny, button = 0) {
    if (phase !== 'up') this._mouse = [nx, ny];
    const out = this.chrome.pointer(phase, nx, ny, button);
    if (out.sound) this._click();
    for (const v of out.verbs) this.runVerb(v, this._dt ?? 0);
    if (out.drag) this._applyDrag(out.drag);
  }

  /**
   * The three panel drags (:873-929). DFU measures the mouse bias in
   * REAL SCREEN pixels (`Screen.height - MousePosition.y`, top-left
   * origin - the same sign as the port's native y), and its speeds are
   * tuned against that, so the native-pixel delta the chrome reports is
   * scaled back up by the letterbox factor before it reaches the camera.
   */
  _applyDrag({ kind, dx, dy }) {
    if (!_cam) return;
    const s = this._scale || 1;
    const p = this.deps.player?.() ?? null;
    const mainPos = p?.eye ?? p?.feet ?? [0, 0, 0];
    if (kind === 'pan') { _cam = dragPan(_cam, dx * s, dy * s, mainPos); return; }
    if (kind === 'rotate') { _cam = dragRotate(_cam, dx * s, dy * s); return; }
    // the MIDDLE drag moves the slice, with dt folded in (:925-927)
    _cam = actionMoveSliceLevel(_cam, dy * s, this._dt ?? 0);
  }

  hover(nx, ny) { if (nx >= 0 && ny >= 0) this._mouse = [nx, ny]; }

  /** The wheel (:1855-1866 and GridButton_OnMouseScroll*). The overlay
   *  wheel seam carries no position, so the LAST pointer position is
   *  the target - which is where the wheel actually is. */
  wheel(dir) {
    const [nx, ny] = this._mouse;
    const verb = this.chrome.wheel(nx, ny, dir);
    if (verb) { this.runVerb(verb, this._dt ?? 0); return; }
    // over the render panel itself: zoom at the RAW wheel speed
    if (this.chrome.inDragMode()) return;
    const inPanel = nx >= CHROME_RECTS.panel.x && ny >= CHROME_RECTS.panel.y
      && nx < CHROME_RECTS.panel.x + CHROME_RECTS.panel.w
      && ny < CHROME_RECTS.panel.y + CHROME_RECTS.panel.h;
    if (inPanel) this.runVerb(dir < 0 ? 'ActionZoomInWheel' : 'ActionZoomOutWheel');
  }

  /** DFU's Update(), the frame half: every held flag polled once, the
   *  tooltip clock advanced, and the deferred close drained. */
  tick(dt) {
    this._dt = dt;
    const { verbs, tooltip } = this.chrome.tick(dt);
    for (const v of verbs) { if (!this.done) this.runVerb(v, dt); }
    this._tooltipRect = tooltip;
    if (this.isCloseWindowDeferred && !this.done) {
      this.isCloseWindowDeferred = false;
      this._click();
      this._close();
    }
  }

  /** Release the window's GL resources. Idempotent; also called by
   *  the death presenter when it force-replaces the overlay slot. */
  dispose() {
    this.chrome.releaseAll();
    const r = this._renderer;
    if (!r) return;
    if (this._micro) { r.releaseTexture('amap', this._micro.key); this._micro = null; }
    if (this._markers) {
      r.destroyBillboardBatch(this._markers.entrance);
      r.destroyBillboardBatch(this._markers.player);
      this._markers = null;
    }
  }

  _ensureMarkers(renderer) {
    if (this._markers) return;
    const solid = (name, c) => {
      const colors = new Uint32Array([c]);
      renderer.uploadTexture('amap', name, { width: 1, height: 1, colors });
    };
    solid('entrance', MICRO_GREEN);   // the 0.8 green entrance cube (Automap.cs:1437-1440)
    solid('player', MICRO_RED);       // the red position beacon's stand-in when mesh 99900 is absent
    this._markers = {
      entrance: renderer.createBillboardBatch('amap', 'entrance', { w: 0.8, h: 0.8 }, [[0, 0, 0]]),
      player: renderer.createBillboardBatch('amap', 'player', { w: 0.8, h: 0.8 }, [[0, 0, 0]]),
    };
  }

  /**
   * c2/S6: the two discovery tiers, resolved ONCE per frame over the
   * live draw lists and then issued up to four times (below colour,
   * below gray, above colour, above gray). Each row carries the water
   * level its BLOCK owns - the reveal model's own `waterLevel`
   * metadata, which c2/S1 minted from AddWater's law.
   */
  _partitionDraws(rec) {
    const run = rec.visitedThisRun;
    const byKey = this.deps.model?.byKey ?? null;
    const visited = [];
    const prior = [];
    const push = (mesh, matrix, key) => {
      if (key == null) return;
      const row = run.has(key) ? visited : rec.revealed.has(key) ? prior : null;
      if (row) row.push({ mesh, matrix, water: byKey?.get(key)?.waterLevel ?? null });
    };
    for (const d of this.deps.drawList) push(d.mesh, d.matrix, d.key);
    for (const d of this.deps.dynamicDraws) push(d.gpu, d.object.matrix, d.object.key);
    return { visited, prior };
  }

  /**
   * One draw group at one presentation mode. The WATER LEVEL is
   * uploaded only when it CHANGES: DFU carries it per block in a
   * MaterialPropertyBlock (Automap.cs:1982-2001), and the port's rows
   * arrive block by block already, so this costs one comparison per
   * draw and one upload per block. Deliberately no re-ordering: the
   * transparent group blends unsorted on purpose.
   */
  _drawGroup(renderer, rows, mode, wire = false) {
    if (!rows.length) return;
    renderer.setAutomapMode(mode);
    let water;   // undefined = nothing uploaded for this group yet
    for (const r of rows) {
      if (r.water !== water) { renderer.setAutomapWater(r.water); water = r.water; }
      if (wire) renderer.drawMeshWire(r.mesh, r.matrix, this.deps.texRemap);
      else renderer.drawMesh(r.mesh, r.matrix, this.deps.texRemap);
    }
  }

  // ── draw ──────────────────────────────────────────────────────────
  draw(renderer, canvas, font, s) {
    this._renderer = renderer;
    const m = nativeMetrics(canvas);
    this._scale = m.s;
    const rec = this.deps.record?.() ?? null;
    const p = this.deps.player?.() ?? null;
    this._ensureMarkers(renderer);
    const R = AUTOMAP_PANEL_NATIVE_RECT;
    const rect = { x: m.ox + R.x * m.s, y: m.oy + R.y * m.s, w: R.w * m.s, h: R.h * m.s };
    this._panelRect = rect;

    // ── 1. THE CHROME UNDER THE MAP. DFU's ParentPanel child order is
    // NativePanel (the art, its dummy panels, the buttons, the compass
    // and the status label) FIRST, then panelRenderAutomap, then
    // panelRenderOverlay - so the background art and the alternative
    // background both sit UNDER the map, and the micro-map sits over it.
    //
    // "Always dim background: ParentPanel.BackgroundColor =
    // ScreenDimColor" (:350-351) - and nativePanel.js records why that
    // paints NOTHING: DaggerfallPopupWindow.ScreenDimColor is
    // Color.clear, its setter discards what it is handed, and the
    // constructor forces alpha 0.
    if (SCREEN_DIM[3] > 0) {
      renderer.drawScreenQuad(null, { x: 0, y: 0, w: canvas.width, h: canvas.height }, undefined, SCREEN_DIM);
    }
    if (_art) {
      drawImg(renderer, _art.bg, m, 0, 0);                       // NativePanel.BackgroundTexture (:354)
      // gridButton.BackgroundTexture (:1746-1758) - the 2D icon is the
      // background's own pixels, the 3D icon is AMAP01I0
      if (_cam?.viewMode === VIEW_3D) {
        drawImg(renderer, _art.grid3d, m, GRID_CUTOUT.x, GRID_CUTOUT.y, GRID_CUTOUT.w, GRID_CUTOUT.h);
      } else {
        drawImgCrop(renderer, _art.bg, m,
          [GRID_CUTOUT.x, GRID_CUTOUT.y, GRID_CUTOUT.w, GRID_CUTOUT.h],
          [GRID_CUTOUT.x, GRID_CUTOUT.y, GRID_CUTOUT.w, GRID_CUTOUT.h]);
      }
    } else {
      this._drawKeyedBackdrop(renderer, canvas);
    }
    // dummyPanelAutomap's background: the three alternatives fill the
    // render panel's rect; `original` draws NOTHING (:1702-1706)
    const fill = AUTOMAP_BACKGROUNDS[_background];
    if (fill) drawRect(renderer, m, R.x, R.y, R.w, R.h, fill);

    // ── 2. THE GEOMETRY PASS, inside the renderer's bracket ──────────
    const sliceMaxed = getBool('Map', 'AutomapAlwaysMaxOutSliceLevel');   // float.MaxValue arm (Automap.cs:1299-1302)
    const lens = cameraLens(_cam);
    const aspect = rect.w / Math.max(1, rect.h);
    // HANDEDNESS (mat4's law): this pass culls, so the mirrored X goes
    // on the projection.
    const proj = mirrorProjectionX(perspective(lens.fov * DEG, aspect, lens.near, FAR_CLIP));
    const eye = _cam.pos;
    const view = lookAt(eye, [eye[0] + _cam.fwd[0], eye[1] + _cam.fwd[1], eye[2] + _cam.fwd[2]], _cam.up);
    renderer.panelFrame({
      proj,
      view,
      lightDir: UP_Y,
      rect,
      // THE PASS IS UNLIT. DaggerfallAutomap.shader's fragment is
      // `outColor.rgb = albedo.rgb` - no light term at all - so the
      // three directional lights light only the Standard-material
      // beacons and the geometry runs at the identity: ambient (1,1,1),
      // sun 0, no points, no indirect, no moon, no emission, fog off.
      // `setup` runs after the bracket's save and before beginFrame,
      // which is the only window in which a pass may choose these.
      setup: () => {
        renderer.setClipY(sliceMaxed ? null : slicingPositionY(p?.eye?.[1] ?? eye[1], 0, _cam.slicingBiasY));
        renderer.setFog('off');                                  // NoFogCamera (:2017)
        renderer.setLighting(UNLIT_AMBIENT, 0);
        renderer.setMoonlight(null);
        renderer.setPointLights(NO_POINT_LIGHTS, null, null);
        renderer.setIndirectLight(ZERO3, 0, ZERO3);
        renderer.setWindowEmission(ZERO3);
      },
    }, () => {
      // the revealed-only pass - MeshRenderer.enabled = discovered, as a
      // filter over the LIVE draw lists. Two tiers, DFU's
      // RENDER_IN_GRAYSCALE law (Automap.cs:60-79): visited in THIS run
      // draws in colour, geometry revealed on a PRIOR run draws
      // grayscale; and c2/S6's second axis, the slice - the same two
      // tiers again ABOVE the plane, under the selected render mode.
      if (rec) {
        const { visited, prior } = this._partitionDraws(rec);
        this._drawGroup(renderer, visited, AUTOMAP_MODE.BELOW_COLOUR);
        this._drawGroup(renderer, prior, AUTOMAP_MODE.BELOW_GRAY);
        // THE ABOVE-SLICE GROUP. Cutout issues nothing at all, which is
        // what DFU's `#else clip(-1.0)` arm amounts to; wireframe and
        // transparent are the shader's second pass, blended with the
        // depth mask still ON and in no particular order (the renderer's
        // setAutomapMode owns that flip - the mode IS the queue).
        const above = ABOVE_SLICE_MODES[_renderMode] ?? ABOVE_SLICE_MODES.Cutout;
        if (above.colour !== AUTOMAP_MODE.OFF) {
          this._drawGroup(renderer, visited, above.colour, _renderMode === 'Wireframe');
          this._drawGroup(renderer, prior, above.gray, _renderMode === 'Wireframe');
        }
      }
      // BEACONS ARE NEVER SLICED (nor dimmed, nor grayed): DFU injects
      // the slicing shader into the duplicated GEOMETRY only (:1906);
      // the arrow and markers live under gameobjectBeacons with Standard
      // materials (:1355-1362), so slicing below your feet must not
      // erase your own position marker (A1 review). Both setters upload
      // immediately.
      // c2/S6: the water tint goes off with them. A beacon standing in
      // a flooded block is a Standard-material object in DFU and never
      // saw _WaterLevel at all, and setAutomapMode(0) is also what puts
      // the blend/depth state back to the opaque baseline the marker
      // draws expect.
      renderer.setClipY(null);
      renderer.setAutomapMode(AUTOMAP_MODE.OFF);
      renderer.setAutomapWater(null);
      if (this.deps.arrowMesh && p?.feet) {
        renderer.drawMesh(this.deps.arrowMesh, trs(p.feet[0], p.feet[1], p.feet[2], 0, (p.yaw ?? 0) / DEG, 0), this.deps.texRemap);
      }
      const yaw = cameraYawDeg(_cam) * DEG;
      const camR = new Float32Array([Math.cos(yaw), 0, -Math.sin(yaw)]);
      const camU = new Float32Array([Math.sin(yaw), 0, Math.cos(yaw)]);
      const batches = [];
      const sm = this.deps.startMarker;
      if (rec?.entranceDiscovered && sm) {   // hidden until discovered (:1447-1448)
        this._markers.entrance.origin = [sm.x, sm.y, sm.z];
        batches.push(this._markers.entrance);
      }
      if (!this.deps.arrowMesh && p?.feet) {
        this._markers.player.origin = [...p.feet];
        batches.push(this._markers.player);
      }
      if (batches.length) renderer.drawBillboards(batches, camR, camU);
    });

    // ── 3. THE CHROME OVER THE MAP ───────────────────────────────────
    this._drawMicroMap(renderer, p, m);
    if (_art) {
      // the compass, at dummyPanelCompass's own position, driven by the
      // MAP camera (:503-508 registers cameraAutomap with the compass -
      // it never reads the player's heading)
      const C = CHROME_RECTS.compass;
      drawCompassStrip(renderer, _art, m.ox + C.x * m.s, m.oy + C.y * m.s, m.s,
        compassHeading01(cameraYawDeg(_cam)));
    }
    if (font) {
      // labelHoverText (:483-489): y=192, centred over the whole 320
      // screen, and a PLAIN TextLabel - AddTextLabel, not
      // AddDefaultShadowedTextLabel, so there is no shadow pass.
      shadowText(renderer, font, this.hoverText ?? '', m, 0, HOVER_LABEL.y,
        { align: 'center', w: NATIVE_W, shadowOffset: 0 });
      if (!_art) this._drawKeyedLegend(renderer, m, font, rec);
      // the tooltip is the LAST component drawn, over everything
      const tip = this._tooltipRect ? automapTooltipFor(this._tooltipRect, this.automapBinding) : null;
      if (tip) drawToolTipBox(renderer, m, font, tip, this._mouse[0], this._mouse[1]);
    }
    void s;
  }

  /** The art-less backdrop: the panel rects painted flat so the window
   *  still reads as a window. Nothing here draws over the render panel. */
  _drawKeyedBackdrop(renderer, canvas) {
    const m = nativeMetrics(canvas);
    drawRect(renderer, m, 0, 0, NATIVE_W, NATIVE_H, [0.04, 0.03, 0.02, 0.95]);
    for (const name of ['grid', 'forward', 'backward', 'left', 'right', 'rotateLeft', 'rotateRight', 'upstairs', 'downstairs', 'exit']) {
      const r = CHROME_RECTS[name];
      drawRect(renderer, m, r.x, r.y, r.w, r.h, [0.18, 0.16, 0.12, 1]);
    }
  }

  /** The art-less legend, in place of the button faces. */
  _drawKeyedLegend(renderer, m, font, rec) {
    const pct = this.deps.model?.exploredPercentage?.(rec) ?? 0;   // ExploredPercentage (:2467-2478)
    shadowText(renderer, font, `${this.deps.dungeonName ?? 'Dungeon'} - ${pct}% explored`, m, 2, 173, { shadowOffset: 0 });
    shadowText(renderer, font, `${_cam?.viewMode === VIEW_2D ? '2D' : '3D'}  ${_renderMode}  ${_background}`, m, 2, 182, { shadowOffset: 0 });
  }

  /** The micro-map panel: DFU pins panelRenderOverlay at (0,52) with
   *  size 28x28 (:376-386) and assigns the micro-map texture as its
   *  BACKGROUND - BackgroundLayout.StretchToFill by default
   *  (BaseScreenComponent.cs:77, :799-802), so the bitmap fills that
   *  28x28 rect whatever its own size. At the sizeMin-7 grid that is
   *  exactly double size, which is the case a small dungeon shows.
   *  Rebuilt only when the player crosses a half-block (the marker's own
   *  resolution); versioned keys because uploadTexture memoizes. */
  _drawMicroMap(renderer, p, m) {
    if (getBool('Map', 'AutomapDisableMicroMap')) return;
    const blocks = this.deps.blocks;
    if (!blocks?.length) return;
    const sm = this.deps.startMarker;
    const feet = p?.feet ?? null;
    const stamp = feet ? `${Math.floor(feet[0] * 2 / RDB_SIDE)},${Math.floor(feet[2] * 2 / RDB_SIDE)}` : 'none';
    if (!this._micro || this._micro.stamp !== stamp) {
      const bmp = buildMicroMap(blocks, sm ? [sm.x, 0, sm.z] : null, feet, {
        qol: getBool('Map', 'DungeonMicMapQoL'),
        inner: hexColor32(getString('Map', 'DunMicMapInnerColor'), 0xffd087d4),
        border: hexColor32(getString('Map', 'DunMicMapBorderColor'), 0xff03b4fa),
      });
      if (!bmp) return;
      if (this._micro) renderer.releaseTexture('amap', this._micro.key);
      const key = `micro-${++_microVer}`;
      this._micro = { key, tex: renderer.uploadTexture('amap', key, bmp), w: bmp.width, h: bmp.height, stamp };
    }
    const O = CHROME_RECTS.microMap;
    renderer.drawScreenQuad(this._micro.tex,
      { x: m.ox + O.x * m.s, y: m.oy + O.y * m.s, w: O.w * m.s, h: O.h * m.s });
  }
}
