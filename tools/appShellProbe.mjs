// DA5: the desktop shell, launched for real. Headless proof that the
// downloadable app actually is the game with files under it:
//
//   1. Electron boots app/main.cjs, the dagger:// protocol serves the
//      BUILT dist/ (so `npm run build` first), and the game's entry
//      document arrives with its scripts;
//   2. the preload bridge is standing: window.daggerShell.storage
//      speaks the five words from the page;
//   3. a save written FROM THE PAGE lands on disk in DFU's layout
//      (Saves/SAVE9/SaveData.txt + SaveInfo.txt + Screenshot.jpg,
//      with the screenshot a real JPEG), reads back byte-identical,
//      and enumerates. (This drives the BRIDGE; the DA1 seam's wrap
//      of it is pinned node-side in test/filestorage.test.js - the
//      built bundle's own use of the seam is not separately proved
//      here, said out loud so nobody reads this probe as covering
//      it.)
//
// Needs a display (xvfb-run -a on a headless box) and the shell's
// deps (`cd app && npm install`). No ARENA2 required: the probe never
// leaves the boot overlay, and the storage laws it proves do not care.
//
// DA8: the first window is the LAUNCHER now (dagger://launcher), and
// DA10 made it wait for PLAY: the probe presses it, as a player does. The
// scenarios after the storage laws drive it for real - the first run with
// nothing found, a Steam library found and its ARENA2 served to the game,
// the front door's news, marks and options, and an update's in-game
// notice crossing the bridge. Each runs its own shell over its own temp
// userData and HOME, so the player's real machine is never read.
//
// DA12: and the launcher driven by a pad (one the page reads in place of a real one), and `--play` - straight into
// the game, or the launcher when it has something to ask.
//
//   npm run build && xvfb-run -a node tools/appShellProbe.mjs

import { _electron } from 'playwright';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(root, 'app', 'package.json'));
const electronPath = require('electron');   // app/node_modules - the shell's own binary
// the version the shell reports: app/package.json's - which is also a packaged binary's, since the
// release stamps that same file before electron-builder reads it
const APP_VERSION = JSON.parse(fs.readFileSync(path.join(root, 'app', 'package.json'), 'utf8')).version;

/** Poll until `pred` holds or `ms` pass. */
async function waitFor(pred, ms = 10000) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    if (await pred()) return true;
    await new Promise((r) => setTimeout(r, 100));
  }
  return false;
}
/** DA10: the launcher's window, and Play pressed once it can be. */
async function pressPlay(app) {
  const isLauncher = (w) => w.url().startsWith('dagger://launcher/');
  await waitFor(() => app.windows().some(isLauncher), 20000);
  const lp = app.windows().find(isLauncher);
  if (!lp) throw new Error(`no launcher window (windows: ${app.windows().map((w) => w.url()).join(', ')})`);
  await lp.waitForSelector('#play:not([disabled])', { timeout: 20000 });
  await lp.click('#play');
  return lp;
}
/** DA8: the game's window, once the launcher has handed over (polled: a window's
 *  first event can come before it has navigated anywhere). */
async function gameWindow(app) {
  const isGame = (w) => w.url().startsWith('dagger://game/');
  await waitFor(() => app.windows().some(isGame), 20000);
  const game = app.windows().find(isGame);
  if (!game) throw new Error(`no game window (windows: ${app.windows().map((w) => w.url()).join(', ')})`);
  return game;
}

const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'dagger-shell-probe-'));
let failures = 0;
const check = (ok, label) => {
  console.log(`${ok ? 'ok' : 'NOT OK'} - ${label}`);
  if (!ok) failures++;
};

