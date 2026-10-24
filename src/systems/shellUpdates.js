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
const versionOf = (info) => (typeof info?.version === 'string' && /^\d+\.\d+\.\d+$/.test(info.version) ? info.version : null);

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
