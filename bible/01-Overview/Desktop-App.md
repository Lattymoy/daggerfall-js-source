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

Packaged, the built site rides inside `app.asar` (DA11) - never as
loose files beside it.

`DAGGER_DEV_URL=http://localhost:5173/play/` points the shell at a
running vite dev server (file saves still live; arena2 comes from the
dev middleware). `DAGGER_USER_DATA` relocates saves/config (the
probe's door, and a portable install's). `DAGGER_SKIP_ARENA2_PROMPT`
suppresses the first-run dialog (headless). `DAGGER_SHELL_EXE` points
the probe at a PACKAGED binary (release/linux-unpacked/...) so the
installer's payload answers the same checks the dev shell does.
~~`DAGGER_SKIP_ARENA2_PROMPT` suppresses the first-run dialog~~ (DA8/DA10:
there is no dialog - it stands for the player choosing the game's own
picker, so the launcher asks nothing; the probe still presses Play).

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
version from the tag they name. A new tag is cut at the commit the
installers were built from (`target_commitish`, AUDIT 68), never at
wherever main's head has moved to by upload time. Runs queue in one
concurrency group rather than cancel - a release half uploaded is worse than one late.
The cost is what it is: three OS builds per merge, and the desktop
update notice fires per merge, exactly as the site's own new-build
notice (SRV-N2) does. Pinned in `test/updatecheck.test.js`. The
paragraph below is the history it replaced.

