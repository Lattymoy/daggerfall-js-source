// DA12 (2026-10-08, Mac: "is it possible to integrate the launcher inside the game? ... some game managers, like
// PlayNite, don't reconigze the launcher as a game and also I can't control the Launcher with a controller").
//
// THE SWITCH PAST THE FRONT DOOR, AND A PAD AT IT. The launcher was never a second program - it is the shell's
// first window (DA8) - but a game manager starts a game and watches its process, and an update installed before
// play (the app quits, the installer reopens it) reads as the game having quit. `--play` goes straight into the
// game, its updates the game's (the HUD line, installed at quit), and opens the launcher only when it has
// something to ask. And the launcher answers a controller: the game's own front-door loop (src/ui/menuPad.js),
// served to its page as the one module, never a copy.
//
// The choice is pure (app/lib/launcherState.cjs directPlay) and driven here; the shell's wiring, the page and the
// packing are pinned by source.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { attachMenuPad } from '../src/ui/menuPad.js';

const require = createRequire(import.meta.url);
const L = require('../app/lib/launcherState.cjs');
const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('DA12: --play goes past the launcher only when there is nothing to ask', () => {
  const exe = ['C:\\Games\\Daggerfall Online\\Daggerfall Online.exe'];
  const play = [...exe, '--play'];
  assert.equal(L.PLAY_SWITCH, '--play');
  // no switch: the launcher, whatever is configured
  assert.equal(L.directPlay(exe, { arena2Path: 'D:\\DAGGER\\ARENA2' }), null);
  assert.equal(L.directPlay(exe, { arena2InGame: true }), null);
  // the switch with a saved folder: that folder, to be judged before the game is built
  assert.equal(L.directPlay(play, { arena2Path: 'D:\\DAGGER\\ARENA2' }), 'D:\\DAGGER\\ARENA2');
  // the game's own picker, chosen once and kept: the game, with no folder
  assert.equal(L.directPlay(play, { arena2InGame: true }), '');
  // the first run - no folder, no choice - is the launcher's card, switch or not
  assert.equal(L.directPlay(play, {}), null);
  assert.equal(L.directPlay(play, { arena2Path: '' }), null);
  assert.equal(L.directPlay(play, { arena2InGame: 'yes' }), null, 'only a real true');
  // a dev launch (`electron . --play`) reads the same
  assert.equal(L.directPlay(['electron', '.', '--play'], { arena2InGame: true }), '');
  assert.equal(L.directPlay(null, { arena2InGame: true }), null);
});

test('DA12: the shell - the switch at boot, the folder judged first, the update check the game\'s', () => {
  const main = rd('app/main.cjs');
  const ready = main.slice(main.indexOf('app.whenReady().then('), main.indexOf("app.on('window-all-closed'"));
  assert.match(ready, /const direct = directPlay\(process\.argv, loadConfig\(\)\);\s*if \(direct === null\) runLauncher\(\);\s*else runDirect\(direct\);/);
  // a dock click while the direct start judges its folder does not open a launcher beside the game
  assert.match(ready, /app\.on\('activate', \(\) => \{ if \(BrowserWindow\.getAllWindows\(\)\.length === 0 && !directStarting\) runLauncher\(\); \}\);/);
  const run = main.slice(main.indexOf('async function runDirect('), main.indexOf('// The launcher\'s two words.'));
  // the saved folder judged in a process of its own (R2-D1), and one that is not whole opens the launcher
  assert.match(run, /const r = folderAnswer\(await askArena2\(\{ op: 'judge', dir \}, \{ deadline: JUDGE_DEADLINE_MS \}\)\);\s*if \(!r\.dir\) \{ runLauncher\(\); return; \}\s*setArena2\(r\.dir\);/);
  assert.match(run, /\} else setArena2\(null\);/);
  // the version played kept, as Play keeps it (the launcher's NEW marks)
  assert.match(run, /saveConfig\(\{ \.\.\.loadConfig\(\), lastPlayed: app\.getVersion\(\) \}\);\s*(\/\/[^\n]*\n\s*)*createWindow\(\)\.catch\(\(\) => \{\}\);/);
  // AUDIT DA12: the window stands from createWindow's first line - why the check need not wait on its load
  const cw = main.slice(main.indexOf('async function createWindow('));
  assert.match(cw, /^async function createWindow\(\{ onShown = null \} = \{\}\) \{\n  const win = new BrowserWindow\(\{/);
  assert.match(run, /\} finally \{ directStarting = false; \}/);
  // the check the launcher would have run, inside the same gates - its answer the game's, installed at quit
  assert.match(run, /if \(!updateChecksEnabled\(\)\) return;\s*if \(currentUpdateTransport\(\) === 'updater'\) askUpdater\(\)\.catch\(\(\) => \{\}\);\s*else noticeCheck\(\)\.then\(tellNotice, \(\) => \{\}\);\s*startRechecks\(\);/);
  assert.match(main, /au\.autoInstallOnAppQuit = true;/, 'an update found while playing installs at quit - no reopen for a game manager to lose');
  assert.doesNotMatch(run, /installNow|quitAndInstall/, 'never an install before play');
});

test('DA12: the launcher answers a controller - the game\'s own pad loop, one module, packed beside the page', () => {
  const html = rd('app/launcher/index.html');
  assert.match(html, /<script src="launcher\.js"><\/script>\s*<script type="module" src="pad\.js"><\/script>/);
  const pad = rd('app/launcher/pad.js');
  assert.match(pad, /^import \{ attachMenuPad \} from '\.\/menuPad\.js';$/m);
  assert.match(pad, /^attachMenuPad\(\{ focusStyle: false \}\);$/m, 'the page\'s CSP refuses a style written by script');
  // served by its one name: packed beside the page, the source tree's own unpacked
  const main = rd('app/main.cjs');
  assert.match(main, /const MENU_PAD = app\.isPackaged \? path\.join\(LAUNCHER_DIR, 'menuPad\.js'\) : path\.join\(__dirname, '\.\.', 'src', 'ui', 'menuPad\.js'\);/);
  assert.match(main, /const p = parts\.length === 1 && parts\[0\] === 'menuPad\.js'\s*\? MENU_PAD/);
  const build = JSON.parse(rd('app/package.json')).build;
  assert.deepEqual(build.files.find((f) => f?.from === '../src/ui'), { from: '../src/ui', to: 'launcher', filter: ['menuPad.js'] });
  // the pad's focus is drawn by the page's own stylesheet
  const css = rd('app/launcher/launcher.css');
  for (const sel of ['.plaque.pad-focus', '.play:not(:disabled).pad-focus', '.link.pad-focus', '.check input.pad-focus', '.feed.pad-focus']) {
    assert.ok(css.includes(sel), `${sel} is drawn`);
  }
});

test('DA12: focusStyle false writes no style into the page - the default still does', () => {
  const made = [];
  const doc = {
    defaultView: { requestAnimationFrame: () => 1, cancelAnimationFrame: () => {}, performance: { now: () => 0 } },
    head: { append: (e) => made.push(e) },
    createElement: (tag) => ({ tag, remove() {} }),
    querySelector: () => null,
  };
  attachMenuPad({ doc, getPads: () => [], focusStyle: false })();
  assert.deepEqual(made, []);
  attachMenuPad({ doc, getPads: () => [] })();
  assert.equal(made.length, 1);
  assert.equal(made[0].tag, 'style');
});