let app = null;
try {
  // DAGGER_SHELL_EXE points the probe at a PACKAGED binary (the
  // release/linux-unpacked build) instead of dev electron over app/ -
  // same checks, so the installer's payload is held to the same laws.
  const exe = process.env.DAGGER_SHELL_EXE;
  app = await _electron.launch({
    executablePath: exe ?? electronPath,
    args: exe ? ['--no-sandbox'] : ['--no-sandbox', path.join(root, 'app')],
    env: {
      ...process.env,
      DAGGER_USER_DATA: userData,
      DAGGER_SKIP_ARENA2_PROMPT: '1',
      DAGGER_NO_UPDATE_CHECK: '1',   // the probe proves the shell, not GitHub's uptime
    },
  });
  // DA8: the launcher first - and DA10: it waits for Play, which the probe presses as a player does
  await pressPlay(app);
  const page = await gameWindow(app);
  await page.waitForLoadState('domcontentloaded');

  check(page.url() === 'dagger://game/play/index.html', `the game document over dagger:// (got ${page.url()})`);
  await waitFor(() => app.windows().length === 1);
  check(app.windows().length === 1, 'the launcher closed once the game showed');
  check(await page.evaluate(() => !!document.querySelector('script')), 'the built entry script arrived');

  const bridge = await page.evaluate(() => ({
    has: !!window.daggerShell,
    words: window.daggerShell ? Object.keys(window.daggerShell.storage).sort() : [],
    savesPath: window.daggerShell?.savesPath ?? null,
  }));
  check(bridge.has, 'daggerShell bridge exposed');
  check(bridge.words.join(',') === 'getItem,key,length,removeItem,setItem', `the five words (got ${bridge.words})`);
  check(bridge.savesPath === path.join(userData, 'Saves'), 'savesPath points at the Saves folder itself');

  // The protocol's web-host manners: a directory serves its
  // index.html (the landing page links Play as ./play/), and
  // malformed percent-encoding answers as a failed REQUEST, never a
  // dead renderer.
  const manners = await page.evaluate(async () => {
    const dir = await fetch('dagger://game/play/');
    let badOk = false;
    try { const r = await fetch('dagger://game/play/%E0'); badOk = !r.ok; } catch { badOk = true; }
    return { dirOk: dir.ok, badOk, alive: true };
  });
  check(manners.dirOk, 'a directory request serves its index.html');
  check(manners.badOk && manners.alive, 'malformed percent-encoding refuses without killing the page');

  // A save from the page, DFU-shaped on disk. A tiny real JPEG (SOI +
  // EOI) rides as the screenshot.
  const shot = 'data:image/jpeg;base64,' + Buffer.from([0xff, 0xd8, 0xff, 0xd9]).toString('base64');
  const roundTrip = await page.evaluate((shotUrl) => {
    const s = window.daggerShell.storage;
    s.setItem('dagger.save.9', '{"v":1,"name":"Probe"}');
    s.setItem('dagger.saveinfo.9', '{"saveName":"ProbeSave","characterName":"Probe"}');
    s.setItem('dagger.saveshot.9', shotUrl);
    s.setItem('dagger.settings.v1', '{"Video":{"Fullscreen":"True"}}');
    const keys = [];
    for (let i = 0; i < s.length(); i++) keys.push(s.key(i));
    return { back: s.getItem('dagger.save.9'), shotBack: s.getItem('dagger.saveshot.9'), keys };
  }, shot);
  check(roundTrip.back === '{"v":1,"name":"Probe"}', 'SaveData round-trips byte-identical through the bridge');
  check(roundTrip.shotBack === shot, 'the screenshot data URL round-trips');
  check(roundTrip.keys.includes('dagger.saveinfo.9') && roundTrip.keys.includes('dagger.settings.v1'),
    `enumeration sees the writes (got ${roundTrip.keys})`);

  const slotDir = path.join(userData, 'Saves', 'SAVE9');
  check(fs.readFileSync(path.join(slotDir, 'SaveData.txt'), 'utf8') === '{"v":1,"name":"Probe"}',
    'Saves/SAVE9/SaveData.txt holds the exact bytes');
  check(fs.existsSync(path.join(slotDir, 'SaveInfo.txt')), 'SaveInfo.txt beside it');
  const jpg = fs.readFileSync(path.join(slotDir, 'Screenshot.jpg'));
  check(jpg[0] === 0xff && jpg[1] === 0xd8, 'Screenshot.jpg is a real JPEG on disk');
  check(fs.existsSync(path.join(userData, 'Prefs', 'dagger.settings.v1')), 'settings landed under Prefs/');

  // The DA1 seam from inside the game's own modules: the entry chunk
  // already booted; ask the page-side wrap directly.
  const seam = await page.evaluate(() => {
    const s = window.daggerShell.storage;
    s.removeItem('dagger.save.9'); s.removeItem('dagger.saveinfo.9'); s.removeItem('dagger.saveshot.9');
    return s.getItem('dagger.save.9');
  });
  check(seam === null, 'removeItem answers null afterwards, localStorage-style');
  check(!fs.existsSync(slotDir), 'the emptied SAVE9 folder went with its last file');

  // DA8: an update that lands while the game runs is told to the page. It is SENT first and listened
  // for after, so this also holds the preload to keeping it for a page that subscribes late (a boot).
  await app.evaluate(({ BrowserWindow }) => {
    for (const w of BrowserWindow.getAllWindows()) w.webContents.send('dagger:update-ready', { version: '9.9.9', manual: false });
  });
  const told = await page.evaluate(() => new Promise((resolve) => {
    window.daggerShell.onUpdateReady((info) => resolve(info));
    setTimeout(() => resolve(null), 3000);
  }));
  check(told?.version === '9.9.9' && told.manual === false, `the game hears the shell's update (got ${JSON.stringify(told)})`);
} finally {
  // app may never have launched - the temp userData must not outlive
  // the probe either way.
  try { await app?.close(); } catch { /* already down */ }
  fs.rmSync(userData, { recursive: true, force: true });
}

