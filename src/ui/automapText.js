// ROAD-C c2/S5: THE AUTOMAP TEXT BLOCK - Internal_Strings.csv rows
// 874-890, verbatim, plus DFU's two rules for turning them into what a
// player reads. ROAD-D D5 ADDED THE EXTERIOR HALF (rows 908-917), and
// it belongs in this one module for the same reason the seven
// hover-text rows do: the two blocks share BOTH rules - the same
// KeyCode.Home ShortcutOrFallback and the same String.Format over
// HotkeySequence.ToString - and a second copy of either is the copy
// that drifts.
//
// WHY VERBATIM MATTERS TWICE OVER. These strings are not decoration:
// the compass tooltip is the ONLY place the game ever tells you that
// double-clicking makes a note marker, that Ctrl skips the note
// prompt, that a right double-click moves the rotation axis, or what
// the three beacon colours mean. A paraphrase deletes a feature's only
// documentation. And the ROWS ARE STORED WITH THE ESCAPE, not the
// control character: the CSV writes a literal two-character \r
// between lines and ui/toolTip.js's UpdateTextRows (:238-256) is what
// collapses it, so the strings below carry the escape exactly as the
// file does and nothing here re-spells it.
//
// THE HOTKEY SUBSTITUTION is String.Format over HotkeySequence.ToString
// (DaggerfallAutomapWindow.cs:263-274), through TWO laws:
//  - ShortcutOrFallback (:277-284): a shortcut whose KEY CODE equals
//    the player's own AutoMap open/close binding is re-pointed at the
//    FALLBACK KEY, KeyCode.Home (:75) - otherwise the key that opens
//    the map would also drive a button while it is open. The test is
//    the key code ALONE: modifiers do not save a sequence.
//  - the sequence prints through sequenceString (systems/
//    dialogShortcuts.js), whose key half is the browser code, which is
//    this port's KeyCode.
//
// The seven :884-890 rows are GetMouseHoverOverText's answers
// (Automap.cs:555-614) - S7's picker consumes them; they live here
// because the block is one block and splitting it is how one half
// drifts.

import { shortcutBinding, sequenceString, hotkeySequence } from '../systems/dialogShortcuts.js';

/** DaggerfallAutomapWindow.fallbackKey (:75). */
export const AUTOMAP_FALLBACK_KEY = 'Home';

/** Internal_Strings.csv:874-890, byte for byte. */
export const AUTOMAP_STRINGS = Object.freeze({
  automapToolTipTextGridButton: "left click: switch between 2D top view and 3D view (hotkey: {0})\\rright click: reset rot. axis to player pos (hotkey: {1})\\rmouse wheel up while over btn: inc. perspective (only 3D mode)\\rmouse wheel down while over btn: dec. perspective (only 3D mode)",
  automapToolTipForwardButton: "left click: move viewpoint forward (hotkey: {0})\\rright click: move rotation axis forward (hotkey: {1})",
  automapToolTipBackwardButton: "left click: move viewpoint backwards (hotkey: {0})\\rright click: move rotation axis backwards (hotkey: {1})",
  automapToolTipLeftButton: "left click: move viewpoint to the left (hotkey: {0})\\rright click: move rotation axis to the left (hotkey: {1})",
  automapToolTipRightButton: "left click: move viewpoint to the right (hotkey: {0})\\rright click: move rotation axis to the right (hotkey: {1})",
  automapToolTipRotateLeftButton: "left click: rotate dungeon to the left (hotkey: {0})\\rright click: rotate camera to the left (hotkey: {1})",
  automapToolTipRotateRightButton: "left click: rotate dungeon to the right (hotkey: {0})\\rright click: rotate camera to the right (hotkey: {1})",
  automapToolTipUpstairsButton: "left click: increase viewpoint (hotkey: {0})\\rright click: increase slice level (hotkey: {1})\\rslice level can also be adjusted by holding down middle mouse btn\\r\\rhint: different render modes may show hidden geometry:\\rhotkey {2}: cutout mode\\rhotkey {3}: wireframe mode\\rhotkey {4}: transparent mode\\rswitch between modes with return key\\r",
  automapToolTipDownstairsButton: "left click: decrease viewpoint (hotkey: {0})\\rright click: decrease slice level (hotkey: {1})\\rslice level can also be adjusted by holding down middle mouse btn\\r\\rhint: different render modes may show hidden geometry:\\rhotkey {2}: cutout mode\\rhotkey {3}: wireframe mode\\rhotkey {4}: transparent mode\\rswitch between modes with return key\\r",
  automapToolTipPanelCompass: "left click: toggle focus (hotkey: {0})\\rbeacons: red ... player, green ... entrance, blue ... rotation axis\\r\\rright click: reset view (hotkey: {1})\\r\\rdouble-click left mouse btn in window to create+edit marker note\\rdouble-click left mouse btn (+Ctrl key) in window to create marker\\rdouble-click left mouse btn on a marker to add/edit a note\\rdouble-click right mouse btn on a marker to delete it\\rdouble-click right mouse btn in window to position rotation axis\\rdouble-click middle mouse btn in window to center view\\rdouble-click left mouse btn on discovered portal marker to jump\\rto connected teleporter portal",
  automapPlayerPositionBeacon: "player position beacon",
  automapRotationPivotAxis: "rotation pivot axis",
  automapEntranceExitPositionBeacon: "entrance/exit position beacon",
  automapEntranceExit: "entrance/exit",
  automapPlayerMarker: "player marker",
  automapTeleporterEntrance: "teleporter (entrance)",
  automapTeleporterExit: "teleporter (exit)",
  // c2/S8 - Internal_Strings.csv:1057, the note editor's prompt
  // (EditUserNote's SetTextBoxLabel, Automap.cs:1596). The trailing
  // space is in the CSV.
  youNote: "You note: ",
});

