// ROAD-C c2/S5: THE AUTOMAP TEXT BLOCK - Internal_Strings.csv rows
// 874-890, verbatim, plus DFU's two rules for turning them into what a
// player reads.
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

/** String.Format over the row: {0}, {1}, ... take the named buttons'
 *  sequences, each through ShortcutOrFallback first. */
export function automapText(key, buttons = [], automapBinding = null) {
  const raw = AUTOMAP_STRINGS[key];
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