// ---- DA8/DA9: the launcher, driven ------------------------------------
const WHOLE = ['ARCH3D.BSA', 'BLOCKS.BSA', 'MAPS.BSA', 'MONSTER.BSA', 'WOODS.WLD', 'TEXT.RSC', 'ART_PAL.COL'];
/** A shell over its own temp userData and HOME - the player's machine is never read. */
async function scenario(name, { setup = () => {}, env = {}, args = [], first = 'dagger://launcher/**' } = {}, body) {
  const dirs = { userData: fs.mkdtempSync(path.join(os.tmpdir(), 'dagger-la-ud-')), home: fs.mkdtempSync(path.join(os.tmpdir(), 'dagger-la-home-')) };
  let shell = null;
  try {
    setup(dirs);
    const exe = process.env.DAGGER_SHELL_EXE;
    shell = await _electron.launch({
      executablePath: exe ?? electronPath,
      args: [...(exe ? ['--no-sandbox'] : ['--no-sandbox', path.join(root, 'app')]), ...args],
      env: { ...process.env, HOME: dirs.home, USERPROFILE: dirs.home, XDG_CONFIG_HOME: '', XDG_DATA_HOME: '', DAGGER_USER_DATA: dirs.userData, DAGGER_NO_UPDATE_CHECK: '1', ...env },
    });
    const launcherPage = await shell.firstWindow();
    // AUDIT INSTALL L5-20: its own document, not the about:blank a new window starts on
    await launcherPage.waitForURL(first, { timeout: 20000 }).catch(() => {});
    await launcherPage.waitForLoadState('domcontentloaded');
    await body(shell, launcherPage, dirs);
  } catch (err) {
    check(false, `${name}: ${err?.message ?? err}`);
  } finally {
    try { await shell?.close(); } catch { /* already down */ }
    fs.rmSync(dirs.userData, { recursive: true, force: true });
    fs.rmSync(dirs.home, { recursive: true, force: true });
  }
}
const titleOf = async (p) => (await p.textContent('#setup-title'))?.trim();
const waitTitle = async (p, want) => { await waitFor(async () => (await titleOf(p)) === want); return titleOf(p); };
const statusOf = async (p) => (await p.textContent('#status'))?.trim();
const configOf = (dirs) => { try { return JSON.parse(fs.readFileSync(path.join(dirs.userData, 'config.json'), 'utf8')); } catch { return {}; } };

const launcherShown = (shell) => shell.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()
  .some((w) => w.isVisible() && w.webContents.getURL().startsWith('dagger://launcher/')));
/** A region as the player sees it: laid out, or not - never only the attribute that asks for it (AUDIT INSTALL R2-E). */
const shows = (p, sel) => p.$eval(sel, (e) => getComputedStyle(e).display !== 'none');

await scenario('first run, nothing found', {}, async (shell, lp, dirs) => {
  check(lp.url() === 'dagger://launcher/index.html', `the launcher is the first window (got ${lp.url()})`);
  await waitFor(() => launcherShown(shell));
  check(await launcherShown(shell), 'AUDIT INSTALL R2-E (L5-20): and it is SHOWN - a window built and never shown passed before');
  check(await waitTitle(lp, 'Where is Daggerfall?') === 'Where is Daggerfall?', 'a first run with no Daggerfall asks where it is - in the launcher, not a bare dialog');
  const bridge = await lp.evaluate(() => ({ words: Object.keys(window.daggerLauncher ?? {}).sort().join(','), shell: typeof window.daggerShell }));
  check(bridge.words === 'act,onView' && bridge.shell === 'undefined', `the launcher's bridge is two words and no storage (got ${bridge.words}; daggerShell ${bridge.shell})`);
  const actions = await lp.$$eval('#setup-actions button', (b) => b.map((x) => x.textContent));
  check(actions.includes('Get it on Steam') && actions.includes('Get it on GOG'), `and says where to get it (got ${actions.join(' / ')})`);
  check(await lp.$eval('#play', (b) => b.disabled), 'DA10: no files, no Play');
  await lp.click('text=Choose in the game instead');
  // AUDIT INSTALL R2-E (L5-20): POLLED after a click, never read at once - the shell answers in its own time
  await waitFor(() => configOf(dirs).arena2InGame === true);
  check(configOf(dirs).arena2InGame === true, 'DA10: the game\'s own picker, chosen once, is kept');
  await pressPlay(shell);
  const game = await gameWindow(shell);
  check(game.url() === 'dagger://game/play/index.html', 'choosing in the game hands over to the game - the website\'s picker, never a dead end');
});

