# The interface

DFO draws its interface two ways. The **classic skin** reproduces Daggerfall's own windows from the player's ARENA2
art on Daggerfall Unity's layouts. **Enhanced Plus** (the default) is DFO's own DOM interface over the same game law,
in one of several color themes or in the DFO Grimoire dress. This page holds how windows, the HUD, text, input and the
brand work across both. The section's other pages hold single systems (see `10-UI/UI.md`).

## How it works

**The skin** (`src/systems/uiSkin.js`). `uiSkin()` answers `enhanced` or `classic`: the URL's `?skin=` for one page
load (never stored), else the stored choice, else enhanced. Every surface asks `isEnhanced()`; nothing compares the
string itself. The player chooses on the Overhauls screen's UI card (`10-UI/Overhauls.md`). The skin is a prefs value,
not a DFU settings key. Online, the skin is the player's; online panels mount on either skin.

**Windows and the stack** (`src/ui/windowStack.js`, a port of DFU's `UserInterfaceManager`). One window is on top and
takes input; a push lays a window over what is open; a pop returns to the one beneath. Each host keeps one overlay
slot as the mirror of the top. Windows open through shared doors (`src/ui/inventoryDoor.js`, `src/ui/charSheetDoor.js`,
`src/ui/pauseDoor.js`, the spellbook, rest, map, talk and trade doors), so every host opens them the same way. Keys go
through one dispatch table (`src/ui/input.js` `routeKey`), DFU's `GameManager.Update` chain, so windows work in the
street, in a building and in a dungeon alike. The four hosts are `src/scenes/world.js`, `src/scenes/exterior.js`,
`src/scenes/worldModes.js` and `src/scenes/dungeonContext.js`.

**Message boxes and notices.** DFU's click-to-close message box is `src/ui/actionText.js` `ActionTextBox` and the
no-option `ChoiceWindow` (`src/ui/talkWindow.js`); boxes are offered through `src/systems/notify.js`'s presenters. On
the enhanced skin such a notice slides in from the right edge as a panel (`src/ui/enhanced/enhancedNotice.js`
`drawEnhancedNotice`, `NOTICE_SLIDE_MS`); a box with buttons, a picker or a text field is a decision and keeps its own
window on both skins. A covered keyed menu takes no pointer (`windowCovered`).

**The classic skin.** Native windows draw DFU's IMG and CIF art on DFU's rects (`src/ui/native/nativePanel.js`, with
native inventory, talk and trade), text through the classic FNT fonts (`src/ui/text.js`), and the classic HUD
(`src/ui/hud/hud.js`, the large HUD `src/ui/hud/hudLarge.js`, active spell icons `src/ui/hud/hudActiveSpells.js`).
Character creation (`src/ui/chargen.js`) follows DFU's wizard order.

**Enhanced Plus.** The front door, the pause window and its tabs (`src/ui/enhanced/enhancedMenu.js`), the
character wizard (`src/ui/enhanced/enhancedChargen.js`), the character sheet, the pack, the talk panel, books, the
spellbook and the level-up (the Ascension, `src/ui/enhanced/enhancedLevelUp.js`) are DOM windows. One kit dresses
them: `src/ui/enhanced/enhancedFrame.js` `FRAME_ROLES` names every surface's role (window, panel, tile, chip, button,
warn, rail and so on), and a theme or dress paints roles, not windows. Themes (`PLUS_THEMES`): Slate (default), Stone,
Iron, Ember, Forest, Night. The front door stands on the pixel night ground (`src/ui/pixelGround.js`). Long lists
draw only the rows on screen (`src/ui/virtualRows.js`). The pause face carries the hourglass (shared timers, in
groups, `src/ui/enhanced/enhancedTimers.js`), the mailbox (developer messages and item grants, with private reports,
`src/ui/enhanced/enhancedPost.js`) and the season laurel (`src/ui/enhanced/enhancedSeason.js`).

**Text.** The enhanced skin's words can be drawn in a face the player picks (`src/ui/textFont.js` `TEXT_FONTS`: Game,
Sans, Monospace, Dyslexic, or their own installed font). Player text follows `10-UI/Voice.md` and
`10-UI/Plain-Words.md`.

