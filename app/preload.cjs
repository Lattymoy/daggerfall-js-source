// DA4: THE BRIDGE - the shell's file store, handed to the page.
//
// Runs isolated, before any game script. The page sees ONE global,
// `daggerShell`, whose storage speaks in FUNCTIONS (length(), key(i),
// getItem, setItem, removeItem): contextBridge cannot carry a live
// `length` property across the isolation boundary, so the DA1 seam
// (src/systems/appStorage.js) wraps these back into localStorage's
// shape on the page side.
//
// Every call is SYNCHRONOUS - contextBridge functions block the
// renderer until the preload returns, which is exactly what the
// callers need: localStorage is synchronous and the save/settings
// paths are written against that. The store itself is
// app/lib/fileStorage.cjs over <userData>/Saves and <userData>/Prefs.
//
// A thrown setItem (disk full, permissions) crosses the bridge as a
// re-thrown Error in the page - the same contract as localStorage's
// QuotaExceededError, and every caller already try/catches it.

'use strict';

const { contextBridge, ipcRenderer } = require('electron');
const path = require('node:path');
const { createFileStorage } = require('./lib/fileStorage.cjs');

const root = ipcRenderer.sendSync('dagger:user-data-path');
const store = createFileStorage(root);

// DA8: an update that arrived while the game runs (app/main.cjs tellGame).
// Heard HERE, before any game script, and kept - the page subscribes from
// its boot (src/systems/shellUpdates.js), which a download finishing
// early can beat.
let updateHeard = null;
const updateListeners = [];
ipcRenderer.on('dagger:update-ready', (_e, info) => {
  updateHeard = info;
  for (const cb of updateListeners) cb(info);
});

contextBridge.exposeInMainWorld('daggerShell', {
  // Enough identity for an about-line; never load-bearing.
  platform: process.platform,
  versions: { app: process.env.npm_package_version ?? '', electron: process.versions.electron },
  savesPath: path.join(store.root, 'Saves'),   // where the saves actually are, not the root above them
  // ESC-LOCK (2026-09-27): a pointer-lock request the page lost for want of a gesture (an Escape close after the
  // player ended the lock) is re-run by the main process AS a gesture (src/player/pointerLock.js shellRelock)
  relockPointer: () => ipcRenderer.send('dagger:relock'),
  // DA8: { version, manual } - `manual` when this copy updates by hand (the notice transport)
  onUpdateReady: (cb) => {
    updateListeners.push(cb);
    if (updateHeard) cb(updateHeard);
    // DA13: the game's boot subscribes once its entry, its language and two of its own lazily loaded modules ran (src/main.js)
    // - the word that it came up, which proves a version on trial (app/main.cjs dagger:game-up, gameStore.bootDone)
    ipcRenderer.send('dagger:game-up');
  },
  // FPS-VSYNC (AUDIT 28e): this launch lifted Chromium's wait (VSync off when it started) - the page paces its frames
  framesLifted: ipcRenderer.sendSync('dagger:frames-lifted') === true,
  storage: {
    length: () => store.length(),
    key: (i) => store.key(i),
    getItem: (k) => store.getItem(k),
    setItem: (k, v) => store.setItem(k, v),
    removeItem: (k) => store.removeItem(k),
  },
});
