# Tutorials

DFO's own tutorial: a short page pops the first time the player meets a system, a welcome tour runs when a new
character first stands in the world, and every page can be read again from the menu's **Tutorials** section. It
replaces Daggerfall Unity's `_TUTOR__` quest.

## How it works

Three parts:

- **The words** - `src/systems/tutorialCatalogue.js` `TUTORIALS`: 74 pages in thirteen groups (`TUTORIAL_GROUPS`,
  from Getting Started to Playing Online). A page has an id, a title, a `trigger` sentence saying when it pops (or
  `MENU_ONLY`), at most two paragraphs and three points. A key is written `{Action}` and filled with the key the player
  has bound now (`src/ui/tutorialPopup.js` `boundKeyName`), or `[unbound]`.
- **The law** - `src/systems/tutorials.js`. The read list (`tutorialsSeen`) and the popups switch (`tutorialPopups`)
  are prefs, so they belong to the player, not the character. Every seam calls `noteFirstUse(id, { after })`, which is
  cheap and answers at once when the page is read or popups are off.
- **The face** - `src/ui/tutorialPopup.js` (the popup) and `src/ui/tutorialsPane.js` (the menu pane).

**The popup** is a message box offered through `src/systems/notify.js`, so each host's existing presenter shows it on
both skins.
- A page is marked read when it is closed, not when it is raised. A page replaced before it was read goes back to the
  front of the line; one no presenter takes is offered again (`RETRY_MS`, at most `MAX_RETRIES`). A watchdog asks the
  hosts whether a page is still held (`windowHeld`) and re-offers one that vanished.
- A page shows `SHOW_DELAY_MS` after its trigger, over the window that triggered it. A scene change asks
  `SCENE_CHANGE_TUTORIAL_MS`, so the page lands on the far side. One page stands at a time, and pages wait while the
  pause menu or the loading screen is up.
- A page takes no input until it has stood `INPUT_GRACE_MS` and a fresh press comes, so a held key cannot close it
  unread.
- A covered keyed menu takes no pointer and answers nothing (`src/ui/windowStack.js` `windowCovered`), so a page over
  a decision such as a court plea is closed by the click, not the decision.

**The welcome tour** (`startTutorialTour`) is one box of the tour's unread pages (`TUTORIAL_TOUR`: welcome, movement,
using things, the HUD, the menu), each close turning the page. It starts for a new character only, after the start
quest begins, never on a loaded save.

**Seams.** Triggers sit in the shared window doors (pack, sheet, spellbook, rest, maps, talk, trade, boards, arena,
Broker and more), in windows with no door (bank, spell maker, guild services, court, death screen), in systems (first
weapon drawn, hotbar press, gather, torch, mount, wagon, lighthouse, disease, summoning, a rare find, level-up) and in
the hosts' own arms and scene builds. A trigger never sits in a host closure that a test lifts and evaluates; it goes
in the module that closure calls.

**The menu.** The pause window's **Tutorials** tab and the front door's and shell rails' **Tutorials** section draw one
pane (`drawTutorialsPane`): pages on a left rail by group (a gem on an unread page), a search, the chosen page with
Previous and Next, the popups switch, Show all again and Mark all read.

## Rules

- DFO replaces the classic tutorial with its own, pops a page when a new system is first used, has a menu section to
  revisit pages, and never mentions Daggerfall (Mac).
- Pages are plain and short: at most two paragraphs, three points and sixty words (Mac; held by
  `test/ui/tut1_tutorials.test.js`).
- A page that changes how a system plays is changed with it.
- No module the account Worker bundles imports `src/systems/tutorials.js` (`test/server/accountdeploy.test.js`).

## Daggerfall Unity

DFU starts `_TUTOR__` for a new character (`StartGameBehaviour.cs`): a Yes/No prompt and seventeen pages on DFU's own
controls. We do not start it. Its `_no_` task started the curse quest S0000977, so `GAME_START_QUESTS`
(`src/scenes/quest/questBridge.js`) starts that curse and the chosen start quest directly. A save still inside
`_TUTOR__` leaves it at load (`retireDfuTutorial`) and the curse starts unless the save holds it. The vendored quest
file stays, as DFU's data.

## Code and tests

- `src/systems/tutorialCatalogue.js` - the pages, groups and tour
- `src/systems/tutorials.js` - the read list, popups switch and `noteFirstUse`
- `src/ui/tutorialPopup.js` - the popup's line, delays and key names
- `src/ui/tutorialsPane.js` - the menu pane
- `test/ui/tut1_tutorials.test.js` - page limits, and every page that pops has a seam and every seam a page
- `test/ui/professions/fb1018d_crafthowto.test.js` - the Crafting page
- `test/systems/quest/cursesync.test.js` - the curse start

## Open

- No browser probe has driven a popup in the running game; the line, box and seams are tested headless.
