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
const { createFileStorage } = require('./lib/fileStorage.cjs');

const root = ipcRenderer.sendSync('dagger:user-data-path');
const store = createFileStorage(root);

contextBridge.exposeInMainWorld('daggerShell', {
  // Enough identity for an about-line; never load-bearing.
  platform: process.platform,
  versions: { app: process.env.npm_package_version ?? '', electron: process.versions.electron },
  savesPath: store.root,
  storage: {
    length: () => store.length(),
    key: (i) => store.key(i),
    getItem: (k) => store.getItem(k),
    setItem: (k, v) => store.setItem(k, v),
    removeItem: (k) => store.removeItem(k),
  },
});
