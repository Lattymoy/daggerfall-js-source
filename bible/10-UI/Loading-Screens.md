# Loading screens and the screenshot gallery

Under the enhanced skin a loading screen covers the boot and every world move: fast travel, a teleport, Recall, a
respawn, a save loaded in play, a dungeon's door. It names the place being loaded and the step, over one of the
player's own screenshots or the menu's night sky. PrintScreen keeps shots in a gallery the player manages from the
menu's **Screenshots** section. A "Preparing graphics" bar on the boot menus shows shader compiling.

## How it works

**The screen** (`src/ui/loadingScreen.js`) is a full-screen layer at `LOADING_Z` (19): over the world and the death
screen, under the crash banner. HUD pieces that stand higher are hidden while it is seen. It shows the place, the
current step, a bar that runs but claims no percentage, a tip, and a screenshot with where and when it was taken, or
the pixel ground (`src/ui/pixelGround.js`) drawn once per window size.

**Holds.** A caller begins a hold and ends it; the screen stands while any hold is open, since one load can start
inside another. `withLoading` ends a hold however its load ends.
- An in-game hold shows only past `APPEAR_MS` (280 ms); the boot shows at once.
- Once up, it stands at least `MIN_SHOWN_MS` (650 ms), then fades in `LOADING_FADE_MS`.
- Every hold has a ceiling (`HOLD_MAX_MS`, 3 minutes; `BOOT_HOLD_MAX_MS`, 10), so a load that throws cannot trap the
  player.
- The place and step are set fresh by each load's first hold; a word set with no hold open paints nothing.

**Where it is wired.** `src/scenes/world.js` holds the boot (`bootWorld` maps each boot status to a screen line) and
every world move: each frame asks `worldMoveBusy()` and whether a door is mid-build, and `syncLoading` raises or ends
one hold. The destination is named once the teleport starts, never the place being left. A building's door instead
shows a small ring over the hotbar (`src/ui/interiorLoadMark.js`) so the street stays visible; a dungeon door raises
the full screen. A full-screen video or a window takes the screen aside without ending its holds.
`src/scenes/worldModes.js` raises `transitioning` for its doors, which the world frame reads.
`src/scenes/dungeonContext.js` hands loads from other places to the world host.

**The gallery** (`src/systems/shotGallery.js`) keeps every PrintScreen shot in the browser's IndexedDB
(`dagger-shots`): a JPEG at most 1920 px on its long side, a 320 px thumbnail, its place and real time. At most
`GALLERY_MAX` (120): a full gallery refuses the next shot and says so, never dropping the oldest. A database that will
not open falls back to the tab's memory.

**The pane** (`src/ui/shotsPane.js`) lists shots newest first. A tile opens large; its switch takes it out of or back
into the loading screens' turn; Save downloads it; Delete asks once. Add pictures imports PNG, JPEG or WebP files.
Screenshots is on the enhanced door, the classic door and the pause shell.

**The key** (`src/ui/screenshot.js`, PrintScreen, F8 by default) saves the PNG when the `shotDownload` switch is on
(default) and hands it to the gallery with the place read at the press. The read is queued (`oweToFrameFoot`) and paid
at each host's frame foot right after `renderer.resolveFrame()` (`deliverOwedShots`), while the drawing buffer still
holds the frame. A frame held by the frame-rate cap reaches no foot, so the shot waits for the next drawn frame.

**The graphics bar** (`src/ui/gfxPrepBar.js`, raised by `main.js`) fills as the programs started at page load
finish compiling (`src/render/glProgram.js` `startedPrograms`). Full, it says "Graphics ready". A warm cache shows
ready at once; a browser without parallel shader compile shows no bar. It never holds Play. A Chromium tab gets a
**Fix stutter** button that gives the shader cache folders to delete.

## Rules

- Loading screens are the enhanced skin's; shots can be used as loading screens and reached from the menu (Mac).
- Features row `loading-screen` (pref `loadingScreen`): Your screenshots (default), Night sky, Off.
- A tip names no key, since keys are rebindable.
- A screenshot is ARENA2's pixels, so it stays in the player's browser: neither the gallery nor the pane reaches the
  network.
- `?shot` and `?noloading` draw no loading screen.
- No all-black filter on shots: a dark scene is a real picture.

## Daggerfall Unity

DFU has no loading screen; its loads fade through `FadeBehaviour` (ours: `src/ui/fadeLayer.js`). The loading screen
and gallery are DFO's own.

## Code and tests

- `src/ui/loadingScreen.js` - holds, timings, the screen
- `src/systems/shotGallery.js` - the gallery store
- `src/ui/shotsPane.js` - the menu pane
- `src/ui/screenshot.js` - the key and the frame-foot read
- `src/ui/gfxPrepBar.js` - the graphics bar
- `test/ui/load1_loading.test.js` - the screen's laws, gallery and pane
- `test/scenes/shot1_frame_foot.test.js` - every host foot pays owed shots after `resolveFrame`
- `test/ui/gfxprepbar.test.js` - the graphics bar

## Open

- Between the menu's choice and the world host's first line (the data gate and the host's import) the canvas is bare.
- `hudFade`'s black can show before the screen's delay passes on a fast travel.
- The `?exterior` dev host draws no loading screen; its frame does not call `syncLoading`.