/**
 * ShortcutOrFallback (:277-284). `automapBinding` is the player's live
 * AutoMap key (a browser code, or null for an unbound row - DFU's
 * KeyCode.None, which IsSameKeyCode can never match).
 */
export function shortcutOrFallback(button, automapBinding) {
  const seq = shortcutBinding(button);
  if (automapBinding && seq.code === automapBinding) return hotkeySequence(AUTOMAP_FALLBACK_KEY, seq.modifiers);
  return seq;
}

/**
 * THE EXTERIOR HALF OF THE SAME BLOCK - Internal_Strings.csv:908-917,
 * byte for byte, INCLUDING ITS TYPOS. Two of these rows are misprinted
 * in the reference data and a player really does read them that way:
 * `exteriorAutomapToolTipUpstairsButton` closes a parenthesis it never
 * opened ("apply maximum zoom)") and
 * `exteriorAutomapToolTipDownstairsButton` opens one it never closes
 * ("(hotkey: {0}" ... "apply minimum zoom)"); the rotate-left row
 * carries a DOUBLE SPACE before its "(hotkey: {1})". Fixing any of the
 * three would be a departure from the shipped strings, so none is
 * fixed.
 *
 * The same two laws that format the dungeon block format this one:
 * ShortcutOrFallback with the SAME KeyCode.Home fallback
 * (DaggerfallExteriorAutomapWindow.cs:55, :217-224 - the exterior
 * window's copy of the dungeon window's :277-284), and
 * String.Format over HotkeySequence.ToString (:230-239). Only the
 * SHORTCUT NAMES differ: the thirty `ExtAutomap*` rows of
 * systems/dialogShortcuts.js.
 */
export const EXTERIOR_AUTOMAP_STRINGS = Object.freeze({
  exteriorAutomapToolTipTextGridButton: "left click: switch to next view mode (hotkey: {0})\\ravailable view modes are:\\r- original (hotkey {1})\\r- extra: includes extra buildings (hotkey {2})\\r- all: includes extra buildings, ground flats (hotkey {3})\\rswitch background texture with {4}, {5}, {6}, {7}",
  exteriorAutomapToolTipForwardButton: "left click: move up (hotkey: {0})\\rright click: move to north location border (hotkey: {1})",
  exteriorAutomapToolTipBackwardButton: "left click: move down (hotkey: {0})\\rright click: move to south location border (hotkey: {1})",
  exteriorAutomapToolTipLeftButton: "left click: move to the left (hotkey: {0})\\rright click: move to west location border (hotkey: {1})",
  exteriorAutomapToolTipRightButton: "left click: move to the right (hotkey: {0})\\rright click: move to east location border (hotkey: {1})",
  exteriorAutomapToolTipRotateLeftButton: "left click: rotate map to the left (hotkey: {0})\\rright click: rotate map around the player position\\rto the left  (hotkey: {1})",
  exteriorAutomapToolTipRotateRightButton: "left click: rotate map to the right (hotkey: {0})\\rright click: rotate map around the player position\\rto the right (hotkey: {1})",
  exteriorAutomapToolTipUpstairsButton: "left click: zoom in (hotkey: {0})\\rright click: apply maximum zoom)",
  exteriorAutomapToolTipDownstairsButton: "left click: zoom out (hotkey: {0}\\rright click: apply minimum zoom)",
  exteriorAutomapToolTipPanelCompass: "left click: focus player position (hotkey: {0})\\rright click: reset view (hotkey: {1})",
});

