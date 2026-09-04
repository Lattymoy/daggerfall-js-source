// DA1: THE STORAGE SEAM - where the game asks "where do my bytes
// live?" and the answer depends on what is hosting it.
//
// In a browser the answer has always been localStorage, and for the
// deployed site it stays exactly that. But the desktop shell (app/,
// the downloadable Electron build) can do what a browser never could:
// keep saves as REAL FILES on the player's disk - DFU's own layout,
// Saves/SAVE<n>/SaveData.txt + SaveInfo.txt + Screenshot.jpg - that
// survive a cleared browser profile, back up with a file copy, and
// open in a text editor. Its preload bridges that file store into the
// page as `globalThis.daggerShell.storage`.
//
// The seam exists so the five storage owners (saveSlots, save,
// settings, inputActions, uiPrefs) ask ONE question instead of five
// copies of `globalThis.localStorage ?? null`. Resolution order:
//
//   1. daggerShell.storage  - the shell's file-backed store
//   2. localStorage         - every browser, unchanged
//   3. null                 - headless / storage-disabled; callers
//                             already gate on null everywhere
//
// The shell bridge exposes FUNCTIONS (length(), key(i), getItem...):
// Electron's contextBridge cannot carry a live `length` property
// across the isolation boundary, and the callers' sweep idiom is
// `for (i < storage.length) storage.key(i)` - localStorage's shape.
// So the seam wraps the function bridge in that shape once, here,
// rather than teaching five modules two dialects.
//
// The try/catch is settings.js's own shield, kept: touching
// localStorage THROWS under some privacy modes, and "no storage" must
// read as null, never as a crash.

let _wrapped = null;   // the shell bridge, wrapped once
let _wrappedFrom = null;

/** localStorage's shape over the shell's function bridge. */
function wrapShellStorage(bridge) {
  return {
    get length() { return bridge.length(); },
    key: (i) => bridge.key(i),
    getItem: (k) => bridge.getItem(k),
    // setItem THROWS on failure exactly as localStorage does (quota,
    // disk) - contextBridge re-throws preload errors into the page,
    // and every caller already try/catches for the browser's sake.
    setItem: (k, v) => { bridge.setItem(k, String(v)); },
    removeItem: (k) => { bridge.removeItem(k); },
  };
}

/** The one storage question. Storage-shaped object or null. */
export function appStorage() {
  try {
    const bridge = globalThis.daggerShell?.storage;
    if (bridge) {
      if (_wrappedFrom !== bridge) { _wrapped = wrapShellStorage(bridge); _wrappedFrom = bridge; }
      return _wrapped;
    }
    return globalThis.localStorage ?? null;
  } catch { return null; }
}
