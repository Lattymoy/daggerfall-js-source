// KB1 (2026-09-23, Mac: "Build 2, hide 2" - the DFU actions bound and read by nothing): THE PRINTSCREEN ACTION.
//
// DFU binds PrintScreen to F8 (InputManager.cs:1030) and reads it nowhere - GameManager's TakeScreenshot is
// commented out (:946-953). The port shipped the same dead row, so F8 did nothing. This is the key made to do what
// its name says: the game canvas, saved as a PNG.
//
// AUDIT KB1 (the hosts lens' first finding): A WORLD ACTION, ROUTED LIKE EVERY OTHER. The first cut was its own
// listener over every host, so it fired under a window too - and DFU's automaps spend F8 on their third background
// colour (systems/dialogShortcuts.js AutomapSwitchToAutomapBackgroundAlternative3), so one F8 there changed the
// background AND downloaded a PNG. The standard's law 2 says a window's keys are the window's; the hosts' ladders
// already keep that law for every action (a window up takes the key first, ui/input.js routeKey's overlay branch),
// so the key goes through them: routeAction's 'PrintScreen' arm calls `printScreen`, and the canvas is handed
// in once at boot (main.js).
//
// THE FRAME, NOT THE BUFFER'S LEFTOVERS. The renderer's context does not preserve its drawing buffer, so reading the
// canvas from inside a key event gets a cleared buffer: the canvas is readable only in the task that drew it.
//
// SHOT1 (2026-10-07, a player's gallery: "Wayrest" and "Daggerfall" kept FULLY BLACK, a battle at Dak'fron kept
// whole): THE SHOT RIDES THE HOST'S FRAME FOOT, NOT A FRAME OF ITS OWN. KB1 queued the read on a requestAnimationFrame
// of its own, on the reasoning that it ran after the host's callback in the same browser frame. Two things the host
// does broke that: (1) FPS-CAP1's HELD FRAME - `frameCapSkip` re-arms and returns, drawing nothing, so on a fast scene
// under a Frame Rate Cap (a town on a 120 Hz screen, every other browser frame held at a 60 cap) the shot's callback read a
// frame nothing had drawn, while a battle running under the cap held no frame and read whole; (2) A PRESS FROM INSIDE
// THE FRAME - the pad's tick (`gamepad?.tick(dt)`, ui/gamepadInput.js) dispatches its button as a synthetic keydown
// inside the host's callback, so the shot's rAF was queued BEFORE the host re-armed its own at its foot and ran first
// next frame, ahead of the draw. So the shot is OWED (`takeScreenshot` queues it here) and the host's frame foot pays
// it (`deliverOwedShots`, after `renderer.resolveFrame()`, beside SS1's `capturePendingScreenshot` - the save's shot,
// which was always taken this way): every host draws the frame first, and a frame that draws nothing never reaches
// a foot, so the shot waits for the next one that does.

import { getPref } from '../systems/uiPrefs.js';   // LOAD1: the download's switch - already on the entry's graph (main.js reads it), so it adds no file there

// LOAD1 (2026-10-05): THE SHOT IS KEPT, TOO. The same PNG goes to the gallery (systems/shotGallery.js) - a JPEG in
// this browser's own IndexedDB, never the repository (Port-Doctrine: a render of game data is game data) - where the
// loading screens stand on it and the menu's Screenshots pane shows it. The download stays, on the player's own
// switch (`shotDownload`, the pane's). The gallery is a DOOR, never a static import: this file is on the entry's
// static graph (main.js), which BOOT2 holds at its ceiling.
export const SHOT_DOWNLOAD_PREF = 'shotDownload';
/** LOAD1: the gallery's door - the PNG, and the place the world says the player stands. */
const keepInGallery = (blob, place) => import('../systems/shotGallery.js').then((g) => g.keepShot(blob, { place }));
/** LOAD1: what the HUD says once the gallery has answered - the id kept, 'full', or null (not kept). */
export function keptLine(kept, downloaded) {
  if (kept === 'full') return downloaded ? 'Screenshot saved. The gallery is full - delete some under Screenshots.' : 'The gallery is full - delete some under Screenshots.';
  if (kept == null) return downloaded ? 'Screenshot saved.' : 'The screenshot could not be kept.';
  return 'Screenshot kept - see Screenshots in the menu.';
}
const sayOnHud = (line) => import('../systems/notify.js').then((n) => n.hudText(line)).catch(() => {});

