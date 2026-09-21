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

**REL3 (2026-09-21, Mac: "is there a way to auto push a release on each
merge?"): EVERY MAIN PUSH CUTS A RELEASE**, from the same commit the site
deploys. The version is DERIVED, never bumped by hand: MAJOR.MINOR from
`app/package.json`'s committed base (`0.1.0` - CI owns the patch), PATCH
the count of commits on main (`git rev-list --count HEAD`, so the
checkout is full-depth) - monotonic, reproducible from the commit, and
newer than every hand-cut release before it (0.1.5 → 0.1.3576: the
count is the FULL history, every ancestor including merged branches'
commits, which is why a shallow clone's `rev-list --count` is not the
number and why the checkout is full-depth). The first such release,
app-v0.1.3576, cut from #303's merge with all four files - both Windows
ones for the first time. The
marker file and REL1's gate are retired: ONE shell variable names the
number and both the release tag and the `npm version` stamp read it,
which is the whole of REL1's lesson with the second number removed. The
tag-push and dispatch doors stay as manual overrides and take their
version from the tag they name. Runs queue in one concurrency group
rather than cancel - a release half uploaded is worse than one late.
The cost is what it is: three OS builds per merge, and the desktop
update notice fires per merge, exactly as the site's own new-build
notice (SRV-N2) does. Pinned in `test/updatecheck.test.js`. The
paragraph below is the history it replaced.


`.github/workflows/release-desktop.yml` cuts a release through any
of three doors: pushing a tag shaped `app-v*`, a workflow_dispatch
with `release_tag`, or - the door an ordinary merged PR can open -
a main push touching `.github/DESKTOP_RELEASE`, whose first line
names the tag (this is how releases are cut from hosts whose git
relay pushes branches only, and it leaves the release history
readable in git: bump `app/package.json`'s version and the marker
together). The marker's first home was `app/RELEASE`, which
collided with electron-builder's `app/release` OUTPUT directory on
case-insensitive filesystems - the windows and macos legs of the
first release died on mkdir EEXIST while ubuntu sailed; the same
finding class Audit DA recorded for pref keys, biting the infra.
Whichever door, the ubuntu job carries the whole `npm run check`
gate, all three OS runners package installers (AppImage, NSIS +
portable exe, dmg - unsigned; macOS players right-click-Open the
first time), and the artifacts attach to a GitHub Release at that
tag. **REL2 (2026-09-21): "NSIS + portable exe" was a claim, not a
fact, from app-v0.1.0 through app-v0.1.4.** Both Windows targets were
declared under ONE `artifactName`, so both wrote
`DaggerfallEnhanced-<v>-win-x64.exe` and the second overwrote the
first - every release carried exactly one Windows exe, and a player's
report ("the installer is installing to Temp/3JbF0.../Daggerfall
Enhanced.exe") says which one survived: the PORTABLE, which unpacks
into a random `%TEMP%` folder and runs from there, and which has no
directory to choose because it is not an installer. Each Windows
target names its own artifact now (`-win-x64-setup.exe`,
`-win-x64-portable.exe`), the NSIS installer is the ASSISTED kind
(`oneClick: false`, `allowToChangeInstallationDirectory: true`,
per-user), and the release glob attaches every exe. Saves and the
ARENA2 path never moved with the exe either way - they live in
`<appData>/Daggerfall JavaScript` (BR1). Pinned in
`test/relwin1.test.js`; app-v0.1.5 is the first release with both. The landing page's "On your desktop"
section points at `releases/latest`, so cutting a release IS
updating the site's download - no site change needed per release.
`workflow_dispatch` builds the same installers as run artifacts
without cutting a release. Artifact names are
~~`DaggerfallJS-...`~~ `DaggerfallEnhanced-<version>-<os>-<arch>.<ext>`
(BR1, 2026-09-13); bump `app/package.json`'s version with the tag. The
update check reads the release TAG and its html_url, never an asset
name, so the rename does not reach it - and the appId is deliberately
unchanged, or every installed copy would stop seeing updates.

## Updating (DA6)

No auto-updater, on purpose: unsigned builds cannot auto-update on
macOS at all, and nothing here should apply code silently. Instead
the app carries a NOTICE - on launch (and from File > Check for
Updates...) it makes its one network call of its own, a read-only
GET to the repo's releases API, runs the pure compare in
`app/lib/updateCheck.cjs`, and if a newer `app-v*` release exists
offers a dialog whose Download button opens the release page in the
player's browser. Launch checks fail SILENTLY (a notice that nags
about the network is worse than none); the menu check reports
up-to-date and unreachable out loud, because the player asked. The
File menu checkbox ("Check for Updates on Launch", default on,
persisted as `updateCheck` in config.json) turns it off in one
click, and `DAGGER_NO_UPDATE_CHECK` turns it off for the probes.
Updating is an install-over: saves, prefs and the ARENA2 path live
in userData, outside the install, and survive untouched.
`test/updatecheck.test.js` pins the compare's ordering laws and the
wiring (one endpoint, both gates, browser-only Download). If signed
builds ever exist, electron-updater can replace the notice on
Windows/Linux; the notice composes with that rather than fighting
it.

## Updating in place (DA7, 2026-09-21)

Mac: *"With the auto.install releases. Is there an easy way to make it
where players dont have to manually install each release?"* - *"#1 is
best?"* - *"Do it."*

REL3 made every merge a release, and DA6's notice asked the player to
download and install each one - several a day. Where the installer can
replace itself, it now does: `electron-updater` in the shell reads the
release's `latest.yml`, downloads the new installer in the background
(a block delta where one exists) and installs it when the app quits.
The player does nothing and is on the latest build within one restart.

**Three files, one feature, none importing another** - which is why
each is pinned. The SHELL (`app/main.cjs`): the updater is loaded
lazily, `autoDownload` and `autoInstallOnAppQuit` on, never a
prerelease or a downgrade, its launch errors swallowed; the launch
forks on the transport INSIDE DA6's two gates (the File menu checkbox
and `DAGGER_NO_UPDATE_CHECK`), so the probe still never reaches GitHub,
and the manual menu item reports downloading, up-to-date and
unreachable out loud on either transport. The BUILD
(`app/package.json`): a `publish` PROVIDER naming the repo - without
one electron-builder writes no update metadata at all, whatever
`--publish` says (read in `app-builder-lib`'s PublishManager: `--publish
never` only gates the UPLOAD; `latest.yml`, `latest-linux.yml`, the
blockmaps and the installers' own `app-update.yml` come from the
config's provider) - and `electron-updater` a RUNTIME dependency,
because electron-builder packs `dependencies` and never
`devDependencies`. The WORKFLOW: the metadata rides the release beside
the installers (`latest*.yml`, `*.blockmap`), and the run-artifact door
keeps it too.

**Which copies.** `app/lib/autoUpdate.cjs` is the one table, pure:
`updater` for an installed copy on any platform but macOS that is not
the portable exe - today the NSIS install and the AppImage, the two
electron-builder already cuts; `notice` for macOS (an unsigned app
cannot swap itself there, and no signing identity exists), the Windows
portable exe (a bare file that unpacks into `%TEMP%`; electron-builder
writes no `app-update.yml` into it, and its launcher marks its process
with `PORTABLE_EXECUTABLE_DIR`), and an unpackaged `electron .`. DA6
stands under it as the fallback for those three, unchanged.

**How the updater finds a release.** The GitHub provider asks
`releases/latest` for its `tag_name` and downloads `latest.yml` under
that tag - so REL3's `app-v0.1.NNNN` tags work as they are (the
provider's version compare is on the yml's own `version`, not the
tag). An unsigned Windows installer skips the updater's signature
check (no `publisherName` in the metadata, `NsisUpdater.verifySignature`
returns before it verifies), so unsigned builds update unsigned builds.
`allowPrerelease` is off, so a hand-cut prerelease never reaches a
player's copy.

**What changed in the record's own words.** DA6's "nothing here should
apply code silently" was the reason for the notice; DA7 reverses it on
Mac's word, for the two transports where the swap is the installer's
own and the player's files never move. DA6's other reason - macOS -
stands, and macOS keeps the notice.

**Pinned** in `test/autoupdate.test.js` (4): the transport table by
value and DERIVED (every packaged, non-portable, non-mac platform is
the updater's); the shell's settings, the launch fork inside the gate,
the loud path's three answers; the provider, the dependency's kind, the
workflow's two attach steps; and DA6 standing (the silent notice, the
browser Download, one call, the probe's opt-out). Campaign
`tools/mutants/da7.json`: 9 - each transport misrouted, the download
that never installs, the launch that always notices, the launch that
escapes the gate, the release without its metadata, no provider, the
dependency moved to dev - all dead.

**Not seen on a machine.** No release has yet been cut with this in it;
the first one after the merge carries the metadata, and copies
installed from IT onward update in place. A copy installed before it
has no updater and takes the notice one last time.

## Saves move between the website and the app (SP1, 2026-09-21)

A player on Discord, the afternoon a release went out: *"my saves its
all gone."* Mac: *"we need parity between browser and the install."*

**Nothing was deleted.** Nothing in either store removes a save but the
player's own Delete (systems/saveSlots.js: the only three `removeItem`
calls on a slot are deleteSave, an overwrite dropping its stale
picture, and a NEW slot whose write threw). The website keeps a save
in the browser's storage for its origin; the app keeps the same save as
files under `<userData>/Saves/SAVE<n>/`. They are two stores with one
shape, and nothing carried a save from one to the other - so a player
who played on the site and then installed the app opened it to empty
slots, and a player who cleared a browser profile had done the one
thing the file store exists to survive. The saves were in the other
place, or gone with the profile; the app never had them.

**The carrier** is `systems/saveTransfer.js`, pure over a storage-shaped
object. **Export** writes every slot the store holds as ONE zip in the
app's own on-disk layout - `Saves/SAVE<n>/SaveData.txt`, `SaveInfo.txt`,
`Screenshot.jpg` (the three shot spellings pinned equal to
fileStorage.cjs's) - so the zip is also a backup a player can open, and
can be unzipped straight into the app's Saves folder by hand. The zip is
written STORED, no dependency; the reader is the port's own
(dataSource.js readZipEntries, methods 0 and 8). **Import** takes that
zip, or a picked folder (the Saves folder, one SAVE folder, or the whole
userData folder - only the three save files under a `SAVE<n>` segment
are read), and writes each slot into whatever store is under this
build: the browser's on the site, the file store in the app, where the
live index picks the files up within two seconds. A slot never
overwrites another: it keeps its own number when free, takes the first
free one otherwise, and a save the store already holds (same
character, slot name and game minute) is skipped rather than doubled.
The card is written last, as saveSlot writes it, and a write that
throws takes its half slot back.

**The doors** are on the enhanced menu's Load pane, title and pause
alike: a "Move saves" card with Export all saves, Import a zip, Import a
Saves folder, and in the app the folder's own path. The classic skin's
load window has no room for them; a classic-skin player switches skin
for the minute it takes. Pinned by execution: the round trip through
the port's own zip reader byte for byte, the taken number moving, the
double skipped, the quota throw leaving nothing, the layout equal to
the app's. 12 mutants, 12 dead.

**The second half of the same report** - *"he created a new character and it overwrote his save"* - was a different fault and a real one: a save's identity was the character's NAME, so a new character of the same name wrote over the old one's QuickSave. Fixed the same day as CHARID1 (Systems-Arc.md); that save is not recoverable.

**For the player who asked:** if you played on the website, your saves
are still in that browser - open the site, Load, Export all saves, then
in the app Load, Import a zip. If you played in the app, they are files
in `%APPDATA%\Daggerfall JavaScript\Saves` (File > Open Saves Folder),
and an update never touches that folder.

## What deliberately did NOT move

Music packs, texture packs and Morrowind data still live in IndexedDB
in the shell - Chromium persists it under userData, their lifecycle
is their own (dataSource.js's M-EXT law), and nothing about a desktop
host changes that. They are candidates for the same folder treatment
later; saves went first because saves are the thing a player cannot
afford to lose with a cleared browser profile.

Doctrine unchanged: ARENA2 never enters the repo, the build, or the
packaged app - the shell READS the player's folder, bundles nothing.
