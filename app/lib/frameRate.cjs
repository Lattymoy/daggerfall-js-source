// FPS-VSYNC (2026-09-28, Mac, asked whether the desktop app should run above the screen's refresh: "Yes").
//
// DFU's own law (StartGameBehaviour.cs:238-250): VSync ON, every frame waits for the screen and the Frame Rate Cap
// does nothing; VSync OFF, frames do not wait, and the cap is what holds them (under 30 it is off: they run free). A
// page cannot stop waiting - every requestAnimationFrame waits for the screen, which is why `Video/VSync` is
// unavailable in the browser build (src/systems/settings/settings.js) and the cap there only holds frames back
// (src/systems/frameCap.js). The desktop app's Chromium CAN stop waiting, if it is told before it starts. So the shell
// reads the player's own saved setting at launch - the same store the page writes (the `dagger.settings.v1` pref,
// Prefs/ under userData, through the page's own file store) and the same reading (SettingsManager.GetBool:
// 'true', any case, is on; anything else stored is off; nothing stored is DFU's default, on) - and, with VSync off,
// lifts the wait. The page's cap then does the holding, exactly as DFU's targetFrameRate does. A change is read at
// the next start; the settings screen says so (TIER_TEXT.restart).

'use strict';

const { readPref } = require('./fileStorage.cjs');

/** src/systems/settings/settings.js STORAGE_KEY - the page's settings blob (test/ui/settings/disc28e_vsync.test.js holds the two equal). */
const SETTINGS_PREF = 'dagger.settings.v1';

/** Chromium's two waits: the compositor's frame-rate limit, which paces requestAnimationFrame (the one that matters -
 *  measured in the app, alone it frees rAF, ~1000 a second, where `disable-gpu-vsync` alone leaves 60), and the GPU's
 *  swap on the screen's refresh, which Chromium's own switches.cc says the first implies. Both are passed, the pair
 *  Chromium documents - harmless together (AUDIT 28e: this said both must go). */
const VSYNC_OFF_SWITCHES = Object.freeze(['disable-gpu-vsync', 'disable-frame-rate-limit']);

/** The saved `[Video] VSync`, read as the page reads it. An unreadable store is DFU's default (on). The pref's own
 *  file, read alone (fileStorage.cjs readPref) - no store built, so no scan of the save slots at launch. */
function savedVSync(userDataRoot) {
  try {
    const raw = readPref(userDataRoot, SETTINGS_PREF);
    const v = raw ? JSON.parse(raw)?.Video?.VSync : undefined;
    if (v == null) return true;
    return String(v).trim().toLowerCase() === 'true';
  } catch {
    return true;
  }
}

/** The Chromium switches this launch needs: none while VSync is on. */
function frameRateSwitches(userDataRoot) {
  return savedVSync(userDataRoot) ? [] : [...VSYNC_OFF_SWITCHES];
}

module.exports = { SETTINGS_PREF, VSYNC_OFF_SWITCHES, savedVSync, frameRateSwitches };
