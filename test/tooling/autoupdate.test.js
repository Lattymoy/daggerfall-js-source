// DA7 - THE AUTO-UPDATER (2026-09-21, Mac: "Is there an easy way to make
// it where players dont have to manually install each release?" - "#1 is
// best?" - "Do it").
//
// REL3 made every merge a release and DA6's notice asked the player to
// download and install each one. Where the installer can replace itself
// - NSIS on Windows, AppImage on Linux, the two electron-builder already
// cuts - electron-updater now reads the release's latest.yml, downloads
// the new installer in the background and installs it when the app
// quits. macOS (an unsigned app cannot swap itself), the portable exe (a
// bare file in %TEMP% - it carries an app-update.yml all the same, so its
// launcher's own mark is the test: AUDIT INSTALL R2-C5), a Linux copy not
// running as its AppImage, and an unpackaged run keep the notice. The transport table is pure (app/lib/autoUpdate.cjs)
// and pinned by value; the wiring is pinned by source, because the
// three things that make the updater find anything at all live in three
// files that do not import each other: the shell's settings, the build's
// publish PROVIDER (without it electron-builder writes no latest.yml and
// no app-update.yml), and the workflow attaching that metadata to the
// release beside the installers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { updateTransport } = require('../../app/lib/autoUpdate.cjs');
const root = path.join(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

test('DA7: the transport table - an installed NSIS or AppImage copy updates in place; macOS, the portable exe and an unpackaged run keep the notice', () => {
  assert.equal(updateTransport({ packaged: true, platform: 'win32', portable: false }), 'updater', 'the NSIS install');
  assert.equal(updateTransport({ packaged: true, platform: 'linux', portable: false }), 'updater', 'the AppImage');
  assert.equal(updateTransport({ packaged: true, platform: 'win32', portable: true }), 'notice', 'the portable exe: a bare file, nothing to replace');
  assert.equal(updateTransport({ packaged: true, platform: 'win32', portable: true, configured: true }), 'notice', 'R2-C5: it DOES carry app-update.yml - its mark decides, first');
  assert.equal(updateTransport({ packaged: true, platform: 'linux', portable: false, appImage: false }), 'notice', 'R2-A10: not running as its AppImage - electron-updater declines to check at all');
  assert.equal(updateTransport({ packaged: true, platform: 'win32', portable: false, appImage: false }), 'updater', 'APPIMAGE is Linux\'s alone');
  assert.equal(updateTransport({ packaged: true, platform: 'darwin', portable: false }), 'notice', 'macOS: unsigned, cannot swap itself');
  assert.equal(updateTransport({ packaged: false, platform: 'win32', portable: false }), 'notice', 'electron . - no installed copy');
  assert.equal(updateTransport({ packaged: false, platform: 'linux', portable: false }), 'notice');
  // DERIVED: every packaged, non-portable, non-mac platform is the updater's - not a list of two
  for (const platform of ['win32', 'linux', 'freebsd', 'openbsd']) {
    assert.equal(updateTransport({ packaged: true, platform, portable: false }), 'updater', platform);
  }
});

test('DA7: the shell - the updater downloads on its own, installs on quit, never a prerelease or a downgrade, and both transports sit behind DA6\'s two gates', () => {
  const main = read('app/main.cjs');
  assert.match(main, /const \{ updateTransport \} = require\('\.\/lib\/autoUpdate\.cjs'\);/, 'the table is the leaf\'s');
  assert.match(main, /updateTransport\(\{\s*packaged: app\.isPackaged,\s*platform: process\.platform,\s*portable: !!process\.env\.PORTABLE_EXECUTABLE_DIR,[^}]*configured: !app\.isPackaged \|\| fs\.existsSync\(path\.join\(process\.resourcesPath, 'app-update\.yml'\)\),[^}]*appImage: !!process\.env\.APPIMAGE,\s*\}\)/,
    'the live facts: packaged, the platform, the portable launcher\'s mark, whether the copy carries update metadata at all (AUDIT INSTALL L3-4) - and whether it runs as its AppImage (R2-A10)');
  const cfg = main.slice(main.indexOf('function autoUpdater()'), main.indexOf('async function checkForUpdatesViaUpdater'));
  assert.match(cfg, /require\('electron-updater'\)/, 'loaded lazily - a copy on the notice never loads it');
  assert.match(cfg, /au\.autoDownload = true;/, 'the download starts on its own');
  assert.match(cfg, /au\.autoInstallOnAppQuit = true;/, 'and installs when the app quits - the player does nothing');
  assert.match(cfg, /au\.allowPrerelease = false;/);
  assert.match(cfg, /au\.allowDowngrade = false;/);
  assert.match(cfg, /au\.on\('error', \(\) => onUpdaterEvent\('error'\)\);/, 'a launch error goes to whoever is listening');
  // DA8: and it is SILENCE - the launcher plays on; the manual check reports its own
  const routed = main.slice(main.indexOf('function onUpdaterEvent('), main.indexOf('/** DA10: news.json'));
  // AUDIT INSTALL L2-1: routed by where it lands - "offline" to a check, "failed" under a download (it was "check-failed"
  // whatever happened, which the launcher takes only while checking: a broken download held Play for ever)
  // AUDIT INSTALL R2-A2: the event is heard only for an install that failed - a check's failure and a download's each
  // reject their own promise (askUpdater), since this one event cannot tell them apart
  assert.match(routed, /if \(kind === 'error'\) \{\s*(\/\/[^\n]*\n\s*)*if \(installStarted && !leaveForUpdate\) installFailed\(\);\s*return;\s*\}/,
    'the install\'s own when it came from the installer, and nothing else');
  assert.doesNotMatch(/if \(kind === 'error'\) \{[\s\S]*?\n {2}\}/.exec(routed)?.[0] ?? '', /'check-failed'|'download-failed'/, 'the error branch dispatches neither');
  assert.doesNotMatch(routed, /dialog\./, 'no dialog rides the automatic path');
  // THE LAUNCH (DA8: the launcher's): the same two gates DA6 had, then the transport fork - both arms inside them
  assert.match(main, /const updateChecksEnabled = \(\) => loadConfig\(\)\.updateCheck !== false && !process\.env\.DAGGER_NO_UPDATE_CHECK;/);
  // DA10: the launch check, the news (the check's own request) and the hourly re-check - all inside the gates
  const run = main.slice(main.indexOf('function runLauncher()'), main.indexOf('// The launcher\'s two words.'));
  assert.match(run, /const checkEnabled = updateChecksEnabled\(\);/, 'the launcher checks only inside the gates');
  assert.match(run, /if \(checkEnabled\) \{\s*startLaunchCheck\(\);\s*fetchNews\(\);\s*startRechecks\(\);\s*\}/);
  const launch = main.slice(main.indexOf('function startLaunchCheck()'), main.indexOf('function runLauncher()'));
  assert.match(launch, /if \(currentUpdateTransport\(\) === 'updater'\) \{[\s\S]*?askUpdater\(\)\s*\.then\(\(r\) => \{ if \(!r\) launcherDispatch\(\{ type: 'check-failed' \}\); \}\)\s*\.catch\(\(\) => launcherDispatch\(\{ type: 'check-failed' \}\)\);\s*return;\s*\}\s*noticeCheck\(\)/,
    'the launch forks on the transport - and an updater that declines to check at all (null, no event to come) is said at once, not after the timeout');
  assert.match(main, /if \(recheckTimer \|\| !updateChecksEnabled\(\)\) return;/, 'and the hourly re-check sits inside the same gates');
  // THE MENU: the loud path on either transport
  // PIN MOVED: DA13 - the game's own channel is asked first, and what it cannot carry goes the transport's loud way
  assert.match(main, /click: \(\) => checkForUpdatesLoudly\(\),/);
  const loudly = main.slice(main.indexOf('async function checkForUpdatesLoudly()'), main.indexOf('/** While the app runs, ask again every RECHECK_MS'));
  assert.match(loudly, /const g = await askGame\(\);\s*if \(g === 'installer'\) return currentUpdateTransport\(\) === 'updater' \? checkForUpdatesViaUpdater\(\) : checkForUpdates\(\);/);
  const loud = main.slice(main.indexOf('async function checkForUpdatesViaUpdater'), main.indexOf('// ---- the window'));
  assert.match(loud, /isNewerRelease\(app\.getVersion\(\), `app-v\$\{v\}`\)/, 'the manual check compares by DA6\'s own law - the yml\'s version is the tag less its prefix');
  assert.match(loud, /It installs itself the next time you quit/, 'and says what will happen, because the player has nothing to click');
  assert.match(loud, /Could not check for updates/, 'unreachable is reported out loud, as DA6 does');
});

