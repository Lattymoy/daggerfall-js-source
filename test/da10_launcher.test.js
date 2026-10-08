// DA10 (2026-09-29, Mac: "So this is an actual launcher now? Like
// warframe?" - and to the offer of one that stays open with a Play button,
// the latest patch notes and the player's options: "Yes please").
//
// THE LAUNCHER STAYS. DA8's window was a splash that went away by itself
// whenever it had nothing to ask; now it is the game's front door. It opens
// on every launch and waits for PLAY - held only while an update is being
// checked for, fetched or installed, or while the game has no files - with
// the patch notes as its news (NEW since the player last played, UPDATE on
// its way), the update in its status bar, and the player's own doors beside
// them: the game files, the saves folder, the update check, a reinstall.
//
// The state is pure (app/lib/launcherState.cjs) and driven here; the page
// and the shell's wiring are pinned by source; the real window is driven by
// tools/appShellProbe.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const L = require('../app/lib/launcherState.cjs');
const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const run = (state, ...events) => events.reduce(L.reduce, state);
const fresh = (over = {}) => L.initialState({ current: '0.1.4684', transport: 'updater', checkEnabled: true, arena2Dir: '/games/DF/DAGGER/ARENA2', ...over });

test('DA10: the launcher waits for Play on every launch - held only while an update is decided or the game has no files', () => {
  const current = run(fresh(), { type: 'check-none' });
  assert.equal(L.nextStep(current), 'wait', 'nothing to decide is no longer a reason to leave: the player presses Play');
  assert.equal(L.viewOf(current).play.enabled, true);
  // Play is held while an update is being decided...
  assert.equal(L.viewOf(fresh()).play.enabled, false, 'checking');
  const downloading = run(fresh(), { type: 'check-available', version: '0.1.4700' });
  assert.equal(L.viewOf(downloading).play.enabled, false, 'downloading');
  assert.equal(L.viewOf(run(downloading, { type: 'downloaded', version: '0.1.4700' })).play.enabled, false, 'installing');
  // ...or the game has no files
  const noFiles = run(fresh({ arena2Dir: null }), { type: 'found', found: [] }, { type: 'check-none' });
  assert.equal(L.viewOf(noFiles).play.enabled, false, 'no files, no Play - the card asks for them');
  // a press that is not allowed does nothing
  assert.equal(run(fresh(), { type: 'play' }).launch, null, 'Play pressed during the check is not a launch');
  assert.equal(run(noFiles, { type: 'play' }).launch, null);
  // Play: requested, then launched, then nothing more
  const played = run(current, { type: 'play' });
  assert.equal(played.launch, 'requested');
  assert.equal(L.nextStep(played), 'launch');
  const started = run(played, { type: 'launching' });
  assert.equal(L.nextStep(started), 'wait');
  const sv = L.viewOf(started);
  assert.equal(sv.status, 'Starting Daggerfall Online');
  assert.equal(sv.play.enabled, false, 'one press, one game');
  // "Play without updating" is Play past a download - when the game has files; otherwise it only lets the download run on
  const past = run(downloading, { type: 'play-now' });
  assert.deepEqual([past.update.status, past.launch], ['background', 'requested']);
  const pastNoFiles = run(fresh({ arena2Dir: null }), { type: 'found', found: [] }, { type: 'check-available', version: '0.1.4700' });
  assert.deepEqual(L.viewOf(pastNoFiles).statusActions, [], 'no "Play without updating" while there is nothing to play');
  assert.equal(run(pastNoFiles, { type: 'play-now' }).launch, null);
});