/** `daggerfall-20260923-141502.png` - local time, sortable, no characters a filesystem refuses. */
export function screenshotName(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `daggerfall-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}.png`;
}

/** AUDIT KB1 (the hosts lens' third finding): how long the object URL outlives the click. Revoked at 0 ms, a browser
 *  that starts the download asynchronously (Firefox, Safari) can find the blob gone and save nothing; FileSaver.js
 *  holds its URL 40 s for exactly this. The blob is one PNG, so holding it that long costs nothing. */
export const REVOKE_AFTER_MS = 40_000;

// SHOT1: THE OWED SHOTS - every press waiting for a drawn frame, in press order (ASYNC NEVER DROPS: two presses
// before one foot are two shots of that frame, never one).
const _owed = [];
/** SHOT1: queue `fn` for the next host frame foot - takeScreenshot's default `afterDraw`. */
export function oweToFrameFoot(fn) { _owed.push(fn); }
/** SHOT1: how many shots wait for a drawn frame (the tests' window). */
export const owedShots = () => _owed.length;
/** SHOT1: THE HOSTS' FRAME FOOT - called after the frame's last draw (`renderer.resolveFrame()`), while the buffer is
 *  still this task's to read: every owed shot is taken from the frame just drawn. Emptied before it runs (THE SLOT IS
 *  EMPTIED BEFORE THE OCCUPANT IS TOLD), so a shot owed during the delivery is the next frame's. Answers the count. */
export function deliverOwedShots() {
  if (!_owed.length) return 0;
  const batch = _owed.splice(0);
  for (const fn of batch) { try { fn(); } catch (e) { console.warn('[shot] the screenshot could not be read:', e?.message ?? e); } }
  return batch.length;
}

/** Save `canvas` as a PNG from the next frame a host draws. Answers a promise of the file name, or null when the
 *  canvas gave no image (a lost context) or the download is switched off. LOAD1: `keep` hands the same PNG to the
 *  gallery (its answer is `said` to the HUD); `download` false skips the file. SHOT1: `afterDraw` is when the canvas
 *  is read - the host's frame foot (`oweToFrameFoot`) by default; the tests pass null to read at once. */
export function takeScreenshot(canvas, {
  afterDraw = oweToFrameFoot, doc = globalThis.document, later = setTimeout,
  keep = null, download = true, said = null,
} = {}) {
  return new Promise((resolve) => {
    const shoot = () => {
      canvas.toBlob((blob) => {
        if (!blob) { resolve(null); return; }
        let name = null;
        if (download) {
          const url = URL.createObjectURL(blob);
          const a = doc.createElement('a');
          a.href = url;
          a.download = screenshotName();
          doc.body.appendChild(a);
          a.click();
          a.remove();
          later(() => URL.revokeObjectURL(url), REVOKE_AFTER_MS);
          name = a.download;
        }
        if (typeof keep === 'function') {
          Promise.resolve().then(() => keep(blob)).catch(() => null).then((kept) => said?.(keptLine(kept, download)));
        }
        resolve(name);
      }, 'image/png');
    };
    if (typeof afterDraw === 'function') afterDraw(shoot); else shoot();
  });
}

let _canvas = null;
let _shoot = takeScreenshot;
let _place = () => '';
/** Boot hands the game canvas in, once (main.js). `shoot` is the tests' seam. */
export function setScreenshotCanvas(canvas, { shoot = takeScreenshot } = {}) { _canvas = canvas ?? null; _shoot = shoot; }
/** LOAD1: the world host says where the player stands (scenes/world.js), so a kept shot carries its place. */
export function setShotPlace(fn) { _place = typeof fn === 'function' ? fn : () => ''; }
const placeNow = () => { try { return String(_place() ?? ''); } catch { return ''; } };
/** routeAction's PrintScreen arm: true when a shot was taken (a canvas stands), false otherwise - so a host with no
 *  canvas leaves the key alone, as every door-less arm does. */
export function printScreen() {
  if (!_canvas) return false;
  const place = placeNow();   // where the key was pressed, not where the gallery's answer finds the player
  _shoot(_canvas, { keep: (blob) => keepInGallery(blob, place), download: getPref(SHOT_DOWNLOAD_PREF) !== false, said: sayOnHud });
  return true;
}
