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
// bare file in %TEMP%, no app-update.yml inside it) and an unpackaged run
// keep the notice. The transport table is pure (app/lib/autoUpdate.cjs)
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
const { updateTransport } = require('../app/lib/autoUpdate.cjs');
const root = path.join(path.dirname(new URL(import.meta.url).pathname), '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

test('DA7: the transport table - an installed NSIS or AppImage copy updates in place; macOS, the portable exe and an unpackaged run keep the notice', () => {
  assert.equal(updateTransport({ packaged: true, platform: 'win32', portable: false }), 'updater', 'the NSIS install');
  assert.equal(updateTransport({ packaged: true, platform: 'linux', portable: false }), 'updater', 'the AppImage');
  assert.equal(updateTransport({ packaged: true, platform: 'win32', portable: true }), 'notice', 'the portable exe: a bare file, nothing to replace');
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
  assert.match(main, /updateTransport\(\{ packaged: app\.isPackaged, platform: process\.platform, portable: !!process\.env\.PORTABLE_EXECUTABLE_DIR \}\)/,
    'the live facts: packaged, the platform, the portable launcher\'s mark');
  const cfg = main.slice(main.indexOf('function autoUpdater()'), main.indexOf('async function checkForUpdatesViaUpdater'));
  assert.match(cfg, /require\('electron-updater'\)/, 'loaded lazily - a copy on the notice never loads it');
  assert.match(cfg, /au\.autoDownload = true;/, 'the download starts on its own');
  assert.match(cfg, /au\.autoInstallOnAppQuit = true;/, 'and installs when the app quits - the player does nothing');
  assert.match(cfg, /au\.allowPrerelease = false;/);
  assert.match(cfg, /au\.allowDowngrade = false;/);
  assert.match(cfg, /au\.on\('error', \(\) => \{\}\);/, 'a launch error is silent (the manual check reports its own)');
  // THE LAUNCH: the same gate DA6 had, then the transport fork - the checkbox and the probe env hold BOTH arms
  assert.match(main, /if \(loadConfig\(\)\.updateCheck !== false && !process\.env\.DAGGER_NO_UPDATE_CHECK\) \{[\s\S]{0,400}if \(currentUpdateTransport\(\) === 'updater'\) autoUpdater\(\)\.checkForUpdates\(\)\.catch\(\(\) => \{\}\);\s*\n\s*else checkForUpdates\(\{ silent: true \}\);/,
    'the launch forks on the transport INSIDE the gate');
  // THE MENU: the loud path on either transport
  assert.match(main, /click: \(\) => \(currentUpdateTransport\(\) === 'updater' \? checkForUpdatesViaUpdater\(\) : checkForUpdates\(\{ silent: false \}\)\)/);
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
  assert.match(wf, /run: npx electron-builder --publish never/, 'electron-builder uploads nothing itself; the attach step does');
  const release = wf.slice(wf.indexOf('- name: Attach installers to the release'), wf.indexOf('- name: Keep installers as run artifacts'));
  const artifacts = wf.slice(wf.indexOf('- name: Keep installers as run artifacts'));
  for (const [name, block] of [['the release', release], ['the run artifacts', artifacts]]) {
    assert.match(block, /app\/release\/latest\*\.yml/, `${name}: latest.yml and latest-linux.yml ride with the installers`);
    assert.match(block, /app\/release\/\*\.blockmap/, `${name}: and the blockmaps, or every update is a full download`);
  }
  // the tag shape the updater resolves: releases/latest's tag_name, whatever its prefix - DA6's parser is the same shape
  assert.match(wf, /TAG="app-v\$\{BASE\}\.\$\(git rev-list --count HEAD\)"/, 'REL3\'s tag is what the updater downloads latest.yml under');
});

test('DA7: DA6 stands under it - the notice is the fallback, not a casualty', () => {
  const main = read('app/main.cjs');
  assert.match(main, /checkForUpdates\(\{ silent: true \}\)/, 'the silent notice still runs for the transports that need it');
  assert.match(main, /if \(response === 0\) shell\.openExternal\(latest\.url\);/, 'and its Download button still opens the browser');
  assert.equal((main.match(/net\.fetch\(RELEASES_LATEST_API/g) ?? []).length, 1, 'still one call of its own');
  const probe = read('tools/appShellProbe.mjs');
  assert.match(probe, /DAGGER_NO_UPDATE_CHECK: '1'/, 'the probe opts out of both transports with the one env');
});
