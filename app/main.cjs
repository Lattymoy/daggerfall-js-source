// DA3: THE DESKTOP SHELL - the downloadable build's main process.
//
// The game itself is untouched: this window loads the SAME dist/ the
// website deploys, over a custom dagger:// protocol. What the shell
// adds is exactly what a browser cannot give:
//
//   - ARENA2 FROM DISK. The player points at their ARENA2 folder ONCE
//     (native dialog, path kept in config.json) and every
//     `fetch('./arena2/NAME')` the game makes is answered straight
//     off that folder - no 155MB IndexedDB ingest, no diet, full sky
//     sets, and a re-pointable path when the install moves. The
//     serving rules are the vite dev middleware's, kept faithfully:
//     flat names only, CASE-INSENSITIVE lookup (real installs mix
//     INVE00I0.img beside INVE04I0.IMG), and the BOOKS/ fallback for
//     BOK*.TXT. If no folder is configured the requests 404 and the
//     game's own in-page picker takes over - the browser path is the
//     fallback, never a dead end.
//
//   - SAVES AS FILES. The preload bridges app/lib/fileStorage.cjs
//     into the page as daggerShell.storage; the DA1 seam
//     (src/systems/appStorage.js) prefers it over localStorage, so
//     saves land in <userData>/Saves/SAVE<n>/ as SaveData.txt +
//     SaveInfo.txt + Screenshot.jpg - DFU's own layout - and
//     settings/keybinds land beside them under Prefs/.
//
// The menu carries the two doors this makes possible: "Open Saves
// Folder" and "Locate ARENA2 Folder...".
//
// Dev loop: `npm run build` at the repo root, then `npm start` here.
// Point DAGGER_DEV_URL at a running vite dev server to skip the build
// (saves still go to files; arena2 comes from the dev middleware).

'use strict';

const { app, BrowserWindow, Menu, dialog, ipcMain, protocol, net, shell } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

// DAGGER_USER_DATA points saves/config somewhere else - the probe's
// door (tools/appShellProbe.mjs writes into a temp dir it can read
// back), and a portable install's (point it beside the executable).
if (process.env.DAGGER_USER_DATA) app.setPath('userData', process.env.DAGGER_USER_DATA);

const DIST = app.isPackaged
  ? path.join(process.resourcesPath, 'dist')
  : path.join(__dirname, '..', 'dist');
const CONFIG_FILE = () => path.join(app.getPath('userData'), 'config.json');

// ---- config.json: { arena2Path } ----------------------------------
function loadConfig() {
  try { return JSON.parse(fs.readFileSync(CONFIG_FILE(), 'utf8')) ?? {}; }
  catch { return {}; }
}
function saveConfig(cfg) {
  try {
    fs.mkdirSync(path.dirname(CONFIG_FILE()), { recursive: true });
    fs.writeFileSync(CONFIG_FILE(), JSON.stringify(cfg, null, 2));
  } catch (err) { console.warn('[shell] config write failed:', err.message); }
}

// ---- the ARENA2 folder --------------------------------------------
// The probe is dataSource.js's own: ART_PAL.COL, small and always
// present. A pick of the PARENT folder (the install root with an
// arena2/ inside it) is auto-descended - the honest mistake costs
// nothing.
function findCaseInsensitive(dir, name) {
  try {
    const upper = name.toUpperCase();
    for (const f of fs.readdirSync(dir)) if (f.toUpperCase() === upper) return path.join(dir, f);
  } catch { /* unreadable dir */ }
  return null;
}
function resolveArena2(dir) {
  if (!dir) return null;
  if (findCaseInsensitive(dir, 'ART_PAL.COL')) return dir;
  const nested = findCaseInsensitive(dir, 'arena2');
  if (nested && findCaseInsensitive(nested, 'ART_PAL.COL')) return nested;
  return null;
}

let arena2Dir = null;        // the validated folder, or null
let arena2Names = null;      // UPPERCASE name -> on-disk name (the mixed-case law)
function setArena2(dir) {
  arena2Dir = dir;
  arena2Names = null;
}
function arena2File(name) {
  if (!arena2Dir) return null;
  if (!arena2Names) {
    arena2Names = new Map();
    try { for (const f of fs.readdirSync(arena2Dir)) arena2Names.set(f.toUpperCase(), f); }
    catch { /* folder unplugged - every lookup misses, the page reports */ }
  }
  const onDisk = arena2Names.get(name.toUpperCase());
  let p = onDisk ? path.join(arena2Dir, onDisk) : path.join(arena2Dir, name);
  // B1: books live in ARENA2/BOOKS/ - the dev middleware's fallback.
  if (!fs.existsSync(p) && /^BOK\d+\.TXT$/i.test(name)) {
    const books = findCaseInsensitive(arena2Dir, 'BOOKS');
    if (books) p = findCaseInsensitive(books, name) ?? path.join(books, name);
  }
  return fs.existsSync(p) ? p : null;
}

