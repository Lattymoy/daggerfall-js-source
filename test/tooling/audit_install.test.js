// AUDIT INSTALL (2026-09-29, Mac: "Yes please and audit what we have so
// far"): the install, update and first-run work of PR #429 (REL4, REL5,
// DA8, DA9, DA10), read by five independent lanes - security, the update
// lifecycle, the release pipeline, ARENA2 detection, and the tests, docs
// and the player's eye. Every finding a lane verified is fixed at its root
// and pinned here or beside the slice it belongs to; the record, finding
// by finding, is bible/01-Overview/audits/Audit-Install.md.
//
// Pure halves are driven by execution; the shell's wiring and the release
// workflow are pinned by source (they run in Electron and on GitHub); the
// real windows are driven by tools/appShellProbe.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const L = require('../../app/lib/launcherState.cjs');
const D = require('../../app/lib/shellDialogs.cjs');
const { updateTransport } = require('../../app/lib/autoUpdate.cjs');
const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const run = (state, ...events) => events.reduce(L.reduce, state);
const fresh = (over = {}) => L.initialState({ current: '0.1.4684', transport: 'updater', checkEnabled: true, arena2Dir: '/games/ARENA2', ...over });
/** The source of `fn` in main.cjs: from its declaration to the next top-level one. */
const main = rd('app/main.cjs');
const body = (decl) => {
  const at = main.indexOf(decl);
  assert.ok(at >= 0, `${decl} is in app/main.cjs`);
  const next = main.slice(at + decl.length).search(/\n(?:async )?function |\n\/\*\* |\nconst [A-Z_]+ = |\nlet |\nipcMain\.|\napp\./);
  return next < 0 ? main.slice(at) : main.slice(at, at + decl.length + next);
};

// ---- lane 5 #1: the questions, and which answer does what ------------------