test('DA7: the build - a publish PROVIDER (so latest.yml and app-update.yml are written), the updater a RUNTIME dependency, and the workflow attaches the metadata beside the installers', () => {
  const pkg = JSON.parse(read('app/package.json'));
  assert.deepEqual(pkg.build.publish, [{ provider: 'github', owner: 'Lattymoy', repo: 'daggerfall-js-source' }],
    'the provider names the repo the notice already reads; without a provider electron-builder writes no update metadata at all');
  assert.ok(pkg.dependencies?.['electron-updater'], 'a runtime dependency - electron-builder packs `dependencies`, never devDependencies');
  assert.ok(!pkg.devDependencies?.['electron-updater']);
  const wf = read('.github/workflows/release-desktop.yml');
  assert.match(wf, /run: npx electron-builder --publish never/, 'electron-builder uploads nothing itself; the publish job does');
  // REL4: a leg hands its files on (the run artifact), and ONE publish job attaches everything handed on
  const handOn = wf.slice(wf.indexOf('- name: Hand the installers on'), wf.indexOf('\n  publish:'));
  assert.match(handOn, /app\/release\/latest\*\.yml/, 'latest.yml and latest-linux.yml ride with the installers');
  assert.match(handOn, /app\/release\/\*\.blockmap/, 'and the blockmaps, or every update is a full download');
  const publish = wf.slice(wf.indexOf('\n  publish:'));
  assert.match(publish, /files: release\/\*/, 'the release carries every file the legs handed on');
  assert.match(publish, /node scripts\/desktopRelease\.mjs check release/, 'and publishes nothing when a manifest or blockmap is missing');
  // the tag shape the updater resolves: releases/latest's tag_name, whatever its prefix - DA6's parser is the same shape
  assert.match(wf, /TAG="app-v\$\{BASE\}\.\$\(git rev-list --count HEAD\)"/, 'REL3\'s tag is what the updater downloads latest.yml under');
});

test('DA7: DA6 stands under it - the notice is the fallback, not a casualty', () => {
  const main = read('app/main.cjs');
  // DA8: the notice's launch check is the LAUNCHER's - shown in its window, silent when GitHub does not answer
  const launch = main.slice(main.indexOf('function startLaunchCheck()'), main.indexOf('function runLauncher()'));
  assert.match(launch, /noticeCheck\(\)\.then\(\(r\) => \{\s*if \(!r\) launcherDispatch\(\{ type: 'check-failed' \}\);/, 'the notice still runs for the transports that need it');
  assert.match(main, /if \(response === 0\) shell\.openExternal\(latest\.download\);/, 'and its Download button still opens the browser - on this copy\'s own file (REL5)');
  assert.equal((main.match(/net\.fetch\(RELEASES_LATEST_API/g) ?? []).length, 1, 'still one call of its own');
  const probe = read('tools/appShellProbe.mjs');
  assert.match(probe, /DAGGER_NO_UPDATE_CHECK: '1'/, 'the probe opts out of both transports with the one env');
});