async function pickArena2(win) {
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    title: 'Locate your ARENA2 folder',
    message: "Daggerfall's game data is freeware but can't be bundled. Pick your ARENA2 folder (or the install folder that contains it).",
    properties: ['openDirectory'],
  });
  if (canceled || !filePaths.length) return null;
  const dir = resolveArena2(filePaths[0]);
  if (!dir) {
    await dialog.showMessageBox(win, {
      type: 'warning',
      message: 'That folder does not look like ARENA2',
      detail: 'ART_PAL.COL was not found in it (or in an arena2/ folder inside it). Pick the ARENA2 folder of a Daggerfall install.',
    });
    return null;
  }
  return dir;
}

// ---- the dagger:// protocol ---------------------------------------
// Standard + fetch-capable so the game's relative fetches, ESM
// imports and workers behave exactly as they do over https.
protocol.registerSchemesAsPrivileged([{
  scheme: 'dagger',
  privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
}]);

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.wasm': 'application/wasm',
};
const fileResponse = (p, mime) => net.fetch(pathToFileURL(p).toString(), { bypassCustomProtocolHandlers: true })
  .then((res) => new Response(res.body, { headers: { 'Content-Type': mime ?? MIME[path.extname(p).toLowerCase()] ?? 'application/octet-stream' } }));

function handleDagger(req) {
  const { pathname } = new URL(req.url);
  const parts = pathname.split('/').filter(Boolean).map(decodeURIComponent);
  // /arena2/NAME and /play/arena2/NAME - the game fetches relative to
  // its document, the probes fetch absolute; both doors, like dev.
  const a2 = parts.indexOf('arena2');
  if (a2 !== -1 && a2 === parts.length - 2) {
    const name = parts[a2 + 1];
    if (!/^[A-Za-z0-9._-]+$/.test(name)) return new Response('bad name', { status: 400 });
    const p = arena2File(name);
    return p ? fileResponse(p, 'application/octet-stream') : new Response('not found', { status: 404 });
  }
  // Everything else is the built site, traversal-proofed into dist/.
  const rel = parts.length ? parts.join('/') : 'play/index.html';
  const p = path.normalize(path.join(DIST, rel));
  if (!p.startsWith(DIST + path.sep)) return new Response('forbidden', { status: 403 });
  if (fs.existsSync(p) && fs.statSync(p).isFile()) return fileResponse(p);
  return new Response('not found', { status: 404 });
}

// ---- the window ---------------------------------------------------
function buildMenu(win) {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Open Saves Folder',
          click: () => {
            const dir = path.join(app.getPath('userData'), 'Saves');
            fs.mkdirSync(dir, { recursive: true });
            shell.openPath(dir);
          },
        },
        {
          label: 'Locate ARENA2 Folder...',
          click: async () => {
            const dir = await pickArena2(win);
            if (!dir) return;
            setArena2(dir);
            saveConfig({ ...loadConfig(), arena2Path: dir });
            win.reload();
          },
        },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    { label: 'View', submenu: [{ role: 'reload' }, { role: 'togglefullscreen' }, { role: 'toggleDevTools' }] },
  ];
  if (process.platform === 'darwin') template.unshift({ role: 'appMenu' });
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

async function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    backgroundColor: '#111111',
    title: 'Daggerfall JavaScript',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,   // the preload reads/writes the Saves files directly
    },
  });
  buildMenu(win);

  const devUrl = process.env.DAGGER_DEV_URL;
  if (devUrl) { await win.loadURL(devUrl); return win; }

  if (!fs.existsSync(path.join(DIST, 'play', 'index.html'))) {
    dialog.showErrorBox('No build found',
      `The game build is missing (${DIST}).\nRun \`npm run build\` at the repository root first.`);
    app.quit();
    return win;
  }
  await win.loadURL('dagger://game/play/index.html');
  return win;
}

// The preload asks for its storage root synchronously at page boot -
// storage must exist before the first module reads a setting.
ipcMain.on('dagger:user-data-path', (e) => { e.returnValue = app.getPath('userData'); });

app.whenReady().then(async () => {
  protocol.handle('dagger', handleDagger);

  const cfg = loadConfig();
  setArena2(resolveArena2(cfg.arena2Path));
  if (!arena2Dir && !process.env.DAGGER_SKIP_ARENA2_PROMPT) {
    // First run (or the folder moved). Cancelling is allowed: the
    // game's own in-page picker still works, it just stores into
    // IndexedDB the way the website does. The env skip is the
    // headless probe's - a native dialog with nobody at the screen
    // is a hang, not a prompt.
    const dir = await pickArena2(null);
    if (dir) { setArena2(dir); saveConfig({ ...cfg, arena2Path: dir }); }
  }

  await createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
