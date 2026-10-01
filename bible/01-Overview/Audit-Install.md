# Audit Install - the install, update and first-run work, audited before it merged

Mac, 2026-09-29: *"Yes please and audit what we have so far"* - of PR
#429's install work: REL4 (the release published whole), REL5 (names
that do not move), DA8 (the launcher), DA9 (the game files found) and,
landing beside the audit, DA10 (the launcher stays). Five independent
lanes read the PR head (226f32bc) - security, the update lifecycle, the
release pipeline, ARENA2 detection, and the tests, docs and the player's
eye - each proving what it could by execution: the real
electron-updater 6.8.9 code under a stubbed app, Electron 42 under xvfb,
node over temp trees, replays of the release script over the
repository's own tags, headless Chromium over the launcher page, and 49
mutants of lane 5's own (all 49 survived the suites as they stood).

Every finding a lane VERIFIED was fixed at its root and pinned - in
`test/audit_install.test.js` or beside the slice it belongs to (da8,
da9, da10, rel4, autoupdate, updatecheck), with
`tools/mutants/auditinstall.json` (71, all dead) and the slices' own
lists re-aimed by content. SUSPECTED findings are fixed where the fix
is sound whatever the answer, and said so. Findings are named L<lane>-<n>
in the lane's own numbering.