**The HUD.** On the enhanced skin the HUD is DOM pieces (`src/ui/enhanced/enhancedHud.js`). Under Enhanced Plus each
piece in `src/ui/hud/hudLayout.js` `HUD_PIECES` (compass, vitals, hotbar, quick slots, status, chat, tracker, party,
notices, loot banners, event board, saddle and helm panels, and more) can be moved, sized or turned off in the HUD
editor (`HUD_EDITOR_KEY`, Alt+U); a piece not standing shows a preview while the editor is open. Every class the HUD
writes is its own, so window sheets never style it. Slots, the hotbar and the status widget are in
`10-UI/Slots-Hotbar-Status.md`.

**Input devices.** Touch (`src/ui/touch/touch.js`): swipe to look, tap to act, on-screen presses, the pixel dial. One
module decides whether the device is touch (`src/ui/touch/touchDevice.js` `isTouchDevice`: a finger as primary pointer,
`?touch=` to force). Gamepads (`src/ui/gamepadInput.js`) press real registry keys; Enhanced Plus has its own pad
layout and cursor (`src/ui/plus/plusPad.js`). Keys are in `10-UI/Controls.md`.

**The brand** (`src/ui/brandMark.js`). The product is **DFO Online**, DFO where a label is short. The logo is the
dragon mark, `src/assets/branding/dfo-online.png`, drawn by the front door, the masthead, the intro film, the landing
page and the desktop launcher from that one file. Every box that draws it keeps its height; the letters sit right of
the file's centre, so a centred mark is drawn back by `BRAND_LOGO_OPTICAL_SHIFT`. The intro film lives in
`src/ui/intro/`.

## Rules

- Enhanced is the default skin (Mac). The URL override never persists.
- The native-window rule (`bible/Home.md`): a window that keeps DFU's layout cites DFU's source for every drawn
  element; a window redesigned on purpose cites its own design page.
- The one construction seam (`bible/Home.md`): a thing two hosts build gets one constructor; hosts call it.
- Notices on the enhanced skin slide in from the right and work for every mod that raises one (Mac).
- The product is DFO Online, DFO where short (Mac). The original game is named only where it must be: the copy a
  player brings, credits and license, the trademark notice, Daggerfall Unity and mods by their own names, DFU's own
  settings text, and the Iliac Bay's places. Elsewhere a player reads "the original game" or "classic". `test/ui/brand.test.js`
  reads the producers (Features rows, Overhaul cards, mod settings and others) so a new line naming the old game fails.
- Keys other systems hold keep their old spelling: the relay's and account service's worker addresses, the D1
  database name, the Patreon key-derivation salt, the repository, the domain, the appId, the userData folder and the
  storage keys.
- The dragon logo replaces the placeholder on the website, the intro and the main menu (Mac).
- The player's choice of words face covers every enhanced surface; the default must be readable without it.

## Daggerfall Unity

DFU's `UserInterfaceManager` window stack, `DaggerfallMessageBox`, `GameManager.Update` dispatch, native windows and
HUD are ported for the classic skin. DFU has no enhanced skin, no notice panel, no HUD editor and no theme kit; those
are DFO's own. DFU shows a message box in the middle of the screen; on Enhanced Plus it is a side panel.

## Code and tests

- `src/systems/uiSkin.js` - the skin choice
- `src/ui/windowStack.js`, `src/ui/input.js` - the stack and the one dispatch
- `src/systems/notify.js`, `src/ui/actionText.js`, `src/ui/enhanced/enhancedNotice.js` - message boxes and notices
- `src/ui/native/nativePanel.js`, `src/ui/text.js` - classic windows and text
- `src/ui/enhanced/enhancedMenu.js`, `src/ui/enhanced/enhancedFrame.js` - Enhanced Plus screens and kit
- `src/ui/hud/hudLayout.js` - HUD pieces and the editor
- `src/ui/brandMark.js` - the brand
- `test/ui/roadb_window_stack.test.js` - the stack
- `test/ui/enhancedNotice.test.js` - the notice panel
- `test/ui/hud/audit39_uicore.test.js`, `test/ui/hud/audit64_hud.test.js` - HUD and native core
- `test/ui/brand.test.js`, `test/ui/intro.test.js` - the brand and the intro's logo
- `test/ui/pad1.test.js`, `test/ui/font3_readable.test.js` - the pad pass and readable type