await scenario('a Steam library found', {
  setup: ({ home }) => {
    const lib = path.join(home, '.local', 'share', 'Steam');
    fs.mkdirSync(path.join(lib, 'steamapps'), { recursive: true });
    fs.writeFileSync(path.join(lib, 'steamapps', 'appmanifest_1812390.acf'), '"AppState" { "installdir" "The Elder Scrolls Daggerfall" }');
    const a2 = path.join(lib, 'steamapps', 'common', 'The Elder Scrolls Daggerfall', 'DF', 'DAGGER', 'ARENA2');
    fs.mkdirSync(a2, { recursive: true });
    for (const n of WHOLE) fs.writeFileSync(path.join(a2, n), n === 'ART_PAL.COL' ? 'palette-bytes' : 'x');
  },
}, async (shell, lp, dirs) => {
  check(await waitTitle(lp, 'Found your Daggerfall files') === 'Found your Daggerfall files', 'a Steam install is FOUND on first run');
  const found = await lp.$$eval('.found .from', (e) => e.map((x) => x.textContent));
  check(found.length === 1 && found[0] === 'Steam', `offered once, as Steam's (got ${found.join(', ')})`);
  await lp.click('text=Use these files');
  // polled: the folder taken is looked at again, in a process of its own (R2-D1), before the row can name it
  const filesRow = async () => (await lp.textContent('#files'))?.replace(/\u200E/g, '').trim();
  await waitFor(async () => (await filesRow())?.endsWith('DF/DAGGER/ARENA2'));
  const files = await filesRow();
  check(files?.endsWith('DF/DAGGER/ARENA2'), `DA10: the Game files row shows the folder taken (got ${files})`);
  // AUDIT INSTALL R2-E1: the card gone, ENTER plays - the focus sat on the card's hidden answer and pressed nothing
  await waitFor(async () => (await lp.evaluate(() => document.activeElement?.id)) === 'play');
  check(await lp.evaluate(() => document.activeElement?.id) === 'play', `R2-E1: after the card the focus is on Play (got ${await lp.evaluate(() => document.activeElement?.id || document.activeElement?.tagName)})`);
  await lp.keyboard.press('Enter');
  const game = await gameWindow(shell);
  const a2 = fs.realpathSync(path.join(dirs.home, '.local', 'share', 'Steam', 'steamapps', 'common', 'The Elder Scrolls Daggerfall', 'DF', 'DAGGER', 'ARENA2'));
  check(configOf(dirs).arena2Path === a2, 'the found folder is the one config.json keeps');
  const served = await game.evaluate(async () => { const r = await fetch('./arena2/ART_PAL.COL'); return r.ok ? r.text() : `HTTP ${r.status}`; });
  check(served === 'palette-bytes', `and the game reads ARENA2 straight from it (got ${served})`);
});

await scenario('a partial folder is not ARENA2', {
  setup: ({ userData, home }) => {
    const dos = path.join(home, 'DOSGAMES', 'DAGGER', 'ARENA2');
    fs.mkdirSync(dos, { recursive: true });
    for (const n of ['ART_PAL.COL', 'TEXT.RSC']) fs.writeFileSync(path.join(dos, n), 'x');   // the CD kept the BSAs
    fs.writeFileSync(path.join(userData, 'config.json'), JSON.stringify({ arena2Path: path.dirname(dos) }));
  },
}, async (shell, lp, dirs) => {
  // AUDIT INSTALL L4-5/L5-20: the SAVED folder is named and refused - which "Where is Daggerfall?" could not tell from a
  // config.json that was never read
  check(await waitTitle(lp, 'Your Daggerfall folder is not whole') === 'Your Daggerfall folder is not whole',
    'DA9: a saved folder missing the BSAs is not served as ARENA2 - the launcher says so instead of a boot that dies on ARCH3D.BSA');
  const detail = (await lp.textContent('#setup-detail')) ?? '';
  check(detail.includes(path.join(dirs.home, 'DOSGAMES', 'DAGGER')) && /has no ARCH3D\.BSA/.test(detail), `it names the folder and what it lacks (got ${detail})`);
  const actions = await lp.$$eval('#setup-actions button', (b) => b.map((x) => x.textContent));
  check(actions[0] === 'Try again', `and offers to try it again (got ${actions.join(' / ')})`);
});

