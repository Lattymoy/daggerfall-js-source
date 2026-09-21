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
//     %TEMP% and runs from there - there is no install to update, and
//     electron-builder writes no app-update.yml into it. The portable
//     launcher marks its process with PORTABLE_EXECUTABLE_DIR.
//   - an unpackaged run (`electron .`): there is no installed copy.
//
// Pure, no Electron, so `node --test` pins the table
// (test/autoupdate.test.js) and app/main.cjs keeps only the wiring.
'use strict';

/**
 * Which transport this copy updates by.
 * @param {{ packaged: boolean, platform: string, portable: boolean }} env
 * @returns {'updater' | 'notice'} 'updater' = electron-updater installs
 *   in place on quit; 'notice' = DA6's dialog with a Download button.
 */
function updateTransport({ packaged, platform, portable }) {
  if (!packaged) return 'notice';
  if (portable) return 'notice';
  if (platform === 'darwin') return 'notice';
  return 'updater';
}

module.exports = { updateTransport };
