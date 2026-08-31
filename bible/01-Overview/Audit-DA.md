# Audit DA - the desktop-app slice, audited before it hardened

The DA slice (the Electron shell + file-backed saves,
`Desktop-App.md`) was audited whole before its follow-up work: three
adversarial lanes read the working tree independently - the file
store against localStorage's contract, the shell against the dev
middleware's serving rules and Electron hardening practice, and the
game side for seam bypasses and dagger:// boot assumptions - with the
tree frozen until every lane reported (the 17l law). Two lanes proved
findings by execution: node scripts against the real modules, and the
real shell launched under xvfb.

## Real bugs found and fixed

- **F-DA1 (store): non-canonical `SAVE03` dirs indexed as slot 3 but
  every file probe read `SAVE3`.** A hand-restored padded folder was
  a key whose getItem answered null; beside a real `SAVE3` it was a
  DUPLICATE `key(i)` entry that `enumerateSaves` faithfully turned
  into the same save listed twice (proven through the real module).
  rescan now admits only spellings whose number round-trips, and
  de-dupes.

- **F-DA2 (shell): "Locate ARENA2 Folder" was silently shadowed by a
  prior in-page ingest.** `getBytes` asks memory -> IndexedDB ->
  network, and `ensureArena2` returns on a current manifest - so a
  player who ever ran the browser-style picker re-pointed the path
  and NOTHING visible changed. The menu action now wipes the stored
  set (the `arena2` + `derived` stores only, mirroring
  `clearStoredData`'s law - the player's packs survive) before the
  reload, deferred to next boot when no window is open.

- **F-DA3 (shell, macOS): the app menu closed over a window that
  Cmd-W destroys**, so File > Locate ARENA2 in the zero-window state
  threw on a destroyed BrowserWindow. Menu handlers now resolve
  their window at click time and tolerate having none.

## Hardening landed with it

- Navigation fences: `setWindowOpenHandler` + `will-navigate` on
  every webContents - dagger:// (the game's own tool pages) allowed,
  http(s) handed to the system browser, everything else refused. The
  live probe proved child windows do NOT inherit the preload, so the
  storage bridge only ever faces shipped content.
- The arena2 name cache no longer caches a transient readdir failure
  as an empty map (a slept network drive used to 404 mixed-case
  installs forever), and it drops on every page load so View >
  Reload sees added files.
- The protocol handler: malformed percent-encoding answers 400
  instead of dying as a net error; a directory serves its
  `index.html` (the landing page's `./play/` link works in-shell); a
  directory named like an ARENA2 file 404s instead of rejecting the
  response; the arena2 door matches EXACTLY the two mounts dev
  serves, not any path ending in the name.
- Single instance per userData (two shells over one Saves folder held
  mutually stale indexes); the store's enumeration index rescans on a
  2s TTL so a save copied into the open folder appears without a
  relaunch; `saveKeyBinds` gained the try/catch shield every other
  storage writer already had; the shell is never LEAN whatever the
  touch sniff says; tmp files fsync before rename, use a `~tmp`
  marker no key can mint, and are swept by the empty-dir cleanup;
  the empty pref key and Windows reserved device names encode
  safely; a torn screenshot overwrite resolves by newest mtime; an
  image MIME with no honest extension stays verbatim instead of
  wearing `.jpg`.

## Accepted, recorded, not fixed

- `sandbox: false` on the renderer is the standing tradeoff for the
  preload's synchronous file IO; the navigation fences are its
  compensating control. Moving the store behind sync IPC in main
  would allow `sandbox: true` - noted as the shape of a future
  hardening slice.
- Case-insensitive filesystems fold pref keys differing only by
  case; lone-surrogate values lose to UTF-8. Both unreachable from
  the game's writers (fixed lowercase keys, JSON.stringify values) -
  recorded in the store's header.
- `staleChunk`'s failure text still speaks browser words ("hard
  refresh, Ctrl-Shift-R") to desktop players; the reload ladder
  itself works under dagger://. Cosmetic, deferred.
- Testing.md's suite line counts `^test(` occurrences (the manifest
  guard's convention); the runner reports one more - a counting-shape
  difference that predates this slice.
- Two instances are prevented per userData, not per machine - two
  shells over DIFFERENT `DAGGER_USER_DATA` roots are legitimate (the
  probe depends on it).

## The pins

`test/filestorage.test.js` now holds ten audit tests plus the two
drift pins this audit was convened around: `globalThis.localStorage`
may appear in `src/` only inside `systems/appStorage.js` (a sixth
storage consumer would work in every browser and silently split its
data out of the desktop file store), and `app/main.cjs` may not
drift from the dev middleware's serving literals (flat-name gate,
BOK fallback, uppercase map) nor from `dataSource.js`'s database and
store names for the ingest wipe. `tools/appShellProbe.mjs` gained
the directory-index and malformed-encoding checks and now says out
loud that it drives the bridge, not the built bundle's seam.
