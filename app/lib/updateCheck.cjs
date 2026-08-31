// DA6: THE UPDATE NOTICE's pure half - is that release newer than me?
//
// The desktop app has no auto-updater on purpose (unsigned builds
// cannot auto-update on macOS at all, and nothing here should apply
// code silently). What it has is a NOTICE: one read-only GET to the
// GitHub releases API, a version compare, and a dialog that opens the
// download page in the player's browser. This module is the compare -
// pure, no Electron, no network - so `node --test` pins the ordering
// laws (test/updatecheck.test.js) and app/main.cjs keeps only the
// fetch and the dialog.
//
// THE FAILURE DIRECTION IS SILENCE. A tag that does not parse, a
// version that does not parse, a missing field - all answer "not
// newer". A wrong notice nags every launch; a missed one costs
// nothing (the next release notices too, and the manual menu check
// reports failure out loud).

'use strict';

/** 'app-v1.2.3' -> [1,2,3]; anything else -> null. The release tags
 *  are the app-v* shape release-desktop.yml cuts - a site tag or a
 *  garbage tag must never read as an update. */
function parseReleaseTag(tag) {
  const m = /^app-v(\d+)\.(\d+)\.(\d+)$/.exec(String(tag ?? '').trim());
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

/** '1.2.3' (app.getVersion(), package.json's spelling) -> [1,2,3]. */
function parseVersion(v) {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(v ?? '').trim());
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

/** Is the release tag strictly newer than the running version?
 *  Numeric per-part compare - 'app-v0.10.0' beats '0.9.9', which a
 *  string compare gets wrong. Equal is not newer. Unparseable
 *  (either side) is not newer. */
function isNewerRelease(currentVersion, tag) {
  const cur = parseVersion(currentVersion);
  const rel = parseReleaseTag(tag);
  if (!cur || !rel) return false;
  for (let i = 0; i < 3; i++) {
    if (rel[i] > cur[i]) return true;
    if (rel[i] < cur[i]) return false;
  }
  return false;
}

module.exports = { parseReleaseTag, parseVersion, isNewerRelease };
