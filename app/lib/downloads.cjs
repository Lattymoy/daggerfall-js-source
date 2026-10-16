// REL5 (2026-09-29, Mac: "How can we drastically improve the install
// experience?"): THE DOWNLOADS HAVE NAMES THAT DO NOT MOVE.
//
// Every release used to carry its build number in each file's name
// (<name>-0.1.4684-win-x64-setup.exe), so no link could point
// at "the Windows installer" - only at a release PAGE, where a player
// met eleven files: four installers, three updater manifests, two
// blockmaps and GitHub's two source archives. The landing page runs no
// script (U60), so it could not look the right file up either. With the
// number out of the name, GitHub answers
// releases/latest/download/<name> with the newest copy of that file, for
// ever, and the site links each platform's installer directly.
//
// The number is not lost: it is the release's TAG (app-v0.1.N), the
// version stamped inside every file, and the `version:` line of the
// latest*.yml manifests electron-updater reads. The updater never keyed
// on a file name - it reads the name out of the manifest - and its
// differential download finds the previous release's blockmap by
// swapping the version inside the URL, which the tag segment still
// carries (electron-updater Provider.getBlockMapFiles). A copy that has
// updated before keeps that blockmap in its cache and does not ask.
//
// THESE ARE A CONTRACT, checked at both ends: app/package.json's
// artifactName templates must produce exactly these names
// (test/tooling/rel4_release.test.js), and the release workflow's publish job
// refuses a set that lacks any of them (scripts/desktopRelease.mjs
// check) - so a naming change in electron-builder fails the release
// before a single dead link goes live.
'use strict';

const RELEASES_URL = 'https://github.com/Lattymoy/daggerfall-js-source/releases';

/** The four files a player downloads, one per way to run the app. */
const DOWNLOAD_FILES = Object.freeze({
  winSetup: 'DFO-Online-win-x64-setup.exe',
  winPortable: 'DFO-Online-win-x64-portable.exe',
  mac: 'DFO-Online-mac-arm64.dmg',
  linux: 'DFO-Online-linux-x86_64.AppImage',
});

/** BR5 (2026-10-11): THE NAMES BEFORE THE RENAME. Every copy built
 *  before BR5 asks for its download - the notice transport's Download, the
 *  launcher's Reinstall - by the name it was built with, at
 *  releases/latest/download/<name>, and nothing it holds can learn a new
 *  one. So each release carries a copy of each download under its old name
 *  as well (scripts/desktopRelease.mjs alias), and a copy from before the
 *  rename never meets a dead link. A copy from BR5 on reads its download
 *  off the release itself (releaseAssetUrl) and needs no alias for a
 *  later rename. These names are the only place the old product name is
 *  still published; they go once no copy older than BR5 is left to ask. */
const LEGACY_DOWNLOAD_FILES = Object.freeze({
  winSetup: 'DaggerfallOnline-win-x64-setup.exe',
  winPortable: 'DaggerfallOnline-win-x64-portable.exe',
  mac: 'DaggerfallOnline-mac-arm64.dmg',
  linux: 'DaggerfallOnline-linux-x86_64.AppImage',
});

/** The URL that always serves the newest release's copy of `file`. */
const latestDownloadUrl = (file) => `${RELEASES_URL}/latest/download/${file}`;

/** The part of a download's name that says how it runs (`-mac-arm64.dmg`,
 *  `-win-x64-portable.exe`). What stands before it is the product's name,
 *  which can change (BR5); this part does not. */
const platformTail = (file) => /-(?:win|mac|linux)-[^/]+$/.exec(file)?.[0] ?? null;

/** BR5: `file`'s link as the release ITSELF lists it - GitHub's answer to
 *  releases/latest, whose `assets` carry each file's name and
 *  browser_download_url - by its own name, else by the way to run it
 *  (platformTail), so a later rename of the product reaches this copy
 *  through the release it reads. Only GitHub's own download links for
 *  this repository are taken; null where the release lists neither. */
function releaseAssetUrl(release, file) {
  const assets = Array.isArray(release?.assets) ? release.assets : [];
  const link = (a) => (typeof a?.browser_download_url === 'string' && a.browser_download_url.startsWith(`${RELEASES_URL}/download/`)
    ? a.browser_download_url : null);
  const exact = assets.find((a) => a?.name === file && link(a));
  if (exact) return link(exact);
  const tail = platformTail(file);
  const same = tail && assets.find((a) => typeof a?.name === 'string' && a.name.endsWith(tail) && link(a));
  return same ? link(same) : null;
}

/** The file THIS copy runs from, by the name that never moves: the dmg on
 *  macOS, the portable exe for the portable, the setup exe for an
 *  installed Windows copy, the AppImage on Linux - and null where there
 *  is no one file to name (an unpackaged run). What a copy on the NOTICE
 *  transport (lib/autoUpdate.cjs) downloads to update by hand, and what
 *  the launcher's Reinstall downloads (DA10). */
function manualDownloadFile({ platform, portable, packaged }) {
  if (!packaged) return null;
  if (platform === 'darwin') return DOWNLOAD_FILES.mac;
  if (platform === 'win32') return portable ? DOWNLOAD_FILES.winPortable : DOWNLOAD_FILES.winSetup;
  if (platform === 'linux') return DOWNLOAD_FILES.linux;
  return null;
}

module.exports = { RELEASES_URL, DOWNLOAD_FILES, LEGACY_DOWNLOAD_FILES, latestDownloadUrl, releaseAssetUrl, manualDownloadFile };