Mac then asked for it again - *"Audit this"* - and five fresh lanes read
the PR after round 1 had landed: [Round 2](#round-2-2026-09-29), below,
R2-<lane><n>. Where round 2 found a round-1 claim untrue, the entry says
so in place ("**Round 2:**") rather than being rewritten.

## The update lifecycle (lane 2)

- **L2-1 (P1): a download that failed or stalled held the launcher on
  "Downloading" for ever.** Every updater error reached the launcher as
  `check-failed`, which the reducer takes only while checking; and
  builder-util-runtime arms its socket timeout on a `socket` event that
  Electron's `net.ClientRequest` never emits, so a stalled download had
  no end at all. Errors are routed by where they land (`download-failed`
  under a download: a `failed` status, Play freed, the hourly re-check
  or the next launch tries again), and a download that goes
  DOWNLOAD_STALL_MS (45 s) without a byte is cancelled through the
  check's own CancellationToken. The download's promise is answered, so
  a failure is the error event's, never an unhandled rejection.
  **Round 2:** "without a byte" is without a PROGRESS EVENT (they come a
  second or more apart), a cancel only rejects the download's promise
  (electron-updater 6.8.9 never wires the token to its request - R2-A11),
  and "the check's own token" was a LATER check's when one overlapped the
  download; a download's end is now its own promise's (R2-A2).
- **L2-2 (P1): two "Restart to install" answers installed twice - and on
  Linux the second deleted the AppImage.** electron-updater treats a
  second `quitAndInstall` as ignored and then CLEARS its own
  installed-already flag, so its quit handler installs again: over the
  AppImage the first had just put in place, which `doInstall` unlinks
  before its `mv` fails (proven in the library with real temp files).
  One door to the installer now (`installNow`, once), the restart asked
  once at a time, over the game window (a parentless box could open
  twice, behind a fullscreen game).
- **L2-3 (P1, the mechanism proven, the trigger suspected): a failing
  installer would close the app on every launch.** NSIS reports success
  before its spawn is known, and a cached download re-emits
  `update-downloaded` within a second of launch - so an installer an
  antivirus quarantines, or a folder the player cannot write, made the
  app unlaunchable, where install-on-quit (DA7) had made it harmless.
  The version is written down before the installer is handed the app
  (`config.json installAttempt`); a launch still older than it knows the
  installer did not take, and never tries it before play again - it
  says so (`stuck`: "v... did not install"), frees Play, offers the
  installer to run by hand, and tries again at quit. A NEWER version
  gets its own try.
- **L2-4 (P2): an install that failed on the spot was silent, and left
  the unload guard waived for the session.** `leaveForUpdate` was set
  when the player CHOSE to restart; an AppImage the player cannot write
  fails inside `install()`, no quit follows, and every close and reload
  after it left without asking. It is set only by electron-updater's own
  `before-quit-for-update`, which comes after `install()` succeeded; an
  error while the installer was being handed the app is the install's
  (`installFailed`): the launcher shows `stuck`, the game says "The
  update could not be installed", with the installer.
- **L2-5 (P2): the game's menu grew on the launcher** - Electron's
  `setApplicationMenu` sets the menu on every window on Windows and
  Linux (the launcher 27px taller, File/View at the handover and on a
  notice), and File > Locate ARENA2 acted on the launcher. Fixed with
  DA10 (the launcher's menu stripped after every build; Locate is the
  launcher's own door while it is open).
- **L2-6 (P2): a notice that answered after the launcher let the player
  in was told to no one**, and every re-check after it saw nothing new.
  A notice is told ONCE, by whoever can (`tellNotice`): the launcher when
  it took it, else the game - now, or at its first load.
- **L2-7, L2-9 (P2/P3): "What's new" lost its notes** (reset by a second
  `update-available`, dropped before it was seen). Superseded: DA10
  replaced "What's new" with the news panel.
- **L2-8 (P3): a manual check after a finished download** re-told the
  game (a second HUD line) and said "downloading". The same download
  reported again is not news twice, and the check says "ready".
- **L2-10 (P3): closing the launcher during "Starting" still opened the
  game**, from the hidden window behind it. Closed by the player while
  the game was coming up, the hidden game window goes with it. (On
  macOS the dock click now opens the launcher - DA10.)
- **L2-11 (P3): a packaged Linux copy outside its AppImage waited the
  full 8 s** on "Checking" - electron-updater resolves `null` and emits
  nothing. `null` is said at once. **Round 2:** only the launcher's check
  was fixed - the File menu's said "You're up to date" off that `null`,
  and the launcher's "GitHub did not answer" was never asked. The table
  now knows a copy that is not its AppImage (R2-A10).

## Security (lane 1)

No P0 or P1 in the app. The launcher's file serving, IPC sender checks,
CSP, text-only notes, `openExternal` allowlist and the sandbox held under
live attack (Electron 42, Playwright).

- **L1-1 (P2): a symlinked PATCH-NOTES file would publish runner files -
  the publish job's write token among them - in the release body.** The
  `notes` command read each file from the working tree, and checkout
  leaves its token in `.git/config`. The notes are read from git's own
  objects now (`git show HEAD:`, a file that is not a regular file at
  HEAD - a link, a submodule - never read), and every checkout in the
  workflow sets `persist-credentials: false` (nothing there pushes).
- **L1-2 (P3): the launcher had only the app-wide fences** - it could
  navigate to an https page (handed to the browser) or a dagger://game
  page (with its bridge still on it), and was granted every permission
  (the clipboard read back). It navigates nowhere, opens nothing, is
  granted no permission, and its IPC is heard only from its own page.
  **Round 2:** not quite - `about:blank` was committed (R2-B2) and the
  permission CHECK side still granted (R2-B3); both closed.
- **L1-3 (P3): the unload guard's question could be raised without
  end** by a page's own navigations (21 boxes from 20 reloads, each
  freezing the main process). It is asked when the PLAYER leaves - the
  window closing (Electron's `close` precedes the page's beforeunload,
  measured), a quit, View > Reload - and a page-started navigation is
  kept, as Electron always kept it.
- **L1-4 (P3): `reg` was looked up in the current folder first**
  (libuv's search_path). `System32\reg.exe` by its own path.
- **L1-5 (P3, write access needed): a tag name reached bash in the build
  legs** (`npm version "${{ ... }}"`; git accepts quotes and `$` in a
  tag). The version job fails unless the tag is `app-v<n>.<n>.<n>`, and
  the number reaches scripts through the environment. **Round 2:** on the
  Windows leg the environment was read as `"$VERSION"` in PowerShell - an
  unset variable: the stamp failed and no release could publish (R2-B1,
  P1). The step runs in bash, and a law holds every workflow to it.

## The release pipeline (lane 3)

- **L3-1 (P1): the landing page's download links are dead from the merge
  until the first REL5 release is `latest`** - the site deploys in
  ~3 minutes, the release takes ~10, and the current latest release
  carries only versioned names (a 302 to a 404, measured). Not fixable
  in code without the site's deploy waiting on the release. **Before
  merging #429: upload the four downloads under their REL5 names to the
  release that is `latest` AT THAT MOMENT, with no merge in between**
  (**Round 2**, R2-C6: this said app-v0.1.4684, which was superseded
  before round 1 was committed - every merge before #429 publishes a new
  `latest` without the REL5 names; `gh release view --json tagName`
  names it) (`gh release download` the four files from
  it, rename them `DaggerfallOnline-win-x64-setup.exe`,
  `-win-x64-portable.exe`, `-mac-arm64.dmg`, `-linux-x86_64.AppImage`,
  `gh release upload` them; the manifests untouched) - or merge the
  landing page's link change after the first REL5 release. Seeding
  `DaggerfallOnline-win-x64-setup.exe.blockmap` too makes the first
  update across the rename a delta. Desktop-App.md's "before a dead link
  goes live" says this exception now.
- **L3-2 (P2): a tag that already had a PUBLISHED release was re-cut in
  place.** softprops/action-gh-release (v2 = 2.6.2) updates an existing
  release, ignoring `draft`, deleting and re-uploading each file on the
  live release. The publish job refuses a tag with a published release
  ("cut a new tag"); a draft a failed run left is still reused.
  **Round 2:** reused WITH its old notes and its old commit (softprops
  keeps the lowest-id draft for a tag - read in its source, run against
  a fake API): a draft left at the tag is deleted before staging (R2-C2).
- **L3-3 (P2): the notes republished whole files that were only
  edited**, and the launcher's news repeated them (the Overworld notes,
  first shipped in app-v0.1.4556, again in every release that appended a
  line). An added file is its notes whole; a changed one brings only
  what it ADDS (each hunk's lines beyond the ones it rewrites, under the
  nearest heading and the file's title) - a correction is not news. A
  rename brings nothing, names with a dot or an underscore are read, and
  the newest change comes first. Replayed on app-v0.1.4480..4534 and
  4615..4644. **Round 2:** that replay is where it failed - by POSITION,
  4534's hunk that deleted a "Notes" section took four new fixes for
  rewrites and lost them. News is decided by what a line says now
  (R2-C1).
- **L3-4 (P2): a dispatched "try this build" replaced itself with the
  public release before it ran** - it carried `app-update.yml`, and
  DA8's launcher installs before play. An artifacts-only run is built
  with `publish: null` (explicitly: absent, electron-builder derives
  GitHub from `repository` and writes it anyway; a CLI `-c.publish=null`
  stays the string "null"), and a copy without the file takes the notice
  transport.
- **L3-5 (P3): any API error read as "nothing is latest yet"**, so a 5xx
  could hand an old re-cut `latest`. Only a 404 does; anything else
  fails the step.
- **L3-6 (P3, documented platform behaviour): "runs queue rather than
  cancel"** was true of ONE waiting run - GitHub cancels an older waiting
  run in the group when a newer one queues. Main pushes keep one group
  (the newest waiting merge is cut next, carrying the others); a manual
  door is a group of its own.
- ~~**Not done, and why:** pinning softprops/action-gh-release to a commit
  SHA (lanes 1 and 3) - the session's repository scope does not reach
  softprops' repository to read the SHA.~~ **Round 2** (R2-B4): the SHA
  was one public `git ls-remote` away - pinned (3bb12739, v2 = v2.6.2).

## ARENA2 detection (lane 4)

No P0 or P1: REQUIRED_ARENA2 holds for every real distribution checked
file by file (DaggerfallGameFiles.zip, GOG 1.07, Steam).

- **L4-1 (P2): detection blocked the main process with no time limit**
  (a hung reg.exe: 6 s, fully synchronous; a down network mount: no
  window ever). It runs in a worker thread (which loads from inside
  app.asar - measured) under DETECT_DEADLINE_MS, its finds streamed.
  **Round 2:** the SAVED folder was still read on the main process, before
  the window - on a hung share, still no window ever - and a worker stuck
  in the kernel held the app open after quit. Every look at the disks is
  a utility process of its own now (R2-D1).
- **L4-2 (P2, suspected): up to three macOS privacy prompts on a first
  run.** Downloads, Desktop and Documents are read on a Mac only when
  nothing else was found, and the prompt says why
  (`NS*FolderUsageDescription`). **Round 2:** ~/Games was read AFTER
  them, so files there cost three prompts; it is read first (R2-D5).
- **L4-3 (P2): missed layouts** - "Extract Here" (a bare `arena2/` in
  Downloads), Known Folder Move and localized XDG folders
  (`app.getPath` now), links and junctions (followed, once). Found.
- **L4-4 (P2): picking the Steam game folder answered "It holds no
  Daggerfall files".** The pick is searched with the same bounded walk;
  a folder that cannot be read is said to be unreadable. **Round 2:** on
  the main process, and from steamapps/common the budget went on the other
  games - the walk leads with Daggerfall's name now, off the main process,
  and a walk cut short never says "no Daggerfall files" (R2-D1, R2-D3).
- **L4-5 (P2): a saved folder that failed was met as a first run.** It
  is named ("Your Daggerfall folder cannot be reached / is not whole"),
  with Try again.
- **L4-6 (P3): "on Steam and GOG it is under DF/DAGGER/ARENA2"** - GOG's
  arena2 is in the game folder. The words, the in-page picker's too, and
  the fixtures (Steam's real installdir is "The Elder Scrolls
  Daggerfall").
- **L4-7 (P3):** GOG by Daggerfall's product key, whatever the folder is
  called. **L4-8 (P3):** `reg.exe` by path, read through `reg export`'s
  UTF-16 file (`reg query`'s pipe is the OEM code page). **L4-9 (P3):**
  a whole `ARENA2` beside a partial `arena2`. **L4-10 (P3):** a Mac's
  `/Applications` (this app's own bundle) no longer walked - GOG sells
  Daggerfall for Windows only. **L4-11 (P3):** the in-game choice is
  kept (DA10), and ended by a folder chosen from any door. **L4-12
  (P3):** DFU's older macOS settings folder.

## Tests, docs and the player's eye (lane 5)

- **L5-1 (P1): nothing held the dialogs' answers** - "Not now" wired to
  restart, Escape to Restart, Enter to Leave, or the labels swapped, all
  survived. The questions are data (`app/lib/shellDialogs.cjs`): the
  safe answer is every question's cancel, and on "Leave the game?" its
  default too; the probe records the question actually asked and
  answers by label.
- **L5-2 (P1): the landing page said the portable exe updates itself.**
  It says what each download does.
- **L5-3 (P1): a Mac player was sent to Steam and GOG**, which sell
  Daggerfall for Windows only. The Mac's first run points at
  DaggerfallGameFiles.zip; the page no longer promises Steam or GOG.
  **Round 2:** a Mac's REFUSAL still did (R2-E5).
- **L5-4:** = L2-1. **L5-5 (P2):** a probe scenario with a whole saved
  folder (asked nothing, the news, Play). **L5-6 (P2):** the pick's
  seven-file law pinned (a mutant that took any folder survived).
  **L5-7 (P2):** the mid-session path pinned line by line.
  **L5-8/L5-9:** superseded by DA10 ("What's new" was never "every
  version between": the list is the latest 20 releases).
- **L5-10 (P2): the release script's commands never ran in a test.**
  They are spawned: a set one short exits 1, `latest` prints what the
  publish job reads, an unknown command is a usage error.
- **L5-11 (P2): the REL5 name pin did not model electron-builder** (it
  read `AppImage`; the key is `appImage`, and platform blocks win over
  the top level). It resolves names by electron-builder's own precedence.
- **L5-12 (P2): the Enter key was pinned against one spelling.** The
  focus rule is pinned, and the probe checks Enter plays. **Round 2:** it
  checked the focus, in the one scenario with no card; after the card the
  focus sat on its hidden answer and Enter pressed nothing (R2-E1).
- **L5-13 (P2): detection untested outside Linux Steam/DFU.** Per-platform
  fixtures, the `.reg` parser, links, the Mac's guarded folders.
- **L5-14 (P2): with several folders found, the actions fell off the
  window.** The card scrolls from its top (`justify-content: safe
  center` - plain `center` overflowed both ways), and the bar has one
  height in every state.
- **L5-15 (P2, suspected - no Mac here): the unsigned Mac app would be
  "damaged".** electron-builder 25 signs only with a keychain identity,
  and the bundle it re-plisted kept Electron's now-broken signature. An
  afterPack hook signs it ad hoc and verifies the signature (a broken one
  fails the build); the landing page's Mac advice is Open Anyway.
  **Unverified on hardware**, like every Mac path here.
- **L5-16:** = L4-2. **L5-17 (P2):** one small live region (the stage
  line), a named progress bar with its MB as `aria-valuetext`, text
  written only when it changed. **Round 2:** there were two (the card's
  own) - one now (R2-E4). **L5-18 (P2):** Desktop-App.md's stale
  names and claims restated.
- **L5-19 (P3): the docs overclaimed** ("the whole flow is driven
  headless" - every probe run has the update check off). Said as it is.
  **L5-20 (P3):** probe checks that could pass for the wrong reason
  (the saved-folder card now names what it refused; polls, not sleeps;
  the launcher's own URL awaited). **Round 2:** more could (a launcher
  never shown, both panels laid out, a second game, a check that could
  not fail, reads right after a click) - R2-E9. **L5-21 (P3):** loose pins tightened
  - every colour word checked (not only hex), every HTML sink, one
  bridge, the redraw cache, the link handler, a found folder judged when
  taken. **L5-22:** = DA10's every-pick ingest clear (**Round 2:** held
  in memory, it was lost to a restart - R2-D2). **L5-23 (P3):**
  small text at WCAG AA (#a89f88, 7.2:1; #7d7460 is 4.1-4.4:1 and stays
  on rules and borders). **Round 2:** the NEW badge was 4.26:1; every
  pair is computed now (R2-E3). **L5-24 (P3):** Enter never presses a folder
  just refused; each "Use these files" is named for its folder; "Check
  for Updates Automatically" (it gates the launch check, the news and
  the hourly re-check); the notice says "put it in place of this copy".

## Round 2 (2026-09-29)

Mac: *"Audit this"* - of PR #429 again, after round 1's fixes had landed.
Five fresh lanes read its head (6fbfbea3), each with round 1's record in
hand and told to find where it did not hold: **A** the launcher and the
update lifecycle, **B** security, **C** the release pipeline and its notes,
**D** ARENA2 detection, **E** the tests, the docs and the player's eye.
Each proved by execution: the real `app/main.cjs` under Electron 42 with
the real electron-updater 6.8.9 against a local update server whose
"installer" relaunched the app as the new version (lane A, beside 1.2M
random reducer sequences and a 4424-state reachability search); Electron
probes under xvfb and the live Actions logs (B); the publish job's own
`notes` command in a clone at the release it wrote, and softprops' own
`dist/index.js` against a fake GitHub API (C); a libfuse3 passthrough
share whose every call could be delayed or hung in the kernel (D); 54
mutants - 49 survived the suites as they stood - and the launcher page
in Chromium and in the real Electron window (E).

One P1 in the code (R2-B1, round 1's own fix) and one in the merge
instructions (R2-C6); P2s in lanes B to E, and lane A's all P3. Every
VERIFIED finding was fixed at its root and pinned - in
`test/audit_install2.test.js` (25 tests) or restated beside the slice it
belongs to - with `tools/mutants/auditinstall2.json` (123, all dead: lane
E's surviving mutants among them) and 29 round-1 records re-aimed by
content at the code that replaced theirs. Findings are R2-<lane><n>; where
two lanes found one thing, one number holds it and the other points there.

### Security (lane B)

- **R2-B1 (P1): round 1's L1-5 fix stopped every release.** The stamp
  read the version from the environment as `npm version "$VERSION"` in
  a step with no `shell` - and on windows-latest a `run:` is PowerShell,
  where `$VERSION` is an unset variable (the environment is
  `$env:VERSION`; the live log of main's last release shows that step
  under pwsh). npm got nothing, the Windows leg failed, and the publish
  job, which needs every leg, never ran: no update for anyone, and the
  landing page's REL5 links dead for good. Had npm skipped the empty
  argument instead (a `.cmd` shim), Windows would have shipped as 0.1.0
  and never updated again. The stamp runs in bash, and a law reads every
  workflow as GitHub does: a script that reads a variable names its shell
  wherever a leg can be Windows. `test/updatecheck.test.js` had pinned
  the broken line as right.
- **R2-B4 (P2): softprops/action-gh-release was still a tag that can
  move** - in the one job with `contents: write`, publishing unsigned
  builds the launcher installs before play. Round 1's reason (the SHA
  could not be read) was one public `git ls-remote` from untrue: pinned
  to 3bb12739 (v2.6.2), and every action nobody at GitHub owns is held
  to a 40-hex commit with its version beside it.
- **R2-B2 (P3): the launcher's navigation fence missed `about:blank`**,
  which makes no request, so `will-navigate` never saw it: the launcher
  committed it and went blank (its bridge refused, the IPC gate held).
  A launcher that commits anything outside its origin (`did-navigate`)
  goes home.
- **R2-B3 (P3): the permission CHECK side still granted.** Only requests
  were fenced: `IdleDetector` started and ran after its request was
  refused, and `Notification.permission` read "granted". One predicate,
  `isLauncherPage` (the launcher's contents, or its origin where a check
  comes without them), answers both handlers; every other page keeps
  Electron's defaults, the old synchronous paste still denied.

Both P3s need script already running in the launcher, and lane B found
no way to put it there. Held under attack: the IPC gate (hostile link
names, out of range indexes), `openExternal`'s fixed targets, every other
way it tried to move the launcher (forms, links, meta refresh,
`window.open`, `data:`/`javascript:`/`blob:`, iframes, a dropped URL,
the reload and devtools keys), a hostile `news.json` (text only), the
notes' symlink refusal, hostile tag names; L1-1, L1-3, L1-4.

### The release pipeline and its notes (lane C)

- **R2-C1 (P2): round 1's "only what a change ADDS" dropped new notes -
  on the very range it said it replayed.** It paired a hunk's first
  added lines with its removed ones by POSITION: app-v0.1.4534 deleted a
  "## Notes" section where seven fixes went in, and published three of
  them (the sea at a distance among the four lost, found with the
  publish job's own command at that release). The other way, a restyle
  republished old lines as news. News is decided by what a line SAYS:
  an added line that keeps REWRITE_SHARE (0.6) of its words in one line
  its hunk removed is a rewrite, a line removed word for word anywhere
  in the file has moved, a heading is never news alone. The release is
  replayed from fixtures (the real diff and notes, RETIRED with the
  reader by REL6). Replayed against round 1's rule over all 62 release ranges, the
  four fixes are the one difference. Over the 80 single commits that
  wrote notes ten differ, read line by line: new facts position lost
  (the bed-rest fix, a condensation's one new line, lines that grew),
  the restyle's three old lines no longer republished - and five notes
  reworded, condensed or corrected past REWRITE_SHARE published again
  (none in a release range). Words are all it reads, and it errs on
  that side on purpose: a note told twice over a fix never told.
- **R2-C2 (P3): the draft a failed run left was reused with its OLD
  notes and its OLD commit.** softprops finds a release by tag with an
  API that never returns drafts, creates a second, then keeps the
  lowest-id draft for the tag and deletes the new one (run in its own
  code against a fake API) - so a retry of a tag from a new commit cut
  the tag at the old one. The guard step deletes every draft at the tag
  before staging, the listing an assignment so a failed one fails.
- **R2-C3 (P2 risk): the pipeline has never run** - no dispatch of the
  workflow ever, none on the branch - and its first run is the merge
  that moves the site's links, with a Mac step (the strict verify) that
  stops every platform's release if it fails. **Not done** - see below.
- **R2-C4 (P3): the notes lost files by their names.** Without `-z` git
  quotes a name with an accent, a typographic apostrophe, a tab or a
  quote, and it was dropped; a name with `[` `]` was a pattern that
  pulled in another file's lines; a note opening `++` was taken for the
  header; a link made a file (T) was never read; a UTF-16 file was
  published as NULs. `-z`, `:(literal)` pathspecs, every `+` line inside
  a hunk is content, `AMRT`, and a file holding a NUL or U+FFFD is not
  text.
- **R2-C5 (P3): "the portable exe carries no app-update.yml" was
  untrue** (autoUpdate.cjs, a test, Desktop-App.md) - the published
  exe holds it (both Windows targets pack one `win-unpacked`). Harmless,
  since `portable` is decided first; the claims now say so.
- **R2-C6 (P1 by lane E - it defeated round 1's own P1 step): L3-1's
  seeding named a release two releases old before round 1 was even
  committed** (app-v0.1.4684; 4690 and 4696 were out). Restated there:
  whatever is `latest` at that moment, with no merge in between.
- **R2-C7 (P2 by lane E): the release this PR cuts said only "Fixes and
  improvements."** - the launcher's own debut under an empty NEW entry.
  The Launcher's patch notes, in the player's words.
- **R2-C8 (P3, suspected - no Mac here): a Mac is likely asked for its
  Downloads again after every update.** macOS keys a privacy grant to
  the code's designated requirement, and an ad-hoc signature's is its
  hash, new with every build. **Not done** - see below.

Held: L3-4 (built both ways with electron-builder 25.1.8 - as-is the
file is inside and the manifest beside; with the step, neither), the
REL5 names (a real Linux build), the published-tag guard and the latest
lookup on a 404, the afterPack order, actionlint with shellcheck clean.

### ARENA2 detection (lane D)

- **R2-D1 (P2): round 1's L4-1 did not hold for the SAVED folder** - it
  was judged on the main process before the window, now in three
  blocking reads (L4-5 added one): on a share that was down, no launcher
  at 20 s. And the picked folder's search (L4-4) ran there too: 84 s of
  a frozen window at 20 ms a call. A worker thread was no answer either:
  one stuck in the kernel cannot be terminated, and Electron waited for
  it at quit (20 s after the window closed, until the share answered).
  Every look at the disks - the saved folder, a pick, a found folder
  taken, Try again, the search - now runs in an Electron utility process
  (`app/lib/arena2Probe.cjs`) under a deadline, killed when it has
  answered or has not, and at quit; the launcher's window comes first
  (`checking`: the front door, Play held). `judgeArena2` answers whole,
  missing or unreadable in one listing. On lane D's hung share: the
  launcher up in 0.36 s, "cannot be reached" at the deadline, a quit
  with the probe stuck gone in 0.1 s.
- **R2-D2 (P3; P2 where the two copies differ; lanes A and D): DA10's
  "every pick clears the in-page copy" died with the process** - the
  install DA10 runs right after a pick, or a closed launcher, and the
  old copy shadowed the folder just chosen (F-DA2 again). The clear is
  kept in config.json (`arena2IngestClear`) until it has run to its
  end: measured across a real update restart, 1 stored copy to 0.
- **R2-D3 (P3): picking `steamapps/common` said "It holds no Daggerfall
  files"** - breadth first, the budget went on the other games. The
  walk opens folders named for Daggerfall first (and everything under
  one), and a walk cut short says so, never "no Daggerfall files".
- **R2-D4 (P3): at the deadline a slow drive's find was thrown away and
  the card said to go and get the game.** The search goes on past it
  while the card waits on the player: "Still looking on slower drives",
  a later find added - a Steam drive spinning up, or (suspected, lane D's
  a6) a Mac's privacy prompt answered after five seconds.
- **R2-D5 (P3): L4-2's "only when nothing else was found" was untrue
  for ~/Games** - read after Downloads, Desktop and Documents, three
  prompts for files that were elsewhere. The unguarded roots are read
  first (a stable sort).
- **R2-D6 (P3): "Choose in the game instead" on the SAVED folder's card
  was kept for good** - the folder never named again. There it is this
  launch's alone.
- **R2-D7 (P3; = lane A's A7): a wrong folder picked while the card said
  "Looking" was refused without a word.** Card or box is decided once
  the answer is in.
- **R2-D8 (P3): a found folder whose drive went away said "It holds no
  Daggerfall files".** It says it cannot be read.

Held: the walk's link following (loops, a link to `/`, 5,000
self-links), ARENA2 beside a partial arena2, the `.reg` parser against
realistic exports, GOG's product key, L4-3 and L4-6 to L4-12.

### The launcher and the update lifecycle (lane A)

No P0 to P2. The main paths held end to end in the real library:
install before play, the failed-install guard, the stall watch, Play
without updating, the late notice, closing during Starting.

- **R2-A1 (P3, mechanism VERIFIED, trigger suspected): Restart to
  Update on Linux could close the app and not reopen it.**
  electron-updater starts the new AppImage before the old copy quits; a
  new copy asking for the single-instance lock while the old one still
  held it was refused, and quit (a game page 600 ms slow to unload was
  enough). The lock is released at `before-quit-for-update`: the same
  run reopened.
- **R2-A2 (P3): an hourly re-check that overlapped a slow download was
  taken for it.** electron-updater hands a check made during a download
  the SAME download under a new token that stops nothing - the stall
  watch then cancelled nothing, a failed re-check read as "Could not
  download" while the download finished, and Play was held again at 0%.
  The download is tracked from the check that started it (its token,
  its own promise's end); the re-check waits it out; the global `error`
  event is heard only for an install that failed. Measured: one check,
  Downloading to 100%, Installing.
- **R2-A3** = R2-D2.
- **R2-A4 (P3): the game's "update ready" line went to a page the
  pick's clear-and-reload then replaced.** Told at EVERY load.
- **R2-A5 (P3, the real NsisUpdater): an installer that could not be
  spawned was reported - "stays open on this version" - and the app
  quit anyway**: the spawn error comes before the quit electron-updater
  already queued. That quit is held.
- **R2-A6 (P3): "Check for Updates Automatically" turned on from the
  game's menu never started the hourly check.** It does.
- **R2-A7** = R2-D7.
- **R2-A8 (P3; = lane E's E6): "Installing - closes and reopens by
  itself in a few seconds" while the install waited on the files.** Said
  only once they are set.
- **R2-A9 (P3): a first run that chose its files before Play was told
  "Updated to" a version it never updated from.** Only a config.json
  from before DA10 marks a returning player (`launcherSeen`).
- **R2-A10 (P3; L2-11 did not hold): File > Check for Updates said
  "You're up to date" off a check electron-updater declined to make** -
  it asks GitHub instead, in a box over the window (never behind a
  fullscreen game) - and the transport table knows a Linux copy that is
  not its AppImage (the notice, never "GitHub did not answer").
- **R2-A11 (doc): L2-1's cancel does not stop the download** - 6.8.9
  never wires the token to its request (read in its source; the server
  sent the rest of the file after the "cancel") - and "without a byte"
  is without a PROGRESS EVENT. Said so where it is claimed.

### Tests, docs and the player's eye (lane E)

- **R2-E1 (P2): after the first run's card Enter pressed nothing.** The
  focus sat on the card's answer, hidden but connected and enabled, so
  the focus rule called it the player's; Chromium blurred it after the
  one view that could have moved it. A control in a hidden region is
  idle (`checkVisibility`). Reproduced in real Electron by the probe
  (focus on BODY, no game) and fixed (focus on Play, Enter plays).
- **R2-E2** = R2-C7.
- **R2-E3 (P3): the NEW badge was 4.26:1** (12px #d8cfae on the ruby).
  #e8e0c8 is 5.0:1 - and the suite COMPUTES every small word's contrast
  from launcher.css, rather than listing colours.
- **R2-E4 (P3): two live regions** (the card's own too). One, #status;
  the card is announced by the focus that moves to its answer. The
  double speech itself is unconfirmed (no screen reader here).
- **R2-E5 (P3; L5-3 did not hold): a Mac's REFUSAL still sent it to
  Steam and GOG**, and dropped the zip. It points at
  DaggerfallGameFiles.zip, with its door.
- **R2-E6** = R2-A8. **R2-E7 (P3):** the card scrolls in the brand's
  bar, not the system's white one. **R2-E8 (P3):** nested bullets stay
  nested in the news.
- **R2-E9 (P2; L5-20 did not hold): the probe passed for the wrong
  reasons** - a launcher never shown, both panels laid out (it read the
  attribute), a second game from an event after Play, an "Updated is
  not said" that could not fail, reads right after a click (a 50 ms
  delay in the shell broke two). Each is checked now as the player sees
  it - shown, laid out, one game per Play, a NEW mark that can be
  missing - and polled after a click.
- **R2-E10 (P3): claims about what ran.** The "Chromium with a stubbed
  bridge" in Desktop-App.md was in no one's tree; `test/launcherDom.mjs`
  now runs `launcher.js` over `index.html` in the suite, fed views the
  real state makes. And "What's new", replaced by the news panel, still
  lived in four comments.

**The mutants.** Of lane E's 54, 49 survived: the launcher state's
timings and names (an "Installing" never on screen long enough to read,
a GOG find called Steam), the page's redraws (a button rebuilt between
press and release loses the click - proven), its keyboard and focus
marks, Daggerfall Unity's LocalLow, HKCU, Flatpak Steam, Heroic, one
Windows install offered twice, the notes command never spawned, a tag
pasted into a multi-line `run: |`. 48 are dead now - by execution
wherever the law can run (the page in `test/launcherDom.mjs`, the state,
the detection roots over temp trees, the notes command spawned), by
reading the shell and the workflow where it cannot; E-34 is retired
(R2-D7 holds its law).

### Not done, and why

- **R2-C3 - dispatch the workflow once before merging.** This session's
  GitHub integration was refused (HTTP 403, "Resource not accessible by
  integration"). Mac: Actions > release-desktop > Run workflow, on the
  PR's branch, `release_tag` empty - an artifacts-only run of all three
  legs (the Mac's strict verify among them) that publishes nothing.
- **R2-C8 - a stable Mac signing identity.** It takes a certificate
  (Apple's Developer ID, or a self-signed one kept in the workflow's
  secrets): Mac's call. Until then the Mac's privacy prompts may return
  after each update.
- **The seeding before merge (L3-1, R2-C6)** is Mac's step, on whatever
  release is `latest` at that moment.
- **Unverified on hardware**, as in round 1: every Mac path (the ad-hoc
  signature, Open Anyway, a privacy prompt answered late), a screen
  reader over the one live region, and how long an in-world game takes
  to unload (R2-A1's trigger).
