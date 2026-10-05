# Loading screens and the screenshot gallery (LOAD1, 2026-10-05)

Mac, 2026-10-05: *"We need to add loading screens where needed for the game in an enhanced UI type fashion, maybe make
it where people can also use screenshots for the loading screen and a way to acces them in the menu."*

Before this slice the game's loads had no face. From the menu's choice to the first frame the player looked at a bare
canvas (`#0e1013` behind an unpainted WebGL buffer), the boot's steps named only on the window's title (`main.js`
`status`). In play, a dungeon's door built behind the live exterior and popped in; a fast travel, a guild teleport, a
portal stone, a ship's cabin and the party's journey showed `hudFade`'s black; Recall, a respawn and a save loaded in
play showed nothing at all. DFU has no loading screen either: its loads are `FadeBehaviour` (`ui/fadeLayer.js`). So
this is the port's own (Port-Ledger section A, LOAD1), drawn ONLY under the enhanced skin.

## What shipped

| Piece | File | What it does |
|---|---|---|
| The loading screen | `src/ui/loadingScreen.js` | A full-screen DOM layer (z-index 19: over the world, the base HUD and the death screen's 18, under the crash banner's 20; the HUD pieces that stand higher - the gate's banner, title and damage cards, the siege and arena HUDs, the revenant cards, the pad's prompts - are hidden while it is seen, `body.ld-up`). The place being loaded, large; the skin's rule and gem; the step the load is on; a bar that RUNS but claims no percentage (no load in the port knows its length, and a bar that lies is worse than one that says "working"); behind it one of the player's screenshots with where and when it was taken - or, with none in the turn or on the row's Night sky, the menu's own pixel ground (PX1, `ui/pixelGround.js`), DRAWN ONCE per window size and kept (its drift is CSS), and a tip. |
| The gallery | `src/systems/shotGallery.js` | Every PrintScreen shot kept in this browser's own IndexedDB (`dagger-shots`, store `shots`): a JPEG no longer than 1920 on its long side (quality 0.86) and a thumbnail no longer than 320 on its long side, with its place and the real time it was taken, in the loading screens' turn until the player takes it out. At most 120: a full gallery REFUSES the next shot and says so - it never drops the oldest on its own - and keeps run one at a time, so two presses inside one encode cannot both pass the count. A database that will not open (a private window, blocked site data) falls back to the tab's memory; a connection the browser closes is opened again. |
| The pane | `src/ui/shotsPane.js` | The gallery on the menu: newest first, a tile's picture opens it large (Newer / Older / All screenshots), its switch takes it out of or back into the turn, Save writes the JPEG to the player's files, Delete asks once. Above them: Add pictures (a PNG, JPEG or WebP from the player's own files, dated by the file's own day; every one that cannot be read is said), the key's download switch, and a line saying what the loading screens show now. A new visit forgets the last one's armed Delete and open view; the keyboard stays on the pressed button through every refill (a deleted tile hands it to its neighbour); thumbnails are kept per shot and let go when their shot is. |
| The key | `src/ui/screenshot.js` | KB1's PrintScreen (F8 by default) still saves the PNG, now on the player's `shotDownload` switch (on by default - KB1 as it shipped), and hands the same PNG to the gallery with the place read AT THE PRESS. The HUD says what the gallery answered. The gallery is a dynamic import: this file is on the entry's static graph, which BOOT2 holds at 64 files. |
| The switch | `src/systems/features.js` `loading-screen` | The Features row (Interface, Enhanced): Your screenshots (default - the night sky while the gallery is empty), Night sky, Off. The player's own online. |

## Where it shows - THE FOUR HOSTS