await scenario('a whole folder saved', {
  setup: ({ userData, home }) => {
    const a2 = path.join(home, 'Games', 'DF', 'DAGGER', 'ARENA2');
    fs.mkdirSync(a2, { recursive: true });
    for (const n of WHOLE) fs.writeFileSync(path.join(a2, n), n === 'ART_PAL.COL' ? 'saved-palette' : 'x');
    fs.writeFileSync(path.join(userData, 'config.json'), JSON.stringify({ arena2Path: a2, lastPlayed: APP_VERSION, launcherSeen: true }));
    fs.writeFileSync(path.join(userData, 'news.json'), JSON.stringify({ items: [{ version: APP_VERSION, date: '2026-09-28T12:00:00Z', text: '# Patch Notes: This One\n- A line.' }] }));
  },
}, async (shell, lp, dirs) => {
  // AUDIT INSTALL L5-5: a player whose folder is set is never asked for it again - no card, the news, and Play
  await waitFor(async () => !(await lp.$eval('#play', (b) => b.disabled)));
  // R2-E (L5-20): as LAID OUT - with the stylesheet's [hidden] rule gone both panels showed, and the attribute said otherwise
  check(!(await shows(lp, '#setup')) && await shows(lp, '#news'), 'a configured folder asks nothing - the front door shows the news');
  const files = (await lp.textContent('#files'))?.replace(/\u200E/g, '').trim();
  check(files === path.join(dirs.home, 'Games', 'DF', 'DAGGER', 'ARENA2'), `the Game files row names it (got ${files})`);
  // the version last played is this one: its own notes are not marked NEW (the status line says "checks are off"
  // whatever lastPlayed holds - this check read it, and could not fail)
  const badge = await lp.$$eval('#news .release .badge', (b) => b.map((x) => x.textContent));
  check(badge.length === 0, `and the version last played is this one - nothing is NEW (got ${JSON.stringify(badge)})`);
  await lp.click('#play');
  const game = await gameWindow(shell);
  const served = await game.evaluate(async () => { const r = await fetch('./arena2/ART_PAL.COL'); return r.ok ? r.text() : `HTTP ${r.status}`; });
  check(served === 'saved-palette', `the game reads the saved folder (got ${served})`);
});

await scenario('the unload guard asks instead of trapping the player', { env: { DAGGER_SKIP_ARENA2_PROMPT: '1' } }, async (shell) => {
  // UNLOAD-ASK: the game's guard (systems/unloadGuard.js) cancels an unload while progress is at risk. A browser
  // asks "Leave site?"; Electron just cancels - so the shell asks. The guard is armed here in its own shape
  // (this probe never spawns a player), the page is given a real click (the activation a player in the world
  // has), and the shell's dialog is answered both ways.
  await pressPlay(shell);
  const game = await gameWindow(shell);
  await game.waitForLoadState('domcontentloaded');
  game.on('dialog', (d) => { d.dismiss().catch(() => {}); });   // CDP surfaces the beforeunload too; the SHELL's answer is under test
  await game.evaluate(() => addEventListener('beforeunload', (e) => { e.preventDefault(); e.returnValue = ''; return ''; }));
  await game.mouse.click(200, 200);
  // AUDIT INSTALL L5-1/L5-20: the answer is chosen BY LABEL from the question actually asked, which is recorded - so a
  // swapped pair of buttons, or Enter bound to Leave, fails here; and "closed" is polled for, never slept on
  const closeAnswering = (label) => shell.evaluate(async ({ BrowserWindow, dialog }, want) => {
    const keep = BrowserWindow.getAllWindows().find((x) => x.__probeKeep) ?? Object.assign(new BrowserWindow({ show: false }), { __probeKeep: true });
    let asked = null;
    dialog.showMessageBoxSync = (_w, opts) => { asked = opts; return opts.buttons.indexOf(want); };
    const w = BrowserWindow.getAllWindows().find((x) => x !== keep && x.webContents.getURL().startsWith('dagger://game/'));
    w.close();
    const until = Date.now() + 5000;
    while (Date.now() < until && !w.isDestroyed() && !(asked && want === 'Stay' && Date.now() > until - 3500)) await new Promise((r) => setTimeout(r, 50));
    return { open: !w.isDestroyed(), asked: asked && { buttons: asked.buttons, byDefault: asked.buttons[asked.defaultId], byCancel: asked.buttons[asked.cancelId], message: asked.message } };
  }, label);
  const stay = await closeAnswering('Stay');
  check(stay.open === true && stay.asked?.message === 'Leave the game?', `UNLOAD-ASK: "Stay" keeps a game whose progress is at risk open (asked ${JSON.stringify(stay.asked)})`);
  check(stay.asked?.byDefault === 'Stay' && stay.asked?.byCancel === 'Stay', 'and Stay is what Enter and Escape press');
  check((await closeAnswering('Leave')).open === false, 'UNLOAD-ASK: "Leave" closes it - the window\'s X, Alt+F4 and Quit work once a player is in the world');
});

