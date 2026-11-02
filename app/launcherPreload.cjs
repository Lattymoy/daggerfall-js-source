// DA8: THE LAUNCHER'S BRIDGE - two words, and no storage, file or network.
//
// The launcher window runs SANDBOXED (unlike the game window, whose
// preload does synchronous file IO - DA4): all it can do is hear the view
// the shell draws and tell the shell which button was pressed. The shell
// checks the sender and the action against its own list, and every link
// is named, never a URL from the page (app/main.cjs LAUNCHER_LINKS).
'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('daggerLauncher', {
  onView: (cb) => {
    ipcRenderer.on('launcher:view', (_e, view) => cb(view));
    ipcRenderer.send('launcher:ready');
  },
  act: (action, arg) => ipcRenderer.send('launcher:act', { action: String(action), arg: arg ?? null }),
});
