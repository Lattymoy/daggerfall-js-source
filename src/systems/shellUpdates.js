// DA8 (2026-09-29, Mac: "Is there anyway to send a notification that a new
// update is available?"): THE DESKTOP APP'S UPDATE, TOLD IN THE GAME.
//
// The shell's launcher installs an update before play; this is for the
// one that lands AFTER - the player chose "Play now" while it downloaded,
// or the hourly re-check found a release mid-session. The shell hands the
// page `{ version, manual }` through its bridge (app/preload.cjs
// onUpdateReady) and this says it on the HUD, through the one door every
// host-less producer uses (systems/notify.js hudTextWhenShown), so a line
// that arrives during the boot waits for the first scene that can speak.
//
// What it says is what the player can DO: an update that is here plays
// from the next start - an installed copy's installer runs at quit, and
// (DA13) a version of the game the shell's own channel brought, every
// copy's, loads with the page - or now, from the File menu; a copy that
// updates the app by hand (macOS, the portable exe) is told where the
// download is. Neither reloads or restarts anything by itself - that is
// the player's call, as SRV-N's build notice decided for the website.
//
// A browser tab has no shell and hears nothing here; its notice is
// SRV-N's (net/updateNotice.js).

/** A version is only ever spoken in the one shape the release carries. */
const versionOf = (info) =>
  typeof info?.version === 'string' && /^\d+\.\d+\.\d+$/.test(info.version) ? info.version : null;

/** The HUD line for an update the shell reports. */
export function updateReadyText(info) {
  const v = versionOf(info);
  const name = v ? `DFO Online ${v}` : 'A new version of DFO Online';
  // DA13: "the next time you start" is true of both kinds of update - an installer's, installed at quit, and a version of
  // the game the shell's own channel brought, which the page loads at its next start
  return info?.manual
    ? `${name} is out. Download it from the File menu when you are ready. Your saves stay where they are.`
    : `${name} is ready. It runs the next time you start, or now from File > Restart to Update. Save first.`;
}

/**
 * Listen, once, for the shell's update news. False (and nothing done) in a
 * browser, or in a shell too old to have the word.
 *
 * @param {any} shell    globalThis.daggerShell
 * @param {(text: string) => void} say
 */
export function listenForShellUpdates(shell, say) {
  if (typeof shell?.onUpdateReady !== 'function' || typeof say !== 'function') return false;
  shell.onUpdateReady((info) => say(updateReadyText(info)));
  return true;
}

// UPDATE-RESTART (2026-10-30 /
// "make sure it updates"): the website's update screen (ui/updateScreen.js) reloads the page, and in the app a reload
// plays the app's own copy again - the build poll there reads that copy, never the site. So in the app the update screen
// is started by the app's own word: an update it has HERE, whole (a version the game channel brought, or an installer
// downloaded), ended by the app restarting onto it (app/main.cjs restartForUpdate). A copy that updates by hand
// (`manual`: macOS, the portable exe) cannot put it in place by itself and keeps the HUD line above.

/** Whether the shell can put this update in place and restart by itself. */
export const shellRestartsFor = (shell, info) =>
  !!info && !info.manual && typeof shell?.restartForUpdate === 'function';

/** @type {((info: any) => void) | null} the newest host's start; @type {any} the update heard, for a host that comes later */
let _start = null;
let _heard = null;
let _listening = false;

/**
 * Start `start(info)` when the shell has an update it can restart onto - now, if one was already heard. One
 * subscription however many times a host asks (the preload keeps the word for a page still booting); the newest host's
 * `start` is the one called. False (and nothing done) in a browser, or in a shell too old to restart.
 *
 * @param {any} shell    globalThis.daggerShell
 * @param {(info: any) => void} start
 */
export function forceShellUpdates(shell, start) {
  if (
    typeof shell?.onUpdateReady !== 'function' ||
    typeof shell?.restartForUpdate !== 'function' ||
    typeof start !== 'function'
  )
    return false;
  _start = start;
  if (_listening) {
    if (_heard) start(_heard);
    return true;
  }
  _listening = true;
  shell.onUpdateReady((info) => {
    if (!shellRestartsFor(shell, info)) return;
    _heard = info;
    _start?.(info);
  });
  return true;
}

/** The tests drive a fresh page per case. */
export function resetShellUpdates() {
  _start = null;
  _heard = null;
  _listening = false;
}