**REL4 (2026-09-29, Mac: "How can we drastically improve the install
experience? ... I really want to make it AAA grade"): THE RELEASE IS
PUBLISHED WHOLE, ONCE.** Read off GitHub the day this was written: every
release carried its generated notes two or three times over - each OS leg
created-or-updated the same release with `generate_release_notes` on, and
where two legs finished a second apart one append was lost to the other's
write (app-v0.1.4582) - and each release went `latest` when its FIRST leg
finished: app-v0.1.4605 was published at 19:46:32 and its Windows files,
latest.yml among them, arrived at 19:47:57, eighty-five seconds in which
no Windows copy could update from `latest` and no Windows player could
download it. A leg dying after the gate would have left that standing
until the next merge. Now a `version` job resolves REL3's one number once
and every job reads it; the three legs only BUILD and hand their files on
as run artifacts; and `publish` - which runs only when the whole matrix
passed - checks the set is complete (`scripts/desktopRelease.mjs check`:
the four downloads, the three manifests, the two blockmaps, by name),
writes the notes once, stages a DRAFT with every file attached, and
publishes it in one PATCH. `latest` never names a release that is half
there, and a hand re-cut of an old build does not take `latest` back
(`shouldMarkLatest`, REL3's numeric compare). The notes are the
player's: the patch notes of everything merged since the previous
`app-v` tag (REL6, below), with GitHub's list of merged changes beneath
them - the launcher's news panel shows the part above that list (DA10).
Pinned in `test/rel4_release.test.js`; `tools/mutants/rel4.json`, 14,
all dead.

**REL5 (2026-09-29): THE DOWNLOADS HAVE NAMES THAT DO NOT MOVE.** The
build number is out of every file name - `DaggerfallOnline-win-x64-setup.exe`,
`-win-x64-portable.exe`, `-mac-arm64.dmg`, `-linux-x86_64.AppImage` - so
`releases/latest/download/<name>` serves the newest copy for ever and the
landing page (which runs no script, U60) links each platform's installer
directly: the door's Install lands on the desktop app's entry, one click
per platform, where it used to open a release page of eleven files,
updater manifests among them. The number is not lost: it is the TAG, the
stamp inside every file and the `version:` of the manifests. The updater
never keyed on a file name (it reads the name out of latest.yml), and
its differential download finds the previous blockmap by swapping the
version inside the URL, which the tag segment still carries
(electron-updater `Provider.getBlockMapFiles`) - a copy that has updated
before reads it from its own cache first. The one cost, said out loud: a
copy that has never updated through electron-updater, updating across the
rename, finds no old blockmap under the new name and takes one full
download (the updater's own fallback), once. The names are a contract
(`app/lib/downloads.cjs`), held at both ends: the build config must
produce them (`test/rel4_release.test.js`, by electron-builder's own
precedence - target, then platform, then top level) and the publish job
refuses a set without them - a naming change in electron-builder fails
the release before a dead link goes live. **Except once** (Audit-Install
L3-1): the landing page links names only a REL5 release carries, and the
site deploys minutes before the first REL5 release publishes - so from
the merge until that release is `latest`, the four links are dead (and
stay dead if that release fails). Before merging: upload the four
downloads, under the new names, to the current latest release (or merge
the landing page's links after the first REL5 release).

**REL6 (2026-10-01, Mac: "Remove patch notes from the codebase and
somehow refrain from patch notes filling up the codebase"): THE NOTES
COME OFF THE PULL REQUEST.** The notes were `PATCH-NOTES-*.md` files at
the repository's root, one for nearly every merge - 147 by #541, each
read by one release and then kept in the tree for good. Now a pull
request carries its player-facing notes in its own description, under a
`## Patch notes` heading (`## Patch notes: <title>`, its parts under
`###`) - `.github/pull_request_template.md` asks for it, and leaving the
template's comment alone says there is nothing for players. The publish
job's `notes` reads the first-parent merges since the previous `app-v`
tag (GitHub's "Merge pull request #N", a squash's "(#N)"), asks `gh api`
for each pull request with the job's own token (`pull-requests: read`),
and prints each section lifted to the release's `# Patch Notes: <title>`,
newest first. Only a MERGED pull request opened by the repository's own
people (`NOTES_AUTHORS`: owner, member, collaborator) brings notes - a
description stays editable after the merge, and the job prints it as the
official release; an outside contributor's notes are a maintainer's to
carry. A read that fails fails the step: a published release is never
re-cut, so notes are never published as notes there were none of. The
published releases are the archive. No patch-notes file may come back:
`test/rel4_release.test.js` fails any in the tree (`PATCH_NOTES_PATH_RE`,
over the index and the untracked). Retired with the files: the
file-diff reader (`addedNotes`; Audit-Install's L1-1, L3-3, R2-C1 and
R2-C4 findings were about it), its fixtures and twenty-two mutant
records; `tools/mutants/rel6.json`, 31, all dead.

**REL7 (2026-10-03, Mac: "I need you to do this auto"): A PUBLISHED
RELEASE'S NOTES, READ AGAIN.** The publish job reads the notes once, as it
runs. app-v0.1.5767 (#547 and #548) went out as "Fixes and improvements.":
#547's notes had been a PATCH-NOTES file REL6 deleted, and reached its
description a minute after the job had read it. A published release is
never re-cut, but its TEXT can be written again:
`.github/workflows/release-notes.yml`, run by hand with the release's tag,
checks that tag out, reads the notes of the pull requests between the
previous release and it again (`desktopRelease.mjs renotes`, which refuses
a checkout that is not the tag), and patches the release's body - the
notes above GitHub's generated list, which stays; no file of the release
is touched. The launcher shows the new notes the next time it reads the
releases. A description fixed after its merge reaches its release this
way. `test/rel7_renotes.test.js` (3), `tools/mutants/rel7.json` (10, all
dead).


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
Whichever door, a `gate` job runs the whole `npm run check` and
every OS leg `needs` it (AUDIT 68: it had been a step in the ubuntu
leg alone, which the other two never waited for), all three OS
runners package installers (AppImage, NSIS +
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
~~`DaggerfallJS-...`~~ ~~`DaggerfallEnhanced-...`~~ ~~`DaggerfallOnline-<version>-<os>-<arch>.<ext>`~~
`DaggerfallOnline-<os>-<arch>.<ext>` and the two Windows names
(BR1, 2026-09-13; BR4, 2026-09-27; REL5, 2026-09-29: no version in any);
~~bump `app/package.json`'s version with the tag~~ (REL3 derives it).
~~The update check reads the release TAG and its html_url, never an asset
name~~ - the check reads the TAG; since REL5 the notice's Download is
this copy's own asset by its name that never moves (`app/lib/downloads.cjs`)
- and the appId is deliberately unchanged, or every installed copy would
stop seeing updates. ~~The landing page's "On your desktop" section points
at `releases/latest`~~ (REL5: each installer under
`releases/latest/download/`, which is still "cutting a release IS
updating the site's download"). An artifacts-only run is built with
`publish: null` and carries no update metadata (Audit-Install L3-4): a
"try this build" never replaces itself with the public release.

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

DA8 (2026-09-29) retired the LAUNCH dialog: a modal box on nearly every
launch - a release lands several times a day - is a notice in the
launcher window now, and later in the game; the menu's loud check keeps
its three dialogs, and its Download opens this copy's own file (REL5).

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
portable exe (a bare file that unpacks into `%TEMP%`; it DOES carry an
`app-update.yml` - both Windows targets pack one `win-unpacked`,
Audit-Install R2-C5 - so the portable launcher's mark on its process,
`PORTABLE_EXECUTABLE_DIR`, is the test, asked first), a Linux copy not
running as its AppImage (electron-updater replaces only the AppImage
named by `APPIMAGE`, and declines to check without one - R2-A10), and an
unpackaged `electron .`. DA6 stands under it as the fallback for those,
unchanged.

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

## The launcher (DA8, 2026-09-29)

Mac: *"How can we drastically improve the install experience? Is there
anyway to send a notification that a new update is available and just
overall improve the experience? A launcher? I really want to make it AAA
grade."*

**What the shell did, measured.** It opened straight into the game and
updated on QUIT (DA7). With a release on every merge - eleven on
2026-09-28 - a player launched into the build before the last one nearly
every time, and online that is a client a protocol behind the relay it
talks to (world117 to world125 in three days; the relay and the client
share `net/wire.js`'s law, with no handshake between builds). They were
never told an update existed, arrived, or what it changed: the website
has SRV-N's build notice, and in the shell that poll reads the BUNDLED
page, so it always answers "current". macOS and the portable exe got a
modal dialog on nearly every launch. And the first run was a bare OS
folder dialog before any window.

**Why not a separate launcher program.** The updates are already small:
the Windows releases' own blockmaps say an update between two of them is
~4.5 MB of a 208 MB installer (2.0-2.2% across four pairs - the same diff
electron-updater runs). A second program would make nothing smaller, and
would be a second thing to install, sign and keep updated. What players
mean by a launcher - a window that is theirs, the update shown and
applied before play, what changed, the first-run setup, the game always
current - the shell does in its FIRST WINDOW, the way Discord's does.

**The window** (`app/launcher/`, drawn from `app/lib/launcherState.cjs`):
dagger://launcher, its own origin; SANDBOXED, with a two-word bridge
(`launcherPreload.cjs`: hear the view, say which button) - no storage, no
files; a CSP with nothing remote and nothing inline; every word, the
patch notes from GitHub included, reaching the page as text; the brand's
own night, wordmark, rule and gem, every colour one the Enhanced skin
uses (U63's law), and the two faces on disk (`fonts/README.md` - it runs
before anything is known about the network). In order:

1. **The update**, inside DA6's two gates. On the updater transport the
   download is SHOWN (its MB~~, and "What's new"~~ - DA10: its notes in
   the news, marked UPDATE) and installs BEFORE play:
   "Installing", then the app closes, the NSIS or AppImage installer runs
   silent (a visible NSIS would stop on a Finish page) and reopens it.
   "Play now, update when I quit" (DA10: **Play without updating**) is the
   way out - never the default Enter presses. On the notice transport the
   window offers **Download** (this copy's own file, REL5) or **Play this
   version** (DA10: Download beside Play). Silence never keeps anyone out:
   an error, or no answer in CHECK_TIMEOUT_MS (8 s), lets the player in,
   ~~and an answer that comes later is the game's to hear~~ (DA10: it
   lands - the launcher is still open). An installer that never takes
   over does not strand the player on "Installing" (INSTALL_GIVEUP_MS) -
   and (Audit-Install L2-1) neither does a download that breaks off or
   stalls, its end its own promise's, never a later check's (R2-A2).
2. **The files** (DA9, below), only when no whole ARENA2 is configured.
3. ~~**What's new**, once, on the launch that runs an update: the patch
   notes of every version between the one the player had and this one~~
   (DA10: the news panel, every launch - the latest releases' notes, the
   versions since the player last played marked NEW. The "every version
   between" was never true: the list is the latest 20 releases, and at
   a release per merge that is about a day and a half, Audit-Install
   L5-9.) electron-updater's own fullChangelog cannot read `app-v` tags -
   it takes versions as semver and returns null.
4. **The game**, built hidden and shown at its first paint - and only
   THEN does the launcher close, so the app is never without a window.

~~With nothing to decide it is a moment's splash.~~ (DA10: it waits for Play.)

**And the app wears its own face.** Every build until this one shipped
with Electron's atom as its icon (electron-builder said so each time:
"default Electron icon is used") - in the taskbar, the Start menu, the
dock, on the installer and inside the AppImage. It is the brand's own
mark now, TI2's home-screen icon (`public/icons/icon-512.png`, the 'D'
on the night), the one the website's install to a phone already wears.

**After the launcher.** An update that lands later - "Play now", or the
hourly re-check while playing (RECHECK_MS, inside the same gates) - is
told IN THE GAME: a HUD line through notify's host-less door
(`src/systems/shellUpdates.js`; `app/preload.cjs` keeps it for a page
that subscribes late), saying what the player can do - it installs at
quit, or now from **File > Restart to Update** (asked first: the game is
running), or on the notice transport **File > Download v...**. Nothing
restarts by itself. Told ONCE, by whoever can: the launcher when it took
it, else the game - now, or at its first load (Audit-Install L2-6).

**UNLOAD-ASK (found building Restart to Update).** The game's unload
guard (`src/systems/unloadGuard.js`, MAC-L3) cancels an unload while
progress is at risk, and a browser answers that with its own "Leave
site?" box. Electron draws none - it just cancels the close (proven on
Electron 42: a guard-shaped beforeunload, a real click, then close():
`will-prevent-unload` fires and the window stays). So once a player was
in the world the window's X, Alt+F4 and File > Quit did NOTHING, and an
update could never install on quit. The shell asks the browser's
question itself - **Leave / Stay**, Stay the default AND the cancel
(`app/lib/shellDialogs.cjs`), asked only when the PLAYER leaves (the
window closing, a quit, View > Reload; a navigation the page starts
itself is kept, as Electron always kept it - Audit-Install L1-3) - and
lets Restart to Update through only once the installer has really taken
over (electron-updater's `before-quit-for-update`, Audit-Install L2-4).

**Network, still honest.** The shell's own requests are the repo's
read-only releases API and nothing else: `releases/latest` for the
notice's check, and the recent-release list for the notes, ~~asked only
when there is an update~~ (DA10: asked at every launch as the news,
inside the same two gates, and kept in news.json). electron-updater's
own requests are DA7's.
Pinned exactly (`test/updatecheck.test.js`: every `net.fetch` is one of
those or a file on disk).

**Pinned** in `test/da8_launcher.test.js` (8 since DA10: the update and
first-run screens by execution; the page and the shell's wiring by
source),
`test/autoupdate.test.js` and `test/updatecheck.test.js` (DA6/DA7's pins
re-stated at the launcher's law), and driven for real by
`tools/appShellProbe.mjs` under xvfb: the launcher is the first window,
the first run with nothing found asks in the launcher and hands over to
the game's own picker, a Steam library is found and its ARENA2 served to
the game, a partial folder is not served, ~~"What's new" is shown once and
config.json lets it go~~ (DA10: the front door's news and marks), and an
update crosses the bridge to a page that subscribes after it arrived.
`tools/mutants/da8.json`: ~~28~~ 22 (DA10 retired the six whose law it
replaced, and re-aimed four), all dead.

**Not seen on a machine**, said plainly: the silent install-and-reopen on
a real Windows NSIS install, the AppImage's in-place swap, and anything
on a real Mac. The calls are electron-updater's own documented ones
(`quitAndInstall(isSilent, isForceRunAfter)`), the events are its own,
~~and the whole flow above them is driven headless on Linux~~ - the
probe drives the launcher, the first run and the handover in a real
window, but always with the update check OFF (a probe never touches the
network): the checking, downloading, installing and notice screens run
in the pure tests ~~and in Chromium with a stubbed bridge~~ (that harness
was never in the tree - Audit-Install R2-E10; `test/launcherDom.mjs` now
runs `launcher.js` over `index.html` in the suite, fed views the real
state makes), never against a live release (Audit-Install L5-19). The
first release carrying this
is the first real proof, and the first report from a Windows player is
the one to read.

## The launcher stays (DA10, 2026-09-29)

Mac, of DA8's window: *"So this is an actual launcher now? Like
warframe?"* - and, offered one that stays open every launch with a Play
button, the latest patch notes and the player's options: *"Yes please."*

**The front door.** DA8's window was Discord's: a splash that went away
by itself whenever it had nothing to ask. Now it is the game's front
door, the way Warframe's is (`app/launcher/`, drawn from
`app/lib/launcherState.cjs`): it opens on EVERY launch and waits for
**PLAY**. On the left, the **patch notes** - the latest releases' own
notes (the repo's release list, the update check's own request inside
its two gates, kept in `news.json` so the panel is up from the first
paint and stays up when GitHub does not answer), the versions installed
since the player last pressed Play marked **NEW**, one on its way marked
**UPDATE**, a bare "Fixes and improvements." listed only when it is one
of those. On the right, the player's own doors: **Game files** (the
folder, and Change), **Saves** (open the folder), **Updates** (Check
automatically - the File menu's checkbox, the same setting - and
Reinstall, which asks first and downloads this copy's own installer).
Along the bottom, the status bar - checking, downloading with its MB
and "Play without updating", installing, "Updated to v...", "Up to
date", offline, off - and PLAY.

**Play is held only while something is being decided for the player**:
an update checked for (at most CHECK_TIMEOUT_MS), fetched or installing,
or no game files. Detection runs at once (the player chooses while the
update downloads), and an install never cuts off the player's own
screen - it waits while the first run's card is up, or one of the
launcher's own dialogs, and the app reopens into the launcher on the new
version. A launcher left open still hears: a late answer after the
timeout, and the hourly re-check (it starts with the launcher now), land
in it until Play is pressed. `config.json` keeps `lastPlayed` (the
version Play was last pressed on) and `arena2InGame` (the game's own
picker, chosen once, not asked again - on the SAVED folder's card, for
that launch only: Audit-Install R2-D6); a config.json from before DA10
has no lastPlayed, and the build it runs is marked NEW for that player -
~~any config.json without one~~ (R2-A9: a first run that chose its files
or flipped the switch before Play wrote one too, and was told "Updated
to"; `launcherSeen` marks a config.json this launcher has seen).

**Fixed on the way** (measured on Electron 42): `Menu.setApplicationMenu`
sets the menu on EVERY window on Windows and Linux, so the launcher grew
a File/View bar (and 27px) at the handover and whenever a notice rebuilt
the menu - it is stripped from the launcher after every build. A second
launch focuses the window the player can see, never a game window still
being built hidden behind the launcher. A dock click with no window
(macOS) opens the launcher, as a launch does. Every folder pick clears
what the game stored before (Audit DA F-DA2's wipe, which only a
RE-point used to trigger - a player of the in-page picker had no folder
to re-point from), and the boot reloads only when something was there -
~~at the next boot~~ at the next boot that runs, whichever launch it is:
the clear is kept in config.json (`arena2IngestClear`) until it has run
to its end (Audit-Install R2-D2: held in memory, it died with the
install DA10 runs right after a pick).

**Pinned** in `test/da10_launcher.test.js` (11, by execution and by
source) beside DA8's restated pins; driven for real by
`tools/appShellProbe.mjs` (the launcher stays, the kept news and its
marks, the status bar, Enter plays - pressed, after the first run's card
too, since Audit-Install R2-E1: it checked the focus, in the one
scenario with no card - the switch writes config.json, no menu bar, Play
keeps lastPlayed); `tools/mutants/da10.json`: 40, all dead.

## The install audit (2026-09-29)

Mac: *"...and audit what we have so far."* Five lanes read REL4, REL5,
DA8, DA9 and DA10 independently - security, the update lifecycle, the
release pipeline, ARENA2 detection, and the tests, docs and player's
eye. Every verified finding was fixed at its root and pinned
(`test/audit_install.test.js`, `tools/mutants/auditinstall.json`: 71,
all dead); the record, finding by finding, is
[Audit-Install.md](Audit-Install.md).

Mac, again: *"Audit this."* Five fresh lanes read the PR after round 1's
fixes, each told to find where round 1 did not hold - and round 1's own
L1-5 fix had stopped every release (the Windows stamp read `"$VERSION"`
in PowerShell, an unset variable). Every verified finding was fixed at
its root and pinned (`test/audit_install2.test.js`,
`tools/mutants/auditinstall2.json`: 123, all dead); the record is
Audit-Install.md's [Round 2](Audit-Install.md#round-2-2026-09-29), and
where it found a claim on this page untrue, the claim is struck here.

## The install is one archive (DA11, 2026-09-30)

Mac: *"Everytime DFO updates, even with the launcher, it deletes
itself."*

The built site shipped BESIDE the app, as `extraResources`: 18,354
loose files under `resources/dist`, 18,430 in the Windows install (read
out of the published app-v0.1.5024 setup's `app-64.7z`). A Windows update is
electron-builder 25.1.8's silent NSIS, and it replaces the install one
file at a time: the OLD version's uninstaller moves every installed
file out to `%TEMP%` (`un.atomicRMDir`, a Rename each), then the NEW
installer unpacks every file to `%TEMP%` and copies each one in
(`extractUsing7za`) - no window, the antivirus reading every new file.
The install folder stood EMPTY for as long as that took, while the
launcher said "closes and reopens by itself in a few seconds". The
player found the app gone; a shortcut clicked in that window is a dead
one Windows offers to delete, and the update (keeping shortcuts) never
makes it again; a setup run by hand quits on the silent installer's
one-instance lock; and a restart or a logoff in that window leaves no
app at all.

The site rides INSIDE `app.asar` now (`app/package.json` `files`: `{
"from": "../dist", "to": "dist" }`), and packaged, `DIST` is
`<app.asar>/dist`. The Linux build's install is 74 files where it was
18,428 (measured: `electron-builder --linux dir`, before and after), and
every one of the 18,354 site files is in the archive byte for byte. Electron's fs and its
`file://` fetch both read inside an asar - measured on Electron 42
(stat, readFile, `net.fetch` of a 3 MB file whole) - so `handleDagger`
is unchanged. `tools/appShellProbe.mjs` with `DAGGER_SHELL_EXE` at the
PACKAGED build: 61 ok, all green, the same 61 as the old packaging;
with software GL the packaged game boots to its intro out of the
archive, no page errors. The portable exe gains too - it unpacked all
18,430 files into `%TEMP%` at every launch.

**The first update onto DA11 is the last slow one**: the uninstaller
that runs is the OLD version's, and it still moves the 18,354 files
out. The installer side is already the new one's.

**Not seen on a machine**, said plainly: a real Windows NSIS update,
before or after. The mechanism is read in electron-builder 25.1.8's
own NSIS templates (`uninstaller.nsh`, `include/installUtil.nsh`,
`include/extractAppPackage.nsh`) and the published installer's
contents; the fix is measured on the Linux package.

**Pinned** in `test/da11_install_whole.test.js` (2): the site in the
archive and nowhere beside it, and the shell reading it there.

## Finding the game files (DA9, 2026-09-29)

**A2-WHOLE, still open in the app.** The shell's test for "this is
ARENA2" was ART_PAL.COL alone; the game's has been the seven files every
boot reads since A2-WHOLE (Discord, 2026-09-22: "boot failed: ARCH3D.BSA:
404"). The website stopped storing a partial folder that day. The app
kept accepting one: a DOS install's small ARENA2 (the BSAs left on the
CD) passed, was saved to config.json, served the palette and died on the
first model - and the shell never asked again, because the path it had
was "valid". Every folder, picked or saved, is held to REQUIRED_ARENA2
now (`app/lib/arena2Detect.cjs`, pinned equal to `dataSource.js`'s), so
a saved partial folder brings the launcher back to asking, and a picked
one is told which files it lacks.

**The shell looks before it asks.** On a first run the launcher looks
where a copy of Daggerfall is actually installed: Daggerfall Unity's own
settings.ini (`[Daggerfall] MyDaggerfallPath` - the folder its setup
already validated; read from DFU's source, company "Daggerfall Workshop",
product "Daggerfall Unity"; a portable DFU's relative path is skipped),
every Steam library in libraryfolders.vdf at the installdir app 1812390's
manifest names (Steam's own registry key on Windows; one install behind
a symlink offered once), GOG Galaxy's registry and GOG's default homes,
and a folder named for Daggerfall where a DaggerfallGameFiles.zip gets
unpacked. Bounded (depth and folders opened), read-only, never throwing.
It OFFERS what it finds - "Found your Daggerfall files: Steam, <path>,
Use these files" - and never takes it silently; with nothing found it
says where to get the game (Steam, GOG) and keeps the game's own
in-page picker one click away, as the website's path always was. Pinned
in `test/da9_arena2detect.test.js` (~~8~~ 14, over real temp trees);
`tools/mutants/da9.json`: 10, all dead.

**The audit's changes (Audit-Install, lane 4).** The search runs in a
~~worker thread~~ process of its own (round 2, below) under DETECT_DEADLINE_MS (5 s), its finds streamed so a
search stopped early still offers what it had - it had run on the main
process, and a sleeping drive or a hung reg.exe froze the launcher's
first paint. It finds what it missed: a zip unpacked with "Extract Here"
(a bare `arena2/` in Downloads), folders moved by Windows' Known Folder
Move or named in another language (the shell passes `app.getPath`),
links and junctions (followed once), a whole `ARENA2` beside a partial
`arena2`, and GOG by Daggerfall's own product key (1435829353) whatever
the folder is called. `reg.exe` is run by its own path and read through
`reg export`'s UTF-16 file. On a Mac, Downloads, Desktop and Documents -
each a privacy prompt - are read only when nothing else was found (true
since round 2 reads ~/Games before them, R2-D5), and the prompt says why; a Mac is sent to DaggerfallGameFiles.zip (Steam and
GOG sell Daggerfall for Windows only). A folder picked three levels too
high (Steam's "Browse local files") is searched, not refused; one that
cannot be read is said to be unreadable; and a SAVED folder that fails
is named, with Try again, instead of the first run's "Where is
Daggerfall?". GOG's own layout is arena2 in the game folder, beside
FALL.EXE - the words, and the fixtures, said DF/DAGGER/ARENA2 for both.

**Round 2 (Audit-Install R2-D1..D8).** Every look at
the player's disks - the saved folder, a pick, a found folder taken, Try
again, the search - runs in an Electron utility process
(`app/lib/arena2Probe.cjs`, `utilityProcess.fork`) under a deadline
(JUDGE_DEADLINE_MS 5 s, PICK_DEADLINE_MS 15 s), killed once it has
answered or has not, and at quit. The saved folder was still read on the
main process before the window (a share that was down: no launcher at
all), and a worker thread stuck in the kernel cannot be terminated -
Electron waited for it at quit; a killed process holds nothing. The
launcher is on screen first, `checking` the saved folder beside it. At
DETECT_DEADLINE_MS the card shows what there is and the search goes on
("Still looking on slower drives"), a later find added to the card - a
Steam drive spinning up, a Mac's privacy prompt answered late. A pick's
walk opens folders named for Daggerfall first (from steamapps/common the
budget went on forty other games), and a walk cut short is never "holds
no Daggerfall files". The in-page copy a pick clears is kept until it
has been cleared (R2-D2, above), a refusal is said where the player can
see it, and a found folder whose drive went away "cannot be read".

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

## The frame rate: VSync read at launch (FPS-VSYNC, 2026-09-28)

Mac, asked whether the app should run above the screen's refresh: "Yes". A page's frames always wait for the screen;
the shell's Chromium can stop waiting, but only if told before it starts. So `main.cjs`, after pinning userData and
before the app is ready, asks `lib/frameRate.cjs` for the player's saved `Video/VSync` (the page's settings blob,
`Prefs/dagger.settings.v1`, through the same file store the page writes with) and, with it OFF, appends
`disable-gpu-vsync` and `disable-frame-rate-limit`. The page's Frame Rate Cap then holds the frames, as DFU's
targetFrameRate does with VSync off; VSync on, the default, launches exactly as before. The settings screen offers
the VSync switch in the app only, and says it takes effect the next time the app starts.

AUDIT 28e: the switches are read ONCE (`FRAME_SWITCHES`) and the page is told what this launch runs with - the preload's
`daggerShell.framesLifted`, over the sync `dagger:frames-lifted` - because with the wait lifted the page must pace its
own frames (`src/systems/frameCap.js` installFramePacer; a held frame would cost a whole refresh). The launch read is
one file (`lib/fileStorage.cjs` readPref), not a whole store: building one listed every save slot before the
single-instance lock. On macOS closing the window does not quit the app, so "the next time the app starts" means a
quit (Cmd+Q) and a start - reopening from the dock keeps the old switches.

## What deliberately did NOT move

Music packs, texture packs and Morrowind data still live in IndexedDB
in the shell - Chromium persists it under userData, their lifecycle
is their own (dataSource.js's M-EXT law), and nothing about a desktop
host changes that. They are candidates for the same folder treatment
later; saves went first because saves are the thing a player cannot
afford to lose with a cleared browser profile.

Doctrine unchanged: ARENA2 never enters the repo, the build, or the
packaged app - the shell READS the player's folder, bundles nothing.