/** String.Format over the row: {0}, {1}, ... take the named buttons'
 *  sequences, each through ShortcutOrFallback first. `strings` is the
 *  block the key lives in - the dungeon's by default, the exterior's
 *  for the town map. */
export function automapText(key, buttons = [], automapBinding = null, strings = AUTOMAP_STRINGS) {
  const raw = strings[key];
  if (raw === undefined) return '';
  return raw.replace(/\{(\d+)\}/g, (m, i) => {
    const button = buttons[Number(i)];
    return button ? sequenceString(shortcutOrFallback(button, automapBinding)) : m;
  });
}

/**
 * UpdateButtonToolTipsText (:262-274): which string each chrome rect
 * carries and WHICH BUTTONS fill its slots, in DFU's own order. The
 * rect names are ui/automapChrome.js's.
 */
export const AUTOMAP_TOOLTIPS = Object.freeze({
  grid: Object.freeze({ key: 'automapToolTipTextGridButton', buttons: Object.freeze(['AutomapSwitchAutomapGridMode', 'AutomapResetRotationPivotAxisView']) }),
  forward: Object.freeze({ key: 'automapToolTipForwardButton', buttons: Object.freeze(['AutomapMoveForward', 'AutomapMoveRotationPivotAxisForward']) }),
  backward: Object.freeze({ key: 'automapToolTipBackwardButton', buttons: Object.freeze(['AutomapMoveBackward', 'AutomapMoveRotationPivotAxisBackward']) }),
  left: Object.freeze({ key: 'automapToolTipLeftButton', buttons: Object.freeze(['AutomapMoveLeft', 'AutomapMoveRotationPivotAxisLeft']) }),
  right: Object.freeze({ key: 'automapToolTipRightButton', buttons: Object.freeze(['AutomapMoveRight', 'AutomapMoveRotationPivotAxisRight']) }),
  rotateLeft: Object.freeze({ key: 'automapToolTipRotateLeftButton', buttons: Object.freeze(['AutomapRotateLeft', 'AutomapRotateCameraLeft']) }),
  rotateRight: Object.freeze({ key: 'automapToolTipRotateRightButton', buttons: Object.freeze(['AutomapRotateRight', 'AutomapRotateCameraRight']) }),
  upstairs: Object.freeze({
    key: 'automapToolTipUpstairsButton',
    buttons: Object.freeze(['AutomapUpstairs', 'AutomapIncreaseSliceLevel', 'AutomapSwitchToAutomapRenderModeCutout', 'AutomapSwitchToAutomapRenderModeWireframe', 'AutomapSwitchToAutomapRenderModeTransparent']),
  }),
  downstairs: Object.freeze({
    key: 'automapToolTipDownstairsButton',
    buttons: Object.freeze(['AutomapDownstairs', 'AutomapDecreaseSliceLevel', 'AutomapSwitchToAutomapRenderModeCutout', 'AutomapSwitchToAutomapRenderModeWireframe', 'AutomapSwitchToAutomapRenderModeTransparent']),
  }),
  compass: Object.freeze({ key: 'automapToolTipPanelCompass', buttons: Object.freeze(['AutomapSwitchFocusToNextBeaconObject', 'AutomapResetView']) }),
});

/** The tooltip a named chrome rect shows, or null - the EXIT button and
 *  the render panel carry none, exactly as DFU leaves them. */