- `scenes/world.js` - **WIRED**, twice.
  - THE BOOT. `bootWorld` begins a hold at its first line, before the realm's join (its first await), and wraps the
    `status` main.js hands it: every step the boot names on the window's title is the screen's line too (`bootLine`
    turns "loading data" into "Reading the game data", "building player pixel ..." into "Raising the land"), and
    `status(null)` - the boot handing the first frame its turn - ends the hold. The start's place is set where the
    boot streams it (unless a save is loading: the load's teleport names the save's place itself).
  - EVERY WORLD MOVE. The frame asks AUDIT 68 S22's one question, `worldMoveBusy()` (`_seasonStraightening` - the
    teleport core's own window - `_traveling`, `_teleporting`, `_recalling`, `_respawning`, `_loading`, the abyss), and a door's build
    (`modes.transitioning`); `syncLoading` raises ONE hold on the first frame
    it is true and ends it on the first it is false. Every mover lowers its flag in a `finally` (the teleport core's
    from its build's wait on; a throw in its synchronous teardown above that is a crash - the banner stands over the
    screen - and the hold's ceiling lets the screen go), so the screen cannot outlive the move. The question is asked
    below the frame's head (AUDIT 39 #160's video wait, AUDIT 28 W7's look tick on the dt) and above the indoor mode's
    return, so every drawn frame asks. The teleport core names its destination before its build is waited on (`_loadingDest`,
    `placeAtPixel`), which the
    frame asks again every frame the hold is open - a load knows where it is going only once its teleport starts, and
    until then the screen names nothing (never the place being LEFT; `loadingPlaceOf`). The abyss wears its own name
    over the pixel it borrows; the party landing's wait is said on the screen, over the chat line that says it. The
    loop that raised the hold being claimed by another (`scenes/shared.js` `claimFrame`) lets it go - no frame of the
    old loop will ever end it.
  - ASIDE, NEVER OVER (AUDIT LOAD1 2, 6). A full-screen video (`holdFrame` - an infection dream can play on a fast
    travel's arrival, the travel's screen still up) and a WINDOW (the frame asks every frame: `townTalk.overlayActive`
    or the mode's own window - a pause, a level-up box; the boot's chargen says so itself, shown mid-boot before any
    frame runs) take the screen aside, its holds untouched. When the last goes mid-load the screen waits for the
    frame's next answer: back if the world is still moving, ending hidden if not - never a flash of the whole screen
    before its fade.
- `scenes/worldModes.js` - **WIRED THROUGH ITS HOST**: its building and dungeon doors (`gatedTransition`,
  `interiorTransition`, `dungeonTransition`, `startInDungeon`, `restoreInterior`) raise `transitioning`, which the world
  frame reads. The module carries no call of its own - its builds are the host's question.
- `scenes/dungeonContext.js` - **NOTHING TO WIRE**: its own quickload restores in place synchronously (no frame passes
  to cover), and a load from another place is handed to world.js's `worldQuickLoad` (`_loading`), which the frame
  covers.
- `scenes/dungeon.js`, `scenes/interior.js` - the `?dungeon`, `?interior`, `?shot` and `?nomenu` dev hosts, not
  among the four: no menu door reaches them (every door ends in `bootWorld`, main.js), and `?shot` draws no screen by
  law.
- `scenes/exterior.js` - **FLAGGED**: the `?exterior` dev host. Its boot and its own modes' doors draw no loading
  screen - no menu door reaches it, and its frame does not ask the question. A slice that makes it a player's route
  wires `syncLoading` into its frame as world.js does.

## The laws, and why

- **HOLDS, NOT A SWITCH.** A load can start inside another (the boot loads a save; a recall lands in a dungeon), so a
  caller begins a hold and ends it, and the screen stands while any is open. `end` is idempotent; `withLoading` ends
  however its load ends.
- **A SHORT LOAD SHOWS NOTHING.** An in-game hold shows its screen only past `APPEAR_MS` (280 ms): a building's door
  that costs a frame does not flash a screen. The boot passes 0 - it is never that short.
- **A SHOWN SCREEN DOES NOT BLINK.** Once up it stands `MIN_SHOWN_MS` (650 ms), then fades in `LOADING_FADE_MS` (240 ms).
- **A SCREEN NEVER SLOWS ITS LOAD** (AUDIT LOAD1 1). The menu redraws its sky every 125 ms, 100 ms a draw at 1080p:
  under a load that is the main thread the load needs. The loading screen draws it once per window size and keeps it.
- **NEVER TRAPS.** Every hold has a ceiling (`HOLD_MAX_MS`, 3 minutes; the boot's `BOOT_HOLD_MAX_MS`, 10): a load that
  throws past its own end lets the screen go there, with a console line naming the hold. The frame's hold that a
  ceiling let go is not raised again while the same move stays stuck. The crash banner stands above the screen.
- **THE SLOT IS EMPTIED BEFORE THE OCCUPANT IS TOLD** (Home, Process): the screen leaves `node` before it fades, so a
  hold begun during the fade builds its own screen rather than reviving a dying one.
- **A WORD SET BETWEEN LOADS NEVER STANDS ON THE NEXT ONE.** The place and the step are set afresh by the first hold of
  a load, and a word set with no hold open paints nothing.
- **EVERY ALLOCATION HAS AN OWNER.** The shot's object URL goes in the screen's teardown (the kept sky is one canvas
  for the session); the pane's thumbnails go when their shot does, and with its gallery listener when the menu
  unmounts (`releaseShotsPane`).
- **A TIP NAMES NO KEY.** Keys are the player's to rebind, so a tip naming a default lies to whoever did; the pane's
  own lines name the player's PrintScreen binding as the Controls page spells it.
- **A RENDER OF GAME DATA IS GAME DATA** (Port-Doctrine). A screenshot is ARENA2's pixels, so it lives where the
  player's ARENA2 lives - their own browser. Neither the gallery nor the pane reaches the network (pinned), and
  nothing here touches the repository.
- **THE PROBES SEE THE WORLD.** `?shot` (the fixed vantage every tool in `tools/` drives) and `?noloading` draw no
  screen.

## The menu

`Screenshots` is on all three rails (the enhanced door, the classic door - the key keeps its shots under either skin -
and the pause shell) and on the pause window's System page, through ONE pane function in both dispatch tables. On the
door's face it is a plaque in the foot beside About (the centre runs under the menu's last rows on a 720-pixel
screen; on a phone the two plaques stack at the right, inside the 132 px PX8 keeps for the foot). The classic skin's
pane says the loading screens are the enhanced UI's.

## Not done, said plainly

- The stretch between the menu's choice and the world host's first line - the data gate (`ensureData`, which must
  stand clear of the first visit's folder picker) and the host's own import (warmed behind the menu, BOOT1) - still
  shows the bare canvas. Covering it is main.js's door, whose block the realm-birth pin executes.
- The save window's own thumbnails (SS1's 320x200 JPEGs) are not in the gallery: they belong to their slots, and a
  loading screen at that size would be a smear.
- A screen does not cover `hudFade`'s smash to black before its delay; a fast travel reads black, then the screen.
- `scenes/exterior.js` is flagged above.

## AUDIT LOAD1 (2026-10-05, three lenses over the commit)

Two dozen findings, no blocker; every one fixed or recorded above. The two majors: the menu's 125 ms sky redraw ran
under every load (now drawn once), and the new character's wizard - shown mid-boot - stood under the boot's screen
while still taking keys, an Escape on its race page reloading to the menu (now the screen steps aside for any window).
The minors: the place left being said (never), the abyss's borrowed name, a film's end flashing the screen back, the
cap raced by two presses, an armed Delete outliving its pane, the keyboard dropped on every refill, a refused database
dead for the tab, unread imports silent, the higher HUD over the screen; and the record's own overclaims (the
`finally`, "from the menu's choice", the thumbnail's width, the counts), corrected here.

Pinned in `test/load1_loading.test.js` (18 tests); every law's mutant is in `tools/mutants/load1.json` - 53, all dead
(`node tools/mutate.mjs tools/mutants/load1.json`).