test('DA10: an install never cuts off the player\'s own screen - it waits for the game files, then the app reopens on it', () => {
  const choosing = run(fresh({ arena2Dir: null }), { type: 'found', found: [{ dir: '/steam/ARENA2', source: 'steam' }] },
    { type: 'check-available', version: '0.1.4700' }, { type: 'downloaded', version: '0.1.4700' });
  assert.equal(choosing.update.status, 'installing');
  assert.equal(L.nextStep(choosing), 'wait', 'the player is choosing their files - the restart waits');
  const v = L.viewOf(choosing);
  assert.equal(v.status, 'v0.1.4700 is ready to install');
  assert.match(v.detail, /once your game files are set/);
  assert.equal(v.busy, false, 'the gem holds still: it is waiting on the player');
  assert.equal(L.nextStep(run(choosing, { type: 'picked', dir: '/steam/ARENA2' })), 'install', 'the folder survives the restart');
  assert.equal(L.nextStep(run(choosing, { type: 'skip-setup' })), 'install');
  // the shell holds it while one of the launcher's own dialogs is up (a folder being chosen)
  const main = rd('app/main.cjs');
  assert.match(main, /else if \(step === 'install'\) \{ if \(!launcher\.dialogs\) installFromLauncher\(\); \}/);
  const dlg = main.slice(main.indexOf('async function launcherDialog('), main.indexOf('/** The update is down'));
  assert.match(dlg, /if \(l\) l\.dialogs\+\+;\s*try \{ return await show\(\); \} finally \{\s*if \(l\) l\.dialogs--;\s*advanceLauncher\(\);/, 'counted while up, and what waited goes on when it closes');
  for (const fn of ['async function launcherChooseFolder()', 'async function reinstallFromLauncher()']) {
    const body = main.slice(main.indexOf(fn), main.indexOf('\n}\n', main.indexOf(fn)));
    assert.doesNotMatch(body.replace(/launcherDialog\(\(\) => (chooseArena2Folder|dialog\.showMessageBox)\(/g, ''), /chooseArena2Folder\(|dialog\.showMessageBox\(/, `${fn}: every dialog is counted`);
  }
});

test('DA10: a launcher left open still hears - a late answer, the hourly re-check - but never once Play is pressed', () => {
  const late = run(fresh(), { type: 'check-timeout' }, { type: 'check-available', version: '0.1.4700' });
  assert.equal(late.update.status, 'downloading', 'an answer after the timeout lands: the launcher is still open, and the player still before Play');
  const hourly = run(fresh(), { type: 'check-none' }, { type: 'check-available', version: '0.1.4700' });
  assert.equal(hourly.update.status, 'downloading', 'the re-check runs from the launcher\'s first moment');
  const lateNone = run(fresh(), { type: 'check-timeout' }, { type: 'check-none' });
  assert.equal(lateNone.update.status, 'current');
  const newer = run(fresh({ transport: 'notice' }), { type: 'check-available', version: '0.1.4700', download: 'a' }, { type: 'check-available', version: '0.1.4710', download: 'b' });
  assert.deepEqual([newer.update.version, newer.update.download], ['0.1.4710', 'b'], 'a newer notice replaces an older one');
  const pressed = run(fresh(), { type: 'check-none' }, { type: 'play' }, { type: 'check-available', version: '0.1.4700' });
  assert.equal(pressed.update.status, 'current', 'after Play it is the game\'s to hear (File > Restart to Update)');
  assert.equal(run(fresh({ checkEnabled: false }), { type: 'check-available', version: '0.1.4700' }).update.status, 'skipped', 'checks off: nothing asked, nothing heard');
  // the shell: the re-check starts with the launcher, inside the gates, and tells whoever is open
  const main = rd('app/main.cjs');
  const re = main.slice(main.indexOf('function startRechecks()'), main.indexOf('// ---- the window'));
  assert.match(re, /if \(launcher\) launcherDispatch\(\{ type: 'check-available', version: r\.version, download: r\.download \}\);\s*tellNotice\(r\);/,
    'the launcher hears it; and it is told once, by whoever took it (tellNotice)');
});

test('DA10: the news - the latest releases\' patch notes, NEW since the player last played, UPDATE for one on its way', () => {
  const releases = [
    { tag_name: 'app-v0.1.4700', body: '# Patch Notes: The Launcher\n- Play.\n\n## What\'s Changed\n* a PR', published_at: '2026-09-29T18:02:00Z' },
    { tag_name: 'app-v0.1.4684', body: 'Fixes and improvements.', published_at: '2026-09-28T21:40:00Z' },
    { tag_name: 'app-v0.1.4670', body: 'Fixes and improvements.', published_at: '2026-09-28T19:00:00Z' },
    { tag_name: 'app-v0.1.4660', body: '# Patch Notes: Overworld\n- Walk.', published_at: '2026-09-28T12:10:00Z' },
    { tag_name: 'app-v0.1.4650', body: '# Patch Notes: Draft', draft: true },
    { tag_name: 'app-v0.1.4640', body: '# Patch Notes: Pre', prerelease: true },
    { tag_name: 'site-v9', body: '# not a release of the app' },
    { tag_name: 'app-v0.1.4613', body: '# Patch Notes: The Sea\n- Boats.', published_at: '2026-09-27T09:00:00Z' },
    null,
  ];
  const items = L.newsFrom(releases);
  assert.deepEqual(items.map((n) => n.version), ['0.1.4700', '0.1.4684', '0.1.4670', '0.1.4660', '0.1.4613'], 'published app releases, newest first');
  assert.equal(items[0].text, '# Patch Notes: The Launcher\n- Play.', 'as their patch notes - never the list of pull requests');
  assert.equal(items[0].date, '2026-09-29T18:02:00Z');
  assert.deepEqual(L.newsFrom({ message: 'API rate limit exceeded' }), [], 'an error body is no news');
  // the panel: marked, dated, and the bare placeholder listed only when it is the player's own version
  const s = fresh({ news: items, lastPlayed: '0.1.4613' });
  const v = L.viewOf(s).news;
  assert.deepEqual(v.items.map((n) => [n.version, n.badge]),
    [['0.1.4700', 'update'], ['0.1.4684', 'new'], ['0.1.4670', 'new'], ['0.1.4660', 'new'], ['0.1.4613', null]],
    'UPDATE past this copy; NEW for (last played, this copy]; the one played before, unmarked');
  assert.equal(v.items[0].date, '29 Sep 2026');
  const v2 = L.viewOf(fresh({ news: items, lastPlayed: '0.1.4684' })).news;
  assert.deepEqual(v2.items.map((n) => [n.version, n.badge]), [['0.1.4700', 'update'], ['0.1.4660', null], ['0.1.4613', null]],
    'a placeholder release that is neither new nor coming says nothing - it is not listed');
  // a copy with a config.json from before DA10 has no lastPlayed: the build it runs is new to that player
  assert.deepEqual(L.viewOf(fresh({ news: items, returning: true })).news.items.filter((n) => n.badge === 'new').map((n) => n.version), ['0.1.4684']);
  assert.deepEqual(L.viewOf(fresh({ news: items })).news.items.filter((n) => n.badge === 'new'), [], 'a first run has nothing new - everything is');
  // when no release says anything, one line stands for them all
  const bare = L.newsFrom(releases.slice(1, 3));
  assert.deepEqual(L.viewOf(fresh({ current: '0.1.4700', news: bare, lastPlayed: '0.1.4700' })).news.items.map((n) => n.version), ['0.1.4684']);
  const many = Array.from({ length: 12 }, (_, i) => ({ version: `0.1.${5000 + i}`, date: '', text: `# Patch Notes: ${i}` })).reverse();
  assert.equal(L.viewOf(fresh({ current: '0.1.5011', news: many })).news.items.length, L.NEWS_MAX);
  // the panel is never blank: it says why
  assert.equal(L.viewOf(fresh()).news.note, 'Loading the patch notes');
  assert.match(L.viewOf(run(fresh(), { type: 'news-failed' })).news.note, /could not be loaded/);
  assert.match(L.viewOf(fresh({ checkEnabled: false })).news.note, /update check, which is off/);
  assert.equal(L.viewOf(run(fresh(), { type: 'news', items: [] })).news.note, 'No patch notes yet.');
  assert.equal(L.viewOf(run(fresh({ news: items }), { type: 'news-failed' })).news.note, '', 'the kept list stays up when GitHub does not answer');
  assert.equal(L.viewOf(fresh({ news: items })).news.note, '', 'and shows while the next one is asked for');
});

test('DA10: news.json is read as it was written - or as a hand, a crash or an older build left it', () => {
  const good = { version: '0.1.4700', date: '2026-09-29T18:02:00Z', text: '# Patch Notes: X' };
  assert.deepEqual(L.cachedNews({ items: [{ version: '0.1.4613', date: '', text: 'a' }, good] }).map((n) => n.version), ['0.1.4700', '0.1.4613'], 'newest first');
  assert.deepEqual(L.cachedNews({ items: [good, { version: 'garbage', text: 'x' }, { version: '0.1.1' }, null, 7] }), [good], 'only well-formed items');
  assert.deepEqual(L.cachedNews({ items: [{ ...good, date: 5 }] })[0].date, '', 'a date that is not a string is none');
  assert.deepEqual(L.cachedNews(null), []);
  assert.deepEqual(L.cachedNews({ items: 'nope' }), []);
  assert.equal(L.dateLabel('2026-01-02T23:59:59Z'), '2 Jan 2026');
  assert.equal(L.dateLabel('not a date'), '');
  assert.equal(L.dateLabel(undefined), '');
});

test('DA10: the status bar says where the launcher stands - updated, up to date, offline, off', () => {
  const v = (s) => [L.viewOf(s).status, L.viewOf(s).detail];
  assert.deepEqual(v(run(fresh({ lastPlayed: '0.1.4613' }), { type: 'check-none' })), ['Updated to v0.1.4684', 'What changed is in the patch notes.']);
  assert.deepEqual(v(run(fresh({ lastPlayed: '0.1.4684' }), { type: 'check-none' })), ['Up to date', '']);
  assert.deepEqual(v(run(fresh(), { type: 'check-none' })), ['Up to date', ''], 'a first run was not updated');
  assert.equal(v(run(fresh({ returning: true }), { type: 'check-none' }))[0], 'Updated to v0.1.4684');
  assert.equal(v(run(fresh(), { type: 'check-failed' }))[0], 'Could not check for updates');
  assert.equal(v(fresh({ checkEnabled: false }))[0], 'Update checks are off');
  assert.equal(v(run(fresh(), { type: 'check-available', version: '0.1.4700' }, { type: 'play-now' }))[0], 'Starting Daggerfall Online');
  assert.equal(L.justUpdated(fresh({ lastPlayed: '0.1.4700' })), false, 'a copy older than the one last played (a reinstall) was not "updated"');
  assert.equal(L.viewOf(fresh()).busy, true, 'the gem breathes while it works');
  assert.equal(L.viewOf(run(fresh(), { type: 'check-none' })).busy, false, 'and holds still when it waits on the player');
});

test('DA10: the options - the game files and their door, the update check\'s switch', () => {
  assert.deepEqual(L.viewOf(fresh()).options.files, { path: '/games/DF/DAGGER/ARENA2', note: '', label: 'Change folder' });
  assert.deepEqual(L.viewOf(fresh({ arena2Dir: null, inGamePicker: true })).options.files, { path: '', note: 'Chosen in the game', label: 'Choose folder' });
  assert.deepEqual(L.viewOf(fresh({ arena2Dir: null })).options.files, { path: '', note: 'Not set yet', label: 'Choose folder' });
  // the Game files door re-points at any time - and a folder picked later is the one shown
  const repointed = run(run(fresh(), { type: 'check-none' }), { type: 'picked', dir: '/new/ARENA2' });
  assert.deepEqual([repointed.setup.status, L.viewOf(repointed).options.files.path], ['ready', '/new/ARENA2']);
  assert.equal(run(fresh(), { type: 'check-none' }, { type: 'play' }, { type: 'launching' }, { type: 'picked', dir: '/late' }).setup.dir, '/games/DF/DAGGER/ARENA2', 'not once the game is starting');
  // the switch: shown as the config holds it; turned on with the check off, it checks now
  assert.equal(L.viewOf(fresh({ checkEnabled: false, checkOnLaunch: false })).options.checkOnLaunch, false);
  assert.equal(L.viewOf(run(fresh(), { type: 'check-on-launch', on: false })).options.checkOnLaunch, false);
  const on = run(fresh({ checkEnabled: false, checkOnLaunch: false }), { type: 'check-on-launch', on: true }, { type: 'check-start' });
  assert.deepEqual([on.update.status, on.news.status, on.checkOnLaunch], ['checking', 'loading', true]);
  assert.equal(run(run(fresh(), { type: 'check-none' }), { type: 'check-start' }).update.status, 'current', 'a check already answered is not asked again');
});

test('DA10: the shell - Play is the only way in, the news is the check\'s own request, and the options do what they say', () => {
  const main = rd('app/main.cjs');
  // the actions the page can name, and no others
  const acts = main.slice(main.indexOf("ipcMain.on('launcher:act'"), main.indexOf('// THE NAVIGATION FENCES'));
  assert.deepEqual([...acts.matchAll(/case '([\w-]+)':/g)].map((m) => m[1]).sort(),
    ['choose-folder', 'download', 'open', 'open-saves', 'play', 'play-now', 'reinstall', 'retry-saved', 'set-update-check', 'skip-setup', 'use-found']);
  assert.match(acts, /case 'set-update-check': setCheckOnLaunch\(arg === true\); break;/, 'only a real true turns it on');
  assert.match(acts, /const f = Number\.isInteger\(arg\) \? st\.setup\.found\[arg\] : null;/, 'a found folder by its index, and nothing else');
  assert.match(acts, /const r = await judgeForLauncher\(\{ op: 'judge', dir: f\.dir \}, JUDGE_DEADLINE_MS\);/, 'judged again when it is taken - a drive can go away while the window sits open (AUDIT INSTALL L5-21) - in a process of its own (R2-D1)');
  // the game's own picker: chosen at the first run, kept; chosen on the SAVED folder's card, this launch's alone (R2-D6)
  assert.match(acts, /saveConfig\(st\.setup\.saved \? \{ \.\.\.loadConfig\(\), arena2IngestClear: true \} : \{ \.\.\.loadConfig\(\), arena2InGame: true \}\);/);
  assert.match(main, /inGamePicker: cfg\.arena2InGame === true \|\| !!process\.env\.DAGGER_SKIP_ARENA2_PROMPT,/);
  // the version last played, kept at the handover - the next launch's NEW marks
  const hand = main.slice(main.indexOf('function launchGame()'), main.indexOf('/** The launch check, inside DA6'));
  assert.match(hand, /saveConfig\(\{ \.\.\.loadConfig\(\), lastPlayed: app\.getVersion\(\) \}\);/);
  // AUDIT INSTALL R2-A9: returning is a config.json from BEFORE DA10 - not one a first run wrote before its first Play
  assert.match(main, /const returning = !cfg\.lastPlayed && cfg\.launcherSeen !== true && Object\.keys\(cfg\)\.length > 0;\s*if \(cfg\.launcherSeen !== true\) saveConfig\(\{ \.\.\.loadConfig\(\), launcherSeen: true \}\);/);
  assert.match(main, /\n\s*returning,\n/);
  // the news: the check's own request, asked beside it inside the gates, kept in news.json
  assert.match(main, /const RELEASES_LIST_API = 'https:\/\/api\.github\.com\/repos\/Lattymoy\/daggerfall-js-source\/releases\?per_page=20';/);
  const news = main.slice(main.indexOf('async function fetchNews()'), main.indexOf('/** An update, told to the game'));
  assert.match(news, /const items = newsFrom\(await res\.json\(\)\);\s*saveNews\(items\);\s*launcherDispatch\(\{ type: 'news', items \}\);/);
  assert.match(news, /catch \{ launcherDispatch\(\{ type: 'news-failed' \}\); \}/);
  assert.equal((main.match(/fetchNews\(\);/g) ?? []).length, 2, 'asked at launch and when the switch is turned on - both inside the gates');
  assert.match(main, /news: loadNews\(\),/, 'the kept list is up from the first paint');
  // the switch is one setting with the File menu's checkbox, and turned on it checks now
  const sw = main.slice(main.indexOf('function setCheckOnLaunch('), main.indexOf('/** The menu resolves its window'));
  assert.match(sw, /saveConfig\(\{ \.\.\.loadConfig\(\), updateCheck: !!on \}\);/);
  assert.match(sw, /if \(on && updateChecksEnabled\(\) && launcher\?\.state\.update\.status === 'skipped'\) \{\s*launcherDispatch\(\{ type: 'check-start' \}\);\s*startLaunchCheck\(\);\s*fetchNews\(\);\s*startRechecks\(\);/);
  assert.match(main, /click: \(item\) => setCheckOnLaunch\(item\.checked\),/);
  // reinstall: asked first, then this copy's own file by the name that never moves
  const re = main.slice(main.indexOf('async function reinstallFromLauncher()'), main.indexOf('/** The handover'));
  assert.match(re, /await launcherDialog\(\(\) => dialog\.showMessageBox\(launcher\.win, reinstallAsk\(\)\)\);/);
  assert.match(re, /if \(goesAhead\(response\)\) shell\.openExternal\(ownDownloadUrl\(\)\);/);
  const own = main.slice(main.indexOf('function ownDownloadUrl()'), main.indexOf('/** File > Restart to Update'));
  assert.match(own, /const file = manualDownloadFile\(\{ platform: process\.platform, portable: !!process\.env\.PORTABLE_EXECUTABLE_DIR, packaged: app\.isPackaged \}\);\s*return file \? latestDownloadUrl\(file\) : RELEASES_PAGE;/);
  // the saves door is the File menu's own
  assert.match(acts, /case 'open-saves': openSavesFolder\(\); break;/);
  assert.match(main, /\{ label: 'Open Saves Folder', click: \(\) => openSavesFolder\(\) \},/);
  // a dock click with no window opens the launcher, as a launch does
  assert.match(main, /app\.on\('activate', \(\) => \{ if \(BrowserWindow\.getAllWindows\(\)\.length === 0 && !directStarting\) runLauncher\(\); \}\);/);
  // File > Locate ARENA2 with the launcher open is the launcher's own door (macOS: the menu bar is the app's)
  assert.match(main, /if \(launcher\) \{ launcherChooseFolder\(\); return; \}/);
});

test('DA10: the menu stays off the launcher, and a second launch shows what the player can see', () => {
  const main = rd('app/main.cjs');
  // Electron's setApplicationMenu sets the menu on EVERY window on Windows and Linux - measured on Electron 42:
  // the launcher grew a File/View bar (27px) at the handover and whenever a notice rebuilt the menu
  const menu = main.slice(main.indexOf('function buildMenu()'), main.indexOf('/** The game\'s window.'));
  assert.match(menu, /Menu\.setApplicationMenu\(Menu\.buildFromTemplate\(template\)\);\s*(\/\/[^\n]*\n\s*)*if \(process\.platform !== 'darwin' && launcher && !launcher\.win\.isDestroyed\(\)\) launcher\.win\.removeMenu\(\);/);
  assert.match(main, /if \(process\.platform !== 'darwin'\) win\.removeMenu\(\);/, 'and the launcher is built without one');
  // a game window being built hidden behind the launcher is not the one a second launch focuses
  assert.match(main, /const w = live\.find\(\(x\) => x\.isVisible\(\)\) \?\? live\.find\(\(x\) => x\.isMinimized\(\)\) \?\? null;/,
    'visible, else minimized (macOS counts a minimized window as not visible) - never one being built hidden');
});

test('DA10: every pick clears what the game stored before - the in-page picker\'s ingest has no folder to re-point from', () => {
  const main = rd('app/main.cjs');
  const use = main.slice(main.indexOf('function useArena2('), main.indexOf('/** A folder the player named, looked at'));
  assert.match(use, /setArena2\(dir\);\s*keepArena2Path\(dir\);\s*launcherDispatch\(\{ type: 'picked', dir \}\);/);
  // AUDIT INSTALL R2-D2: the clear the pick asks for is KEPT (config.json) until it has run - in memory it died with the
  // process, and DA10 installs an update right after a pick
  const keep = main.slice(main.indexOf('function keepArena2Path('), main.indexOf('/** File > Locate ARENA2 Folder with the game running'));
  assert.match(keep, /const \{ arena2InGame: _picker, \.\.\.cfg \} = loadConfig\(\);\s*saveConfig\(\{ \.\.\.cfg, arena2Path: dir, arena2IngestClear: true \}\);/,
    'a folder chosen ends the in-page choice, and the next boot clears any ingest (Audit DA F-DA2) - from any door, the File menu\'s too (L4-11)');
  assert.match(main, /setArena2\(dir\);\s*keepArena2Path\(dir\);\s*(\/\/[^\n]*\n\s*)*if \(target\) \{\s*await clearIngestIfPending\(target\.webContents\);\s*if \(!target\.isDestroyed\(\)\) target\.reload\(\);/, 'File > Locate ARENA2 keeps it the same way');
  assert.doesNotMatch(main, /pendingIngestClear/, 'nothing held in memory for a boot that may be in another process');
  assert.doesNotMatch(use, /before && before !== dir/, 'not only a re-point: a player who used the in-page picker had no folder before');
  // a boot that SERVES a folder clears; it reloads only when something was there to clear
  assert.match(main, /if \(arena2Dir && !win\.isDestroyed\(\) && await clearIngestIfPending\(win\.webContents\) && !win\.isDestroyed\(\)\) win\.reload\(\);/);
  const pending = main.slice(main.indexOf('async function clearIngestIfPending('), main.indexOf('/** File > Open Saves Folder'));
  assert.match(pending, /if \(loadConfig\(\)\.arena2IngestClear !== true\) return false;\s*const r = await clearStoredArena2\(wc\);\s*if \(r === 'failed'\) return false;[^\n]*\n\s*const \{ arena2IngestClear: _done, \.\.\.cfg \} = loadConfig\(\);\s*saveConfig\(cfg\);\s*return r === 'cleared';/,
    'forgotten only once a clear ran to its end - a failed one is tried at the next boot');
  const clear = main.slice(main.indexOf('function clearStoredArena2('), main.indexOf('async function clearIngestIfPending('));
  assert.match(clear, /const count = store\.count\(\);\s*count\.onsuccess = \(\) => \{ held \+= count\.result; \};\s*store\.clear\(\);/, 'counted, then cleared, in one transaction');
  assert.match(clear, /tx\.oncomplete = \(\) => \{ db\.close\(\); res\(held > 0 \? 'cleared' : 'empty'\); \};/);
  assert.match(clear, /tx\.onerror = \(\) => \{ db\.close\(\); res\('failed'\); \};/);
  assert.match(clear, /\.catch\(\(\) => 'failed'/, 'a page gone mid-clear is a clear not done');
});

test('DA10: the page - the news, the card, the options, the bar and PLAY; every action by name', () => {
  const html = rd('app/launcher/index.html');
  for (const id of ['news', 'setup', 'found', 'setup-actions', 'files', 'update-check', 'status', 'detail', 'progress', 'status-actions', 'play', 'version']) {
    assert.match(html, new RegExp(`id="${id}"`), `#${id}`);
  }
  assert.deepEqual([...html.matchAll(/data-act="([\w-]+)"/g)].map((m) => m[1]), ['choose-folder', 'open-saves', 'reinstall', 'play']);
  assert.match(html, /<button id="play" class="play" type="button" data-act="play" disabled>Play<\/button>/, 'Play starts held - the first view frees it');
  const js = rd('app/launcher/launcher.js');
  assert.match(js, /\$\('update-check'\)\.addEventListener\('change', \(e\) => bridge\.act\('set-update-check', e\.target\.checked\)\);/);
  assert.match(js, /if \(act && !act\.disabled\) bridge\.act\(act\.dataset\.act\);/, 'a held Play sends nothing');
  assert.match(js, /if \(Object\.hasOwn\(BADGE, note\.badge\)\) head\.append\(el\('span', `badge \$\{note\.badge\}`, BADGE\[note\.badge\]\)\);/, 'a mark is one of two words, never the shell\'s string');
  assert.match(js, /play\.disabled = !v\.play\.enabled;/);
});
