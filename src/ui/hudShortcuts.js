// AUDIT 64 F36 + F37 - THE HUD'S OWN SHORTCUT ARMS.
//
// DaggerfallHUD.Update polls five DaggerfallShortcut bindings every
// frame (DaggerfallHUD.cs:295-326). The port had the whole binding
// TABLE (systems/dialogShortcuts.js:199 lists them, :317 gives the
// defaults F10 and Shift-F10) and no consumer for any of them, so both
// keys were free and did nothing.
//
// Two of the five are ported here:
//
//   LargeHUDToggle (:308-312) - `DaggerfallUnity.Settings.LargeHUD =
//   !DaggerfallUnity.Settings.LargeHUD`. The setting is a LIVE-tier key
//   the port already re-reads every frame (ui/hudLarge.js
//   largeHudEnabled -> largeHudOptions), and the HUD-mode-flip detector
//   reset (ui/hudVitals.js) already stands in for the
//   OnLargeHUDToggle event DFU raises on the change (:237-238), so the
//   write is the whole of the missing half. It is an in-memory
//   assignment in DFU - settings.ini is persisted elsewhere - so this
//   does NOT save.
//
//   HUDToggle (:314-318) - `renderHUD = !renderHUD`, read by the Draw
//   override at :347-351 (`if (renderHUD) base.Draw()`). Draw is
//   suppressed WHOLE - every ParentPanel and NativePanel component of
//   the HUD window - while Update keeps running, which is why the flag
//   lives here and is read by ui/hud.js's paint gate rather than by a
//   host frame that would also stop the vitals detector.
//
// The three the port still has no destination for are named for the
// record and are NOT ported: DebuggerToggle (:297-301, the quest
// debugger overlay), Pause (:303-306, reached in this port through the
// Escape action's pause door) and ToggleRetroPP (:320-326, there is no
// retro post-processing pass).
//
// This module imports only systems leaves so that ui/input.js - the
// one keydown door two of the four hosts route through - can take it
// without a cycle (ui/hudLarge.js imports ui/input.js).

import { getBool, setValue } from '../systems/settings.js';
import { hotkeyHit } from '../systems/dialogShortcuts.js';

// DaggerfallHUD.cs:47 `bool renderHUD = true;`
let _renderHud = true;

/** The Draw override's predicate (:349). */
export const hudRenderEnabled = () => _renderHud;

/** :317 `renderHUD = !renderHUD` - the one writer, exported so a host
 *  seam and the tests reach the same flag. */
export function toggleHudRender() {
  _renderHud = !_renderHud;
  return _renderHud;
}

/** Tests only: put the flag back where a fresh HUD starts (:47). */
export function _resetHudRender() { _renderHud = true; }

/**
 * The two shortcut arms of DaggerfallHUD.Update, for one keydown.
 * Returns true when the key was consumed.
 *
 * `IsDownWith` is Unity's GetKeyDown - ONE edge per press - so a
 * browser's autorepeat is dropped (`e.repeat`), or holding F10 would
 * flip the setting every repeat.
 *
 * The caller owns the window gate: DaggerfallUI.cs:429-433 updates
 * only `uiManager.TopWindow`, so DaggerfallHUD.Update - and with it
 * both arms - is dead while any window is open.
 */
export function hudShortcutKey(e, keys = null) {
  if (!e || e.repeat) return false;
  // :309-311 - the LargeHUD setting, written in memory only.
  if (hotkeyHit('LargeHUDToggle', e.code, e, keys)) {
    setValue('GUI', 'LargeHUD', !getBool('GUI', 'LargeHUD'));
    return true;
  }
  // :315-317 - renderHUD. CheckSetModifiers (dialogShortcuts.js:156-159)
  // is what keeps Shift-F10 off F10 and F10 off Shift-F10, so the two
  // arms cannot both answer one press.
  if (hotkeyHit('HUDToggle', e.code, e, keys)) {
    toggleHudRender();
    return true;
  }
  return false;
}