await scenario('the launcher is granted nothing and goes nowhere', {
  setup: ({ userData, home }) => {
    const a2 = path.join(home, 'Games', 'ARENA2');
    fs.mkdirSync(a2, { recursive: true });
    for (const n of WHOLE) fs.writeFileSync(path.join(a2, n), 'x');
    fs.writeFileSync(path.join(userData, 'config.json'), JSON.stringify({ arena2Path: a2, lastPlayed: APP_VERSION }));
  },
}, async (shell, lp) => {
  await lp.waitForSelector('#play:not([disabled])', { timeout: 20000 });
  // AUDIT INSTALL R2-B3: the CHECK side too - with only requests fenced, Notification.permission and
  // permissions.query read "granted" and an IdleDetector refused by its request started anyway. A real click, since
  // the request paths need the activation a player's click gives.
  await lp.evaluate(() => {
    const b = Object.assign(document.createElement('button'), { id: 'probe-asks' });
    document.body.append(b);
    b.addEventListener('click', async () => {
      const r = { notification: Notification.permission };
      for (const name of ['notifications', 'clipboard-read', 'camera', 'geolocation', 'idle-detection', 'window-management']) {
        try { r[name] = (await navigator.permissions.query({ name })).state; } catch (e) { r[name] = `threw ${e.name}`; }
      }
      try { await new IdleDetector().start(); r.idleStart = 'STARTED'; } catch (e) { r.idleStart = e.name; }
      try { await navigator.clipboard.readText(); r.clipboard = 'READ'; } catch (e) { r.clipboard = e.name; }
      window.__asks = r;
    });
  });
  await lp.click('#probe-asks');
  await waitFor(() => lp.evaluate(() => !!window.__asks));
  const asks = await lp.evaluate(() => window.__asks);
  const granted = Object.entries(asks).filter(([, v]) => v === 'granted' || v === 'STARTED' || v === 'READ');
  check(granted.length === 0 && asks.idleStart === 'NotAllowedError', `R2-B3: every check the launcher makes reads denied, and nothing it was refused runs (got ${JSON.stringify(asks)})`);
  // AUDIT INSTALL R2-B2: about:blank makes no request, so will-navigate never sees it - the launcher goes home after.
  // Its main-frame commits are read off the shell (the blank page can be too brief for the page object to see).
  await shell.evaluate(({ webContents }) => {
    const wc = webContents.getAllWebContents().find((w) => w.getURL().startsWith('dagger://launcher/'));
    globalThis.__probeCommits = [];
    wc.on('did-navigate', (_e, url) => globalThis.__probeCommits.push(url));
  });
  for (const target of ['about:blank', 'about:blank#x']) {
    await shell.evaluate(() => { globalThis.__probeCommits.length = 0; });
    await lp.evaluate((u) => { setTimeout(() => { location.href = u; }, 10); }, target);
    await waitFor(async () => (await shell.evaluate(() => globalThis.__probeCommits.slice())).at(-1)?.startsWith('dagger://launcher/'));
    const commits = await shell.evaluate(() => globalThis.__probeCommits.slice());
    await lp.waitForSelector('#play:not([disabled])', { timeout: 10000 });
    check(commits[0] === target && commits.at(-1) === 'dagger://launcher/index.html',
      `R2-B2: sent to ${target}, the launcher is back on its own page with its view (commits ${JSON.stringify(commits)})`);
  }
  await lp.evaluate(() => document.querySelector('#play').click());
  const game = await gameWindow(shell);
  await game.waitForLoadState('domcontentloaded');
  const gameAsks = await game.evaluate(async () => ({ notification: Notification.permission, 'idle-detection': (await navigator.permissions.query({ name: 'idle-detection' })).state }));
  check(gameAsks.notification === 'granted' && gameAsks['idle-detection'] === 'granted', `and the game's page keeps Electron's defaults (got ${JSON.stringify(gameAsks)})`);
});

