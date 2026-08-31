# Desktop App (DA)

The downloadable build: the same game, out of the browser's jar. An
Electron shell (`app/`) loads the SAME `dist/` the website deploys -
zero game-code forks - and adds the two things a browser cannot give:
saves as real files on disk, and ARENA2 read straight from the
player's folder.

## The pieces

- **DA1 - the storage seam** (`src/systems/appStorage.js`). The five
  storage owners (saveSlots, save, settings, inputActions, uiPrefs)
  used to each ask `globalThis.localStorage ?? null`; they now ask
  `appStorage()`, which answers the shell's file store when one is
  bridged in (`globalThis.daggerShell.storage`), localStorage in every
  browser, null headless. The seam also translates dialects: the
  bridge speaks functions (`length()`), the callers speak
  localStorage's property shape (`length`), and the wrap lives in the
  seam so five modules don't learn two dialects. **The browser build
  is behaviorally unchanged** - same keys, same localStorage, same
  everything.

- **DA2 - the file store** (`app/lib/fileStorage.cjs`). localStorage's
  five words over real files, in DFU's own persistentDataPath layout:

  ```
  <userData>/Saves/SAVE<n>/SaveData.txt      dagger.save.<n>
  <userData>/Saves/SAVE<n>/SaveInfo.txt      dagger.saveinfo.<n>
  <userData>/Saves/SAVE<n>/Screenshot.jpg    dagger.saveshot.<n>
  <userData>/Prefs/<key>                     settings, keybinds, ui prefs
  ```

  The JSON halves round-trip byte-identical (the quicksave
  migration's write-then-VERIFY law rides on that); the screenshot is
  the one translation - the game hands a data URL, the disk gets a
  real JPEG, getItem re-wraps it, and nothing compares shot strings.
  Writes are temp-then-rename with an fsync (the `~tmp` marker is a
  spelling no key can mint); a slot key must be a CANONICAL
  non-negative integer or it lives in Prefs (so 'dagger.save.03'
  cannot collide with slot 3); an emptied SAVE folder goes with its
  last file; the enumeration index re-reads the disk on a 2s TTL, so
  a save COPIED INTO the open folder appears on the next load-screen
  sweep without a relaunch. Plain Node, no Electron imports -
  `node --test` runs it in the main suite
  (`test/filestorage.test.js`, which also drives the REAL saveSlots
  laws over a temp directory and carries the audit's drift pins).
  Audited whole before hardening: `Audit-DA.md`.

- **DA3 - the shell** (`app/main.cjs`). A `dagger://` protocol serves
  `dist/`, and answers the game's `./arena2/*` fetches from a folder
  the player picks ONCE (native dialog, path in `config.json`,
  re-pickable from the File menu). The serving rules are the vite dev
  middleware's, kept faithfully: flat names, case-insensitive lookup
  (real installs mix INVE00I0.img beside INVE04I0.IMG), the BOOKS/
  fallback for BOK*.TXT. Because the "network" path now answers,
  `ensureArena2()`'s probe succeeds and the in-page picker never
  shows - no IndexedDB ingest, no 155MB copy, no diet: the full sky
  sets, straight off disk. With no folder configured the requests 404
  and the in-page picker takes over, so the browser path remains the
  fallback, never a dead end. The File menu carries the two doors the
  files make possible: **Open Saves Folder** and **Locate ARENA2
  Folder...** - and Locate also WIPES any stored in-page ingest
  (the `arena2` + `derived` stores only; packs survive), because
  `getBytes` asks IndexedDB before the network and a stale ingest
  would otherwise shadow the re-pointed folder silently (Audit DA
  F-DA2). One instance runs per userData; a second launch focuses
  the first. Every webContents is fenced: window-opens and
  navigations to dagger:// are allowed, http(s) goes to the system
  browser, everything else is refused - the storage bridge never
  faces content we did not ship.

- **DA4 - the bridge** (`app/preload.cjs`). contextBridge exposes
  `daggerShell` (platform, versions, savesPath, storage). Calls are
  synchronous - which is what the callers need, localStorage being
  synchronous - and a thrown setItem (disk full) crosses the bridge
  as an Error, the same contract as QuotaExceededError, which every
  caller already try/catches.

- **DA5 - the proof** (`tools/appShellProbe.mjs`). Launches the real
  Electron shell headless (xvfb), asserts the dagger:// document, the
  bridge's five words, a save written FROM THE PAGE landing on disk
  DFU-shaped with a real JPEG, byte-identical read-back, enumeration,
  and the emptied-folder law. `npm run build` first, then
  `xvfb-run -a node tools/appShellProbe.mjs`.

## Running and packaging

```
npm run build          # at the repo root - the shell loads dist/
cd app && npm install
npm start              # the app; first run asks for ARENA2
npm run dist           # electron-builder installers into app/release/
```

`DAGGER_DEV_URL=http://localhost:5173/play/` points the shell at a
running vite dev server (file saves still live; arena2 comes from the
dev middleware). `DAGGER_USER_DATA` relocates saves/config (the
probe's door, and a portable install's). `DAGGER_SKIP_ARENA2_PROMPT`
suppresses the first-run dialog (headless). `DAGGER_SHELL_EXE` points
the probe at a PACKAGED binary (release/linux-unpacked/...) so the
installer's payload answers the same sixteen checks the dev shell
does.

## The release channel

`.github/workflows/release-desktop.yml` cuts a release through any
of three doors: pushing a tag shaped `app-v*`, a workflow_dispatch
with `release_tag`, or - the door an ordinary merged PR can open -
a main push touching `app/RELEASE`, whose first line names the tag
(this is how releases are cut from hosts whose git relay pushes
branches only, and it leaves the release history readable in git:
bump `app/package.json`'s version and `app/RELEASE` together).
Whichever door, the ubuntu job carries the whole `npm run check`
gate, all three OS runners package installers (AppImage, NSIS +
portable exe, dmg - unsigned; macOS players right-click-Open the
first time), and the artifacts attach to a GitHub Release at that
tag. The landing page's "On your desktop"
section points at `releases/latest`, so cutting a release IS
updating the site's download - no site change needed per release.
`workflow_dispatch` builds the same installers as run artifacts
without cutting a release. Artifact names are
`DaggerfallJS-<version>-<os>-<arch>.<ext>`; bump `app/package.json`'s
version with the tag.

## What deliberately did NOT move

Music packs, texture packs and Morrowind data still live in IndexedDB
in the shell - Chromium persists it under userData, their lifecycle
is their own (dataSource.js's M-EXT law), and nothing about a desktop
host changes that. They are candidates for the same folder treatment
later; saves went first because saves are the thing a player cannot
afford to lose with a cleared browser profile.

Doctrine unchanged: ARENA2 never enters the repo, the build, or the
packaged app - the shell READS the player's folder, bundles nothing.
