# UI

The interface section: the HUD, the menus and windows, maps, input, text and the brand. The game has two skins: the
classic skin reproduces Daggerfall's own windows from the player's ARENA2 art, and Enhanced Plus (the default) is
DFO's own interface. Everything here lives under `src/ui/`, with the laws it reads in `src/systems/`.

## How it works

Start at `10-UI/UI-Arc.md` for the architecture: the skin choice (`src/systems/uiSkin.js`), the window stack and one
dispatch, message boxes and notices, the classic and enhanced windows, the theme kit, the HUD editor, input devices
and the brand.

The pages, by subject:

- **Screens and menus**
  - `10-UI/UI-Calm.md` - the front door's Online/Offline doors, character creation, readable defaults, the calm HUD
  - `10-UI/Settings-Screen-Spec.md` - the one Settings screen and its tabs
  - `10-UI/Features-Arc.md` - the Features registry every switchable feature is declared in
  - `10-UI/Overhauls.md` - the Texture, Sound and UI looks, GrimoireUI and DFO Grimoire
  - `10-UI/Growth.md` - the Growth tab: level-up, specializations, Firmament, captain's stars, paid resets
  - `10-UI/Collections.md` - every title, aura, icon, glyph and gathered thing, and how each is had
  - `10-UI/Menu-Order.md` - pictures before words in the decorator, the shop counter and the stations
  - `10-UI/Loading-Screens.md` - loading screens, the screenshot gallery, the graphics bar
- **The HUD**
  - `10-UI/Slots-Hotbar-Status.md` - slots, the hotbar, the status widget, armor at a glance
  - `10-UI/Loot-Banner.md` - the banner for a Rare-or-better find, a title or an aura
  - `10-UI/Event-Board.md` - the shared events a player can still reach
- **Maps**
  - `10-UI/Held-Map-Arc.md` - the held parchment and the world sheet
  - `10-UI/Enhanced-Maps-Arc.md` - one window, three sheets: automap, town, world
  - `10-UI/Dungeon-Map-3D.md` - the dungeon map in 3D
- **Input and words**
  - `10-UI/Controls.md` - the keybinding standard and the default keys
  - `10-UI/Tutorials.md` - first-use tutorial pages and the Tutorials menu
  - `10-UI/Voice.md` - how DFO's own text is written
  - `10-UI/Plain-Words.md` - every system explains itself, plainly

## Rules

- The classic skin keeps Daggerfall Unity's own windows; a window that keeps DFU's layout cites DFU's source for each
  drawn element (`bible/Home.md`, the native-window rule).
- A surface asks `isEnhanced()`; it never compares the skin's string.
- Player text holds to PLAIN-TEXT (`test/tooling/plaintext.test.js`) and the voice rules (`10-UI/Voice.md`).

## Code and tests

- `src/systems/uiSkin.js` - the skin
- `src/ui/enhanced/enhancedMenu.js` - the front door, pause window and Settings screen
- `src/ui/hud/hud.js` - the HUD every host draws
- `test/ui/` - the interface's tests, one folder per area