await scenario('the front door', {
  setup: ({ userData }) => {
    // a player who last played an older build: the versions since are NEW, a newer release is UPDATE
    fs.writeFileSync(path.join(userData, 'config.json'), JSON.stringify({ lastPlayed: '0.0.1' }));
    fs.writeFileSync(path.join(userData, 'news.json'), JSON.stringify({ items: [
      { version: '99.0.0', date: '2026-09-29T18:02:00Z', text: '# Patch Notes: Coming\n- Soon.' },
      { version: APP_VERSION, date: '2026-09-28T12:00:00Z', text: '# Patch Notes: The Probe\n\n## Fixes\n- **Probe:** a line.' },
    ] }));
  },
  env: { DAGGER_SKIP_ARENA2_PROMPT: '1' },
}, async (shell, lp, dirs) => {
  check(lp.url() === 'dagger://launcher/index.html', 'the launcher opens');
  await waitFor(async () => !(await lp.$eval('#play', (b) => b.disabled)));
  await new Promise((r) => setTimeout(r, 1500));
  check(shell.windows().length === 1 && shell.windows()[0].url() === 'dagger://launcher/index.html',
    'DA10: with nothing to decide it STAYS - the front door waits for Play');
  const news = await lp.$$eval('#news .release', (rs) => rs.map((r) => ({
    ver: r.querySelector('.ver')?.textContent, badge: r.querySelector('.badge')?.textContent ?? null,
    text: [...r.querySelectorAll('h4, li')].map((x) => x.textContent),
  })));
  check(news[0]?.ver === 'v99.0.0' && news[0]?.badge === 'Update', `the kept news is up at once, a newer release marked UPDATE (got ${JSON.stringify(news[0])})`);
  check(news[1]?.badge === 'New' && news[1].text.includes('The Probe') && news[1].text.includes('Probe: a line.'),
    `this version's notes marked NEW since the one last played, as text (got ${JSON.stringify(news[1])})`);
  check(await statusOf(lp) === 'Update checks are off', `the status bar says where it stands (got ${await statusOf(lp)})`);
  check(await lp.evaluate(() => document.activeElement?.id) === 'play', 'Enter plays');
  // the switch is config.json's updateCheck - the File menu's checkbox
  check(await lp.$eval('#update-check', (c) => c.checked) === true, 'the switch shows the setting');
  await lp.click('#update-check');
  await waitFor(() => configOf(dirs).updateCheck === false);
  check(configOf(dirs).updateCheck === false, 'turned off, it is kept');
  check(await lp.$eval('#update-check', (c) => c.checked) === false, 'and drawn off');
  await lp.click('#update-check');
  await waitFor(() => configOf(dirs).updateCheck === true);
  check(configOf(dirs).updateCheck === true, 'and back on (the probe env still keeps GitHub out of it)');
  check((await lp.textContent('#files'))?.trim() === 'Chosen in the game', 'the Game files row says where the files come from');
  const menuBar = await shell.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().map((w) => w.isMenuBarVisible()));
  check(process.platform === 'darwin' || menuBar.every((v) => v === false), `the launcher wears no menu bar (got ${menuBar})`);
  await lp.click('#play');
  // R2-E (E-32): an event after Play - here the switch - must not start a second game while the first is built
  await lp.evaluate(() => window.daggerLauncher.act('set-update-check', true)).catch(() => {});
  const game = await gameWindow(shell);
  check(game.url() === 'dagger://game/play/index.html', 'Play hands over to the game');
  await new Promise((r) => setTimeout(r, 1500));
  const games = await shell.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().filter((w) => w.webContents.getURL().startsWith('dagger://game/')).length);
  check(games === 1, `and once - an event after Play opened a second game (got ${games})`);
  await waitFor(() => configOf(dirs).lastPlayed === APP_VERSION);
  check(configOf(dirs).lastPlayed === APP_VERSION, 'and the version played is kept - the next launch marks what came since');
});