export function automapTooltipFor(rectName, automapBinding = null) {
  const row = AUTOMAP_TOOLTIPS[rectName];
  return row ? automapText(row.key, row.buttons, automapBinding) : null;
}

/**
 * The EXTERIOR window's UpdateButtonToolTipsText
 * (DaggerfallExteriorAutomapWindow.cs:230-239) - the same ten rects,
 * different rows and different slots. Read the {0}..{7} order off the
 * C# argument lists, NOT off the sentences: the grid row's eight slots
 * are next-view-mode, the three DIRECT view modes, then the four
 * backgrounds; the stair rows take the ZOOM IN / ZOOM OUT shortcuts
 * (ExtAutomapZoomIn/ZoomOut - the keypad pair), NOT the Upstairs and
 * Downstairs rows their BUTTONS are named after, and neither row
 * substitutes a hotkey for its right-click max/min zoom at all; the
 * compass row takes FocusPlayerPosition and ResetView.
 */
export const EXTERIOR_AUTOMAP_TOOLTIPS = Object.freeze({
  grid: Object.freeze({
    key: 'exteriorAutomapToolTipTextGridButton',
    buttons: Object.freeze([
      'ExtAutomapSwitchToNextExteriorAutomapViewMode',
      'ExtAutomapSwitchToExteriorAutomapViewModeOriginal',
      'ExtAutomapSwitchToExteriorAutomapViewModeExtra',
      'ExtAutomapSwitchToExteriorAutomapViewModeAll',
      'ExtAutomapSwitchToExteriorAutomapBackgroundOriginal',
      'ExtAutomapSwitchToExteriorAutomapBackgroundAlternative1',
      'ExtAutomapSwitchToExteriorAutomapBackgroundAlternative2',
      'ExtAutomapSwitchToExteriorAutomapBackgroundAlternative3',
    ]),
  }),
  forward: Object.freeze({ key: 'exteriorAutomapToolTipForwardButton', buttons: Object.freeze(['ExtAutomapMoveForward', 'ExtAutomapMoveToNorthLocationBorder']) }),
  backward: Object.freeze({ key: 'exteriorAutomapToolTipBackwardButton', buttons: Object.freeze(['ExtAutomapMoveBackward', 'ExtAutomapMoveToSouthLocationBorder']) }),
  left: Object.freeze({ key: 'exteriorAutomapToolTipLeftButton', buttons: Object.freeze(['ExtAutomapMoveLeft', 'ExtAutomapMoveToWestLocationBorder']) }),
  right: Object.freeze({ key: 'exteriorAutomapToolTipRightButton', buttons: Object.freeze(['ExtAutomapMoveRight', 'ExtAutomapMoveToEastLocationBorder']) }),
  rotateLeft: Object.freeze({ key: 'exteriorAutomapToolTipRotateLeftButton', buttons: Object.freeze(['ExtAutomapRotateLeft', 'ExtAutomapRotateAroundPlayerPosLeft']) }),
  rotateRight: Object.freeze({ key: 'exteriorAutomapToolTipRotateRightButton', buttons: Object.freeze(['ExtAutomapRotateRight', 'ExtAutomapRotateAroundPlayerPosRight']) }),
  upstairs: Object.freeze({ key: 'exteriorAutomapToolTipUpstairsButton', buttons: Object.freeze(['ExtAutomapZoomIn']) }),
  downstairs: Object.freeze({ key: 'exteriorAutomapToolTipDownstairsButton', buttons: Object.freeze(['ExtAutomapZoomOut']) }),
  compass: Object.freeze({ key: 'exteriorAutomapToolTipPanelCompass', buttons: Object.freeze(['ExtAutomapFocusPlayerPosition', 'ExtAutomapResetView']) }),
});

/** The exterior window's tooltip for a named chrome rect, or null -
 *  the EXIT button, the render panel and the micro-map rect carry none
 *  (the exterior window builds no overlay panel at all). */
export function exteriorAutomapTooltipFor(rectName, automapBinding = null) {
  const row = EXTERIOR_AUTOMAP_TOOLTIPS[rectName];
  return row ? automapText(row.key, row.buttons, automapBinding, EXTERIOR_AUTOMAP_STRINGS) : null;
}
