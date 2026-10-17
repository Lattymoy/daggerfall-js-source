// DA7 (2026-09-21, Mac: "Is there an easy way to make it where players
// dont have to manually install each release?" - "#1 is best?" - "Do it"):
// THE AUTO-UPDATER'S PURE HALF - which transport a running copy of the
// app updates by.
//
// Every main push cuts a release (REL3), so a player on the DA6 notice
// alone was asked to download and install several times a day. The
// installers electron-builder already cuts - NSIS on Windows, AppImage
// on Linux - are exactly the two electron-updater can replace in place:
// it reads the release's `latest.yml`, downloads the new installer (a
// block delta where one exists), and installs it when the app quits.
// Nothing is asked of the player.
//
// WHAT CANNOT SELF-UPDATE, and keeps the DA6 notice instead:
//   - macOS: an unsigned app cannot replace itself there at all (the
//     OS refuses the swap), and no signing identity exists.
//   - the Windows PORTABLE exe: it is a bare file that unpacks into
//     %TEMP% and runs from there - there is no install to update. It
//     DOES carry an app-update.yml (electron-builder writes it into the
//     win-unpacked folder both Windows targets pack - AUDIT INSTALL R2-C5,
//     read out of a published portable exe), so `configured` says nothing
//     about it: the portable launcher's own mark on its process
//     (PORTABLE_EXECUTABLE_DIR) is the test, and it is asked FIRST.
//   - an unpackaged run (`electron .`): there is no installed copy.
//   - a Linux copy that is not RUNNING AS its AppImage (extracted, or the
//     unpacked folder): electron-updater replaces only the AppImage named by
//     APPIMAGE, and declines to check at all without one - the File menu's
//     check then said "You're up to date" off a check never made (AUDIT
//     INSTALL R2-A10).
//   - a build cut WITHOUT a release (a dispatched "try this build"): it
//     carries no app-update.yml (the workflow builds it with publish:
//     null), so it has no release of its own to follow - and the one it
//     would find is the public one, which DA8's launcher would install
//     over it before it ever ran (AUDIT INSTALL L3-4).
//
// Pure, no Electron, so `node --test` pins the table
// (test/tooling/autoupdate.test.js) and app/main.cjs keeps only the wiring.
'use strict';

/**
 * Which transport this copy updates by.
 * @param {{ packaged: boolean, platform: string, portable: boolean, configured?: boolean, appImage?: boolean }} env
 *   `configured`: the copy carries electron-updater's app-update.yml;
 *   `appImage`: on Linux, it runs as its AppImage (APPIMAGE is set)
 * @returns {'updater' | 'notice'} 'updater' = electron-updater installs
 *   in place on quit; 'notice' = DA6's dialog with a Download button.
 */
function updateTransport({ packaged, platform, portable, configured = true, appImage = true }) {
  if (!packaged) return 'notice';
  if (portable) return 'notice';
  if (!configured) return 'notice';
  if (platform === 'darwin') return 'notice';
  if (platform === 'linux' && !appImage) return 'notice';
  return 'updater';
}

module.exports = { updateTransport };