// ---- DA12: past the front door, and a pad at it ----------------------------
/** A standard-mapped pad the page reads in place of the real one; press(i) holds button i for a few frames. */
const fakePad = async (p) => {
  await p.evaluate(() => {
    const pad = { connected: true, mapping: 'standard', axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
    window.__probePad = pad;
    navigator.getGamepads = () => [pad];
  });
  // a press that hands over closes the page under it - the release then has nowhere to land, and needs none
  const hold = (i, on) => p.evaluate(([b, v]) => { window.__probePad.buttons[b].pressed = v; }, [i, on]).catch(() => {});
  return async (i) => { await hold(i, true); await new Promise((r) => setTimeout(r, 150)); await hold(i, false); await new Promise((r) => setTimeout(r, 150)); };
};
const focusedId = (p) => p.evaluate(() => document.activeElement?.id || document.activeElement?.textContent?.trim() || '');

await scenario('DA12: the launcher answers a controller', {
  setup: ({ userData }) => fs.writeFileSync(path.join(userData, 'config.json'), JSON.stringify({ arena2InGame: true })),
}, async (shell, lp) => {
  const errors = [];
  lp.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await lp.waitForSelector('#play:not([disabled])', { timeout: 20000 });
  await waitFor(async () => (await focusedId(lp)) === 'play');
  const press = await fakePad(lp);
  await press(12);   // up: off Play, into the options
  const up = await focusedId(lp);
  check(up && up !== 'play', `up on the d-pad moves the focus off Play (got ${up})`);
  check(await lp.evaluate(() => document.activeElement?.classList.contains('pad-focus')), 'and marks it - the game\'s own pad loop (menuPad.js) runs on the launcher\'s page');
  for (let i = 0; i < 6 && (await focusedId(lp)) !== 'play'; i++) await press(13);   // down, back to Play
  check(await focusedId(lp) === 'play', 'down brings it back to Play');
  await press(0);    // A
  const game = await gameWindow(shell);
  check(game.url() === 'dagger://game/play/index.html', 'A presses Play - the game, from the controller alone');
  check(errors.length === 0, `no page error - the module loaded under the launcher's CSP, no refused style (got ${errors.join(' | ')})`);
});

await scenario('DA12: --play goes straight into the game', {
  setup: ({ userData, home }) => {
    const a2 = path.join(home, 'Games', 'DAGGER', 'ARENA2');
    fs.mkdirSync(a2, { recursive: true });
    for (const n of WHOLE) fs.writeFileSync(path.join(a2, n), n === 'ART_PAL.COL' ? 'palette-bytes' : 'x');
    fs.writeFileSync(path.join(userData, 'config.json'), JSON.stringify({ arena2Path: a2 }));
  },
  args: ['--play'],
  first: 'dagger://game/**',
}, async (shell, first, dirs) => {
  check(first.url() === 'dagger://game/play/index.html', `the first window is the game (got ${first.url()})`);
  const everLauncher = await shell.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().some((w) => w.webContents.getURL().startsWith('dagger://launcher/')));
  check(!everLauncher, 'and no launcher stands beside it');
  const served = await first.evaluate(async () => { const r = await fetch('./arena2/ART_PAL.COL'); return r.ok ? r.text() : `HTTP ${r.status}`; });
  check(served === 'palette-bytes', `the saved folder, judged whole, is served (got ${served})`);
  await waitFor(() => configOf(dirs).lastPlayed === APP_VERSION);
  check(configOf(dirs).lastPlayed === APP_VERSION, 'the version played is kept, as Play keeps it');
});

await scenario('DA12: --play with nothing chosen is the launcher\'s first run', { args: ['--play'] }, async (shell, lp) => {
  check(lp.url() === 'dagger://launcher/index.html', `the launcher opens to ask (got ${lp.url()})`);
  check(await waitTitle(lp, 'Where is Daggerfall?') === 'Where is Daggerfall?', 'with its first-run card');
});

await scenario('DA12: --play with a folder that is not whole opens the launcher', {
  setup: ({ userData, home }) => {
    const a2 = path.join(home, 'Half', 'ARENA2');
    fs.mkdirSync(a2, { recursive: true });
    fs.writeFileSync(path.join(a2, 'ART_PAL.COL'), 'x');
    fs.writeFileSync(path.join(userData, 'config.json'), JSON.stringify({ arena2Path: a2 }));
  },
  args: ['--play'],
}, async (shell, lp) => {
  check(lp.url() === 'dagger://launcher/index.html', `the launcher, not a game that dies on ARCH3D.BSA (got ${lp.url()})`);
  check(await waitTitle(lp, 'Your Daggerfall folder is not whole') === 'Your Daggerfall folder is not whole', 'and its card says what is wrong');
});

console.log(failures ? `\n${failures} FAILURE(S)` : '\nall shell probes green');
process.exit(failures ? 1 : 0);