test('L5-1: every question\'s safe answer is its cancel - and on "Leave the game?" its default too; the answer that acts is one predicate', () => {
  const u = D.UNLOAD_ASK;
  assert.deepEqual([u.buttons[u.defaultId], u.buttons[u.cancelId]], ['Stay', 'Stay'], 'Enter and Escape both keep the evening');
  assert.equal(D.leaves(u.buttons.indexOf('Leave')), true);
  assert.equal(D.leaves(u.buttons.indexOf('Stay')), false);
  assert.equal(D.leaves(u.cancelId), false);
  for (const [name, ask, go] of [['restart', D.restartAsk('0.1.4700'), 'Restart'], ['reinstall', D.reinstallAsk(), 'Download'], ['install failed', D.installFailedAsk(), 'Get the installer']]) {
    assert.equal(ask.buttons[ask.defaultId], go, `${name}: the player chose this door - Enter goes ahead`);
    assert.equal(D.goesAhead(ask.buttons.indexOf(go)), true, name);
    assert.equal(D.goesAhead(ask.cancelId), false, `${name}: Escape, or closing the box, never does`);
    assert.notEqual(ask.buttons[ask.cancelId], go);
  }
  assert.match(D.restartAsk('0.1.4700').message, /^Restart to install v0\.1\.4700\?$/);
  assert.match(D.restartAsk('0.1.4700').detail, /Save your game first/);
  // and the shell asks with exactly these, and acts on exactly those answers
  assert.match(main, /const choice = dialog\.showMessageBoxSync\(win, \{ \.\.\.UNLOAD_ASK, buttons: \[\.\.\.UNLOAD_ASK\.buttons\] \}\);\s*if \(leaves\(choice\)\) e\.preventDefault\(\);/);
  assert.match(body('async function restartToUpdate()'), /if \(goesAhead\(response\)\) installNow\(updateReady\?\.version\);/);
  assert.match(body('function installFailed()'), /if \(goesAhead\(response\)\) shell\.openExternal\(ownDownloadUrl\(\)\);/);
  assert.doesNotMatch(main, /buttons: \['Leave', 'Stay'\]|buttons: \['Restart'/, 'no second spelling of a question in the shell');
});

// ---- lane 2: the update lifecycle ------------------------------------------

test('L2-1: a download that breaks off, or stalls, frees Play - it never holds the launcher on "Downloading"', () => {
  const dl = run(fresh(), { type: 'check-available', version: '0.1.4700' }, { type: 'progress', percent: 41, transferred: 1.9e6, total: 4.6e6 });
  const broke = run(dl, { type: 'download-failed' });
  assert.equal(broke.update.status, 'failed');
  const v = L.viewOf(broke);
  assert.equal(v.play.enabled, true);
  assert.equal(v.status, 'Could not download v0.1.4700');
  assert.equal(v.progress, null, 'no frozen bar');
  assert.equal(run(dl, { type: 'check-failed' }).update.status, 'downloading', 'a CHECK\'s failure is not the download\'s - the shell routes it by where it lands');
  assert.equal(run(broke, { type: 'check-available', version: '0.1.4700' }).update.status, 'downloading', 'the hourly re-check tries again');
  assert.equal(run(fresh(), { type: 'download-failed' }).update.status, 'checking', 'nothing downloading, nothing failed');
  assert.ok(L.DOWNLOAD_STALL_MS >= 20000 && L.DOWNLOAD_STALL_MS <= 120000, `a slow link is waited on, a dead one is not (${L.DOWNLOAD_STALL_MS} ms)`);
  // the shell: the watch arms with a download the launcher shows, re-arms at every byte, and cancels on a stall
  const route = body('function onUpdaterEvent(');
  assert.match(route, /if \(kind === 'progress'\) \{\s*if \(stallTimer\) watchDownload\(\);/);
  assert.match(route, /launcherDispatch\(\{ type: 'check-available', version \}\);\s*if \(launcher\?\.state\.update\.status === 'downloading'\) watchDownload\(\);/);
  assert.match(route, /if \(kind === 'downloaded'\) \{\s*stopStallWatch\(\);/);
  assert.match(body('function watchDownload()'), /stallTimer = setTimeout\(\(\) => \{\s*stallTimer = null;\s*downloading\?\.token\?\.cancel\(\);\s*launcherDispatch\(\{ type: 'download-failed' \}\);\s*\}, DOWNLOAD_STALL_MS\);/);
  // AUDIT INSTALL R2-A2: the token and the end are the DOWNLOAD's own - kept by the check that started it, never
  // replaced by a later check's (whose token stops nothing), and a failed download is its own promise's to say
  const ask = body('function askUpdater()');
  assert.match(ask, /if \(r\?\.downloadPromise && !downloading\) \{\s*const d = \{ token: r\.cancellationToken \};\s*downloading = d;\s*r\.downloadPromise\s*\.then\(\(\) => \{\}, \(\) => \{ if \(downloading === d\) \{ stopStallWatch\(\); launcherDispatch\(\{ type: 'download-failed' \}\); \} \}\)\s*\.finally\(\(\) => \{ if \(downloading === d\) downloading = null; \}\);\s*\} else r\?\.downloadPromise\?\.catch\(\(\) => \{\}\);/,
    'never an unhandled rejection either');
  assert.match(main, /case 'play-now': stopStallWatch\(\); launcherDispatch\(\{ type: 'play-now' \}\); break;/, 'a download the player left to run in the background is not watched');
});

test('L2-2: the installer has ONE door - a second Restart never runs it twice (on Linux, over the AppImage the first had just put in place)', () => {
  const door = body('function installNow(');
  assert.match(door, /if \(installStarted\) return;\s*installStarted = true;/, 'once');
  assert.equal((main.match(/\.quitAndInstall\(/g) ?? []).length, 1, 'and nothing else calls the installer');
  const restart = body('async function restartToUpdate()');
  assert.match(restart, /if \(restartAsking \|\| installStarted\) return;\s*restartAsking = true;/, 'one question at a time');
  assert.match(restart, /\} finally \{ restartAsking = false; \}/);
  assert.match(restart, /const parent = gameWindow && !gameWindow\.isDestroyed\(\) \? gameWindow : null;/, 'over the game - a parentless box could open twice, behind a fullscreen window');
  assert.match(main, /if \(!updateReady && !installStarted && !downloading\) askUpdater\(\)\.catch\(\(\) => \{\}\);/, 'the hourly re-check does not ask while the installer is running - nor over a download (R2-A2)');
});

test('L2-3: a failing installer cannot close the app on every launch - the version tried is written down, and not tried before play again', () => {
  assert.deepEqual(L.installAttemptFor({ version: '0.1.4700' }, '0.1.4684'), { failed: '0.1.4700', keep: true }, 'still older: it did not take');
  assert.deepEqual(L.installAttemptFor({ version: '0.1.4700' }, '0.1.4700'), { failed: null, keep: false }, 'it took');
  assert.deepEqual(L.installAttemptFor({ version: '0.1.4700' }, '0.1.4710'), { failed: null, keep: false }, 'long past');
  assert.deepEqual(L.installAttemptFor(undefined, '0.1.4684'), { failed: null, keep: false });
  assert.deepEqual(L.installAttemptFor({ version: 'junk' }, '0.1.4684'), { failed: null, keep: false });
  const stuck = run(fresh({ installFailedFor: '0.1.4700' }), { type: 'check-available', version: '0.1.4700' }, { type: 'downloaded', version: '0.1.4700' });
  assert.equal(stuck.update.status, 'stuck');
  assert.equal(L.nextStep(stuck), 'wait', 'NOT install - the loop is broken here');
  const v = L.viewOf(stuck);
  assert.equal(v.play.enabled, true);
  assert.equal(v.status, 'v0.1.4700 did not install');
  assert.deepEqual(v.statusActions.map((a) => a.id), ['reinstall'], 'the installer to run by hand');
  const newer = run(fresh({ installFailedFor: '0.1.4700' }), { type: 'check-available', version: '0.1.4710' }, { type: 'downloaded', version: '0.1.4710' });
  assert.equal(newer.update.status, 'installing', 'a NEWER version gets its own try');
  // the shell writes it before the installer is handed the app, and reads it at launch
  assert.match(body('function installNow('), /if \(version\) saveConfig\(\{ \.\.\.loadConfig\(\), installAttempt: \{ version \} \}\);\s*autoUpdater\(\)\.quitAndInstall\(true, true\);/);
  const launch = body('function runLauncher()');
  assert.match(launch, /const attempt = installAttemptFor\(cfg\.installAttempt, app\.getVersion\(\)\);/);
  assert.match(launch, /installFailedFor: attempt\.failed,/);
  assert.match(launch, /if \(cfg\.installAttempt && !attempt\.keep\) \{/, 'and let go once it is done with');
});

test('L2-4: the unload guard is waived only once the installer has REALLY taken over - a failed Restart leaves it standing, and is said', () => {
  assert.match(main, /require\('electron'\)\.autoUpdater\.on\('before-quit-for-update', \(\) => \{\s*if \(installFault\) \{ holdQuit = true; return; \}\s*leaveForUpdate = true;/,
    'electron-updater says so on Electron\'s autoUpdater just before it quits, and only after install() succeeded - unless the install already failed (R2-A5)');
  assert.equal((main.match(/leaveForUpdate = true/g) ?? []).length, 1, 'and nothing else waives it');
  assert.match(body('function onUpdaterEvent('), /if \(installStarted && !leaveForUpdate\) installFailed\(\);\s*return;/);
  const failed = body('function installFailed()');
  assert.match(failed, /installStarted = false;/, 'another try is allowed - the library cleared its own flag');
  assert.match(failed, /if \(launcher\) \{ launcherDispatch\(\{ type: 'install-failed' \}\); return; \}/);
  assert.match(failed, /const opts = installFailedAsk\(\);/, 'in the game: told, with the installer to run by hand');
});

test('L2-6/L2-8: a notice is told once, by whoever can - and a download reported twice is not news twice', () => {
  const tell = body('function tellNotice(');
  assert.match(tell, /if \(!r\?\.newer \|\| !manualUpdate \|\| manualUpdate\.version !== r\.version \|\| manualUpdate\.told\) return;/);
  assert.match(tell, /if \(launcher && !launcher\.state\.launch && u\?\.status === 'notice' && u\.version === r\.version\) \{ manualUpdate\.told = 'launcher'; return; \}/, 'the launcher took it');
  assert.match(tell, /manualUpdate\.told = tellGame\(\{ version: r\.version, manual: true \}\) \? 'game' : false;/, 'else the game - as a notice (manual: true), which says Download, never Restart');
  assert.match(body('async function noticeCheck()'), /if \(fresh\) manualUpdate = \{ version, download: latest\.download, told: false \};\s*else manualUpdate\.download = latest\.download;/, 'a version once told stays told');
  assert.match(body('function startLaunchCheck()'), /launcherDispatch\(\{ type: 'check-available', version: r\.version, download: r\.download \}\);\s*tellNotice\(r\);/);
  // a game window that was not there yet is told at its load - AUDIT INSTALL R2-A4: at EVERY load (a replaced page forgets),
  // but never a notice the launcher already put in front of the player
  assert.match(main, /win\.webContents\.on\('did-finish-load', \(\) => \{\s*if \(updateReady\) updateReady\.told = tellGame\(\{ version: updateReady\.version, manual: false \}\);\s*else if \(manualUpdate && manualUpdate\.told !== 'launcher'\) manualUpdate\.told = tellGame\(\{ version: manualUpdate\.version, manual: true \}\) \? 'game' : false;\s*\}\);/);
  assert.doesNotMatch(main, /webContents\.once\('did-finish-load'/, 'not at the first load only');
  assert.match(body('function startLaunchCheck()'), /setTimeout\(\(\) => launcherDispatch\(\{ type: 'check-timeout' \}\), CHECK_TIMEOUT_MS\)\.unref\?\.\(\);/, 'the 8-second law is the shell\'s too, not only the reducer\'s');
  assert.match(body('function startRechecks()'), /recheckTimer = setInterval\(async \(\) => \{\s*if \(!updateChecksEnabled\(\)\) return;/, 'a switch turned off mid-session stops the next ask');
  const manual = body('async function checkForUpdatesViaUpdater()');
  assert.match(manual, /if \(v && updateReady\?\.version === v\) \{[\s\S]*?message: `Version \$\{v\} is ready`/, 'a download already done is "ready", not "downloading"');
});

test('L2-10: the launcher closed by the player while the game was still coming up is a leave - the hidden game does not appear after it', () => {
  const win = body('function openLauncherWindow()');
  assert.match(win, /const handingOver = launcher\.state\.launch === 'started';\s*launcher\.stop\.abort\(\);[^\n]*\n\s*launcher = null;/, 'and its probes go with it (R2-D1)');
  assert.match(win, /if \(handingOver && gameWindow && !gameWindow\.isDestroyed\(\) && !gameWindow\.isVisible\(\)\) gameWindow\.destroy\(\);/,
    'only a HIDDEN game - the handover\'s own close comes after the game shows');
});

// ---- lane 1: the launcher's fences, the unload guard ------------------------

test('L1-2: the launcher navigates nowhere, opens nothing and is granted nothing - its only doors are the actions the shell names', () => {
  assert.match(body('function openLauncherWindow()'), /launcherContents\.add\(win\.webContents\);/);
  const fences = main.slice(main.indexOf("app.on('web-contents-created'"), main.indexOf('// The preload asks for its storage root'));
  assert.match(fences, /contents\.setWindowOpenHandler\(\(\{ url \}\) => \{\s*if \(launcherContents\.has\(contents\)\) return \{ action: 'deny' \};/, 'no window, and no browser either');
  assert.match(fences, /contents\.on\('will-navigate', \(e, url\) => \{\s*if \(launcherContents\.has\(contents\)\) \{ e\.preventDefault\(\); return; \}/,
    'not an https page (the app-wide fence hands those to the browser), not a dagger://game page with the launcher\'s bridge on it');
  assert.match(main, /session\.defaultSession\.setPermissionRequestHandler\(\(wc, _permission, callback, details\) => callback\(!isLauncherPage\(wc, details\?\.requestingUrl\)\)\);/,
    'the clipboard, notifications, the camera: denied to the launcher; every other page keeps Electron\'s default');
  assert.match(main, /const LAUNCHER_ORIGIN = 'dagger:\/\/launcher\/';/);
  assert.match(main, /ipcMain\.on\('launcher:ready', \(e\) => \{ if \(fromLauncher\(e\)\) renderLauncher\(\); \}\);/);
});

test('L1-3: "Leave the game?" is asked when the PLAYER leaves - a close, a quit, View > Reload - never for a navigation the page starts itself', () => {
  assert.match(main, /win\.on\('close', \(\) => markLeaving\(win\.webContents\)\);/, 'Electron\'s close comes before the page\'s beforeunload (measured, Electron 42)');
  assert.match(main, /if \(leaveForUpdate\) \{ e\.preventDefault\(\); return; \}\s*if \(!isLeaving\(win\.webContents\)\) return;/, 'a page-started navigation is kept, as Electron always kept it - no box');
  const reload = main.slice(main.indexOf("label: 'Reload',"), main.indexOf("label: 'Reload',") + 400);
  assert.match(reload, /accelerator: 'CmdOrCtrl\+R',[\s\S]*markLeaving\(target\.webContents\);\s*target\.webContents\.reload\(\);/, 'the reload the player asks for is a leave, and is asked about');
  assert.doesNotMatch(main, /\{ role: 'reload' \}/, 'the role\'s reload could not say so');
  assert.match(body('function isLeaving('), /leavingAt\.delete\(wc\);\s*return at !== undefined && Date\.now\(\) - at <= LEAVE_ASK_MS;/, 'once per leave, and only just after it');
});

// ---- lane 3 and lane 1: the release pipeline -------------------------------

test('L1-1/L1-5/L3-2/L3-5/L3-6: the release workflow - no token left behind, a tag of digits, nothing re-cut in place, "latest" never by default', () => {
  const wf = rd('.github/workflows/release-desktop.yml');
  const checkouts = wf.match(/- uses: actions\/checkout@v4/g) ?? [];
  // PIN MOVED (REL-FAST): the gate's checkout is verify.yml's now - its three checkouts held to the same law
  assert.equal(checkouts.length, 3);
  assert.equal((wf.match(/persist-credentials: false/g) ?? []).length, checkouts.length, 'EVERY checkout - nothing here pushes, and the publish job holds contents: write');
  const v = rd('.github/workflows/verify.yml');
  assert.equal((v.match(/- uses: actions\/checkout@v4/g) ?? []).length, 3);
  assert.equal((v.match(/persist-credentials: false/g) ?? []).length, 3, 'and the gate\'s - verify.yml - leaves no token behind either');
  assert.doesNotMatch(wf, /\$\{\{ needs\.version\.outputs\.version \}\}"? --no-git-tag-version|run: .*\$\{\{ (inputs|github\.ref_name|needs\.version)/, 'no tag or input text is pasted into a script');
  const publish = wf.slice(wf.indexOf('\n  publish:'));
  const guard = publish.indexOf('- name: The tag has no published release'), stage = publish.indexOf('uses: softprops/action-gh-release@');
  assert.ok(guard > 0 && stage > guard, 'the guard stands before anything is staged');
  assert.match(publish, /if gh api "repos\/\$GITHUB_REPOSITORY\/releases\/tags\/\$TAG" --silent 2>lookup-error\.txt; then\s*echo "::error::\$TAG is already published[^"]*"\s*exit 1\s*fi\s*grep -q 'HTTP 404' lookup-error\.txt \|\| \{ cat lookup-error\.txt >&2; exit 1; \}/);
  assert.match(publish, /if CURRENT=\$\(gh api "repos\/\$GITHUB_REPOSITORY\/releases\/latest" --jq \.tag_name 2>latest-error\.txt\); then :\s*elif grep -q 'HTTP 404' latest-error\.txt; then CURRENT=''\s*else cat latest-error\.txt >&2; exit 1\s*fi/,
    'only a 404 is "nothing is latest yet" - a 5xx fails the step rather than handing an old re-cut `latest`');
  assert.doesNotMatch(publish, /2>\/dev\/null \|\| true/);
});

test('L3-4: a build that is not a release carries no update metadata, and a copy without it never replaces itself', () => {
  const wf = rd('.github/workflows/release-desktop.yml');
  const build = wf.slice(wf.indexOf('\n  build:'), wf.indexOf('\n  publish:'));
  const step = build.slice(build.indexOf('- name: No updater in a build that is not a release'), build.indexOf('- name: Build installers'));
  assert.match(step, /if: needs\.version\.outputs\.tag == ''/, 'artifacts-only runs');
  assert.match(step, /p\.build\.publish=null;/, 'null EXPLICITLY - absent, electron-builder derives GitHub from `repository` and writes app-update.yml anyway');
  assert.ok(build.indexOf('- name: No updater in a build that is not a release') < build.indexOf('- name: Build installers'));
  assert.equal(updateTransport({ packaged: true, platform: 'win32', portable: false, configured: false }), 'notice');
  assert.equal(updateTransport({ packaged: true, platform: 'linux', portable: false, configured: false }), 'notice');
  assert.equal(updateTransport({ packaged: true, platform: 'win32', portable: false }), 'updater', 'a release build is configured by default');
});

test('L5-15: the Mac build is signed ad hoc after packing, and says why it reads the privacy-guarded folders', () => {
  const build = JSON.parse(rd('app/package.json')).build;
  assert.equal(build.afterPack, './afterPack.cjs');
  assert.ok(!build.files.includes('afterPack.cjs'), 'a build hook, never shipped inside the app');
  const hook = rd('app/afterPack.cjs');
  assert.match(hook, /if \(context\.electronPlatformName !== 'darwin'\) return;/);
  assert.match(hook, /execFileSync\('codesign', \['--force', '--deep', '--sign', '-', app\]/, 'ad hoc: a whole signature, if nobody\'s - a BROKEN one is "damaged", with no Open Anyway');
  assert.match(hook, /execFileSync\('codesign', \['--verify', '--deep', '--strict', app\]/, 'and a signature that does not verify fails the build, not the player');
  for (const k of ['NSDownloadsFolderUsageDescription', 'NSDesktopFolderUsageDescription', 'NSDocumentsFolderUsageDescription']) {
    assert.match(build.mac.extendInfo?.[k] ?? '', /Daggerfall game files/, `${k}: the system prompt says why`);
  }
});

// ---- lane 5: what the player reads -----------------------------------------

test('L5-2/L5-3: the landing page promises what each download does, and a Mac player is sent where the files are', () => {
  const landing = rd('index.html');
  const entry = landing.slice(landing.indexOf('<dt id="desktop">'), landing.indexOf('</dd>', landing.indexOf('<dt id="desktop">')));
  // PIN MOVED: DA13 - the GAME updates itself on every copy (the files that changed); the app itself as before
  assert.match(entry, /The game updates itself before you play on every one, downloading only the files that changed; when the app itself changes, the Windows installer and the Linux AppImage update themselves, and the portable exe and the Mac tell you a new version is out\./,
    'the portable exe\'s and the Mac\'s SHELL never updates itself (lib/autoUpdate.cjs: notice) - their game does (DA13)');
  assert.doesNotMatch(entry, /Steam or GOG/, 'both sell Daggerfall for Windows only');
  assert.match(entry, /on a Mac open it once, then choose Open Anyway under System Settings, Privacy &amp; Security/);
  const mac = L.viewOf(run(fresh({ platform: 'darwin', arena2Dir: null }), { type: 'found', found: [] }));
  assert.match(mac.setup.detail, /on a Mac, get DaggerfallGameFiles\.zip/);
  assert.deepEqual(mac.setup.actions.map((a) => [a.id, a.arg ?? null]), [['choose-folder', null], ['open', 'zip'], ['skip-setup', null]], 'no Steam or GOG button that leads nowhere');
  assert.match(main, /zip: 'https:\/\/forums\.dfworkshop\.net\/viewtopic\.php\?t=2360',/, 'the landing page\'s own link for the files');
  assert.ok(landing.includes('href="https://forums.dfworkshop.net/viewtopic.php?t=2360"'));
  const win = L.viewOf(run(fresh({ platform: 'win32', arena2Dir: null }), { type: 'found', found: [] }));
  assert.deepEqual(win.setup.actions.map((a) => a.arg).filter(Boolean), ['steam', 'gog']);
  assert.match(L.viewOf(run(fresh({ transport: 'notice' }), { type: 'check-available', version: '0.1.4700', download: 'd' })).detail,
    /Download it, quit, and put it in place of this copy/, 'a portable exe is not "installed over" - and a Mac app is replaced once it has quit');
});

test('L5-14/L5-24: the first run\'s card scrolls from its top, and Enter never presses a folder just refused', () => {
  assert.match(rd('app/launcher/launcher.css'), /\.setup \{[^}]*overflow-y: auto;[^}]*justify-content: safe center;/, 'plain `center` overflowed both ways - six folders found hid the title where no scroll reaches');
  const one = [{ dir: '/a/ARENA2', source: 'steam' }];
  assert.equal(L.viewOf(run(fresh({ arena2Dir: null }), { type: 'found', found: one })).setup.found[0].primary, true, 'the one thing found is the card\'s answer');
  const refused = run(fresh({ arena2Dir: null }), { type: 'found', found: one }, { type: 'picked-bad', missing: ['MAPS.BSA'] });
  const rv = L.viewOf(refused);
  assert.equal(rv.setup.found[0].primary, false, 'after "Use these files" was refused, Enter must not press it again');
  assert.deepEqual(rv.setup.actions.filter((a) => a.primary).map((a) => a.id), ['choose-folder']);
  assert.match(rd('app/launcher/launcher.js'), /name: `Use these files - \$\{f\.from\}: \$\{f\.dir\}`, primary: f\.primary/, 'each "Use these files" is named for its folder');
});

test('L5-17/L5-23: the page speaks once per change, names its progress, and its small words are readable', () => {
  const html = rd('app/launcher/index.html');
  assert.match(html, /<p id="status" aria-live="polite"><\/p>/, 'ONE small live region - the stage line');
  assert.doesNotMatch(html, /<div class="state" aria-live/, 'not the whole bar, re-read on every tick of a download');
  assert.match(html, /role="progressbar" aria-labelledby="status"/);
  assert.match(html, /<span class="label" aria-hidden="true"><\/span>/, 'the MB label is the bar\'s aria-valuetext, not a second announcement');
  const js = rd('app/launcher/launcher.js');
  assert.match(js, /track\.setAttribute\('aria-valuetext', v\.progress\.label\);/);
  assert.match(js, /const setText = \(node, text\) => \{ if \(node\.textContent !== text\) node\.textContent = text; \};/);
  assert.match(js, /setText\(\$\('status'\), v\.status\);/, 'text is written only when it changed');
  // contrast: #7d7460 is 4.1-4.4:1 on the night at 12-14px (under WCAG AA's 4.5) - rules, borders and a held Play only
  const css = rd('app/launcher/launcher.css');
  for (const sel of ['.caps', '.link', '.release .date', '.news .note', '.release h5', '.found .from', '.progress .label']) {
    const rule = css.match(new RegExp(`(?:^|\\n)${sel.replace(/\./g, '\\.').replace(/ /g, '\\s+')} \\{([^}]*)\\}`))?.[1];
    assert.ok(rule, `${sel} is styled`);
    assert.doesNotMatch(rule, /(?:^|[;\s])color: #7d7460/, `${sel}: small text at AA contrast`);
  }
});
