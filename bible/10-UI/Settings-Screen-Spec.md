# The Settings screen

One Settings screen holds every option in the game: Daggerfall Unity's settings keys, the Features rows (the port's
own systems and the ported mods), the port's own preference rows, and a few cards. It is the same screen under both
skins, opened from the front door's Settings plaque and the pause window. Tabs are by subject, not by where a value
is stored.

## How it works

**One map of tabs** (`src/ui/settings/settingsMap.js` `CATEGORIES`): Graphics, Gameplay, Combat, World, Interface,
Audio, Controls, Accessibility, Mods & files. Each tab is a title and sections, each section a title and its items in
draw order. An item is a DFU key (`Section/Key`), a Features row (`feat:<id>`), a port row (`port:<id>`), a card
(`card:morrowind`, `card:packs`, ...) or a piece of the screen (`preset:graphics`, `link:overhauls`, `bindings`,
`mods-index`). The map is total and disjoint: every DFU key, Features row and port row stands in exactly one section.
A key a Features row owns stands in that row's section and draws nothing.

**Every option is one row shape**: name, line, control on the right. DFU keys draw as setting rows; a Features row
draws as `featureTile` (name, labels, the note's first sentence, its control, a drawer of parts). A press on a row's
name fills the help pane (`featureCard`: where it lives, its note, when it takes effect, a mod's keys).

**The toolbar**: one search across every tab, its finds under "Tab > Section" heads; filters All, Changed, and the
Features kinds (Enhanced, Mods, Daggerfall Unity); All off and its Restore; and Reset everything to defaults
(`resetEverything`, asked first). A row off its default wears a Changed mark.

**Graphics opens on a quality preset** (`src/systems/graphicsPresets.js`): Low, Medium, High and Ultra over the rows
that cost most (view distance, grass, clouds, ground sharpness, water, real windows) and `PRESET_PARTS`. High is how
the game ships. A press writes each row through its own states (`applyGraphicsPreset`); the bar reads Custom when the
rows match no preset. Render scale is its own choice under Display.

**The help pane with nothing picked** is the tab's card: "N options · M changed" and Restore defaults
(`restoreTabDefaults`, asked), which resets that tab only. The rail counts what each tab draws (`tabCount`).

**Tiers.** Every DFU key has a tier (`src/systems/settings/settings.js` `tierOf`): live, stored or unavailable. Each
tab folds its stored rows under **Saved for later** ("Kept in your settings file, but not used yet.") and its
unavailable rows under **Not available here**, remembered per tab. An unavailable row draws no control; it shows what
the player gets instead (`src/ui/settings/settingsCopy.js` `READOUT`), with full-contrast label.

**The control law** (`src/ui/settings/settingsLaw.js`). `widgetFor(key)` decides each row's control: unavailable is
blocked; then enum, number, color, switch; a number with no stated range is text. Enum names and order are DFU's,
verbatim. `formatValue` speaks every value as a word ("On", "Beautiful", "50%"); a raw ini string is never drawn on a
row, and the raw `[Section] Key` shows only in the detail view.

**Where a switch lives** is read from the map (`optionPath(item)`, "Settings > World > Travel"), so every message
that sends a player to a switch moves with the map.

**The pause window** draws the same screen condensed: the keys that act at once, no tab head, and a closing line that
the main menu holds every option. **On a phone** the help pane is an opaque sheet over the rows.

## Rules

- Settings and features are organized so they are not horrible to scroll; graphics has its own tab (Mac).
- No over-explaining: a tab and a section are their titles; a row is its label and control; the help pane carries
  the rest (Mac).
- The port never invents a range or an option name: enum names are DFU's, and a number with no DFU range is not a
  slider.
- Range equals clamp: a control never offers travel its consumer ignores; the pin reads each consumer's clamp.
- No raw values on a row.
- A setting's message to the player names its path through `optionPath`, never a typed path.
- Reset and Restore defaults are asked before they act.

## Daggerfall Unity

DFU's settings live in `settings.ini` sections and its `DaggerfallAdvancedSettingsWindow` pages; ranges and value
names are read from there (`SettingsManager`). We keep DFU's keys, defaults, names and ranges, and present them by
subject beside the port's own rows. DFU's quick-settings dropdown (`PauseOptionsDropdown`) is not built.

## Code and tests

- `src/ui/settings/settingsMap.js` - tabs, sections, `optionPath`
- `src/ui/settings/settingsLaw.js` - controls, ranges, value words
- `src/ui/settings/settingsCopy.js` - labels, help and readouts
- `src/systems/settings/settings.js` - DFU's keys, defaults and tiers
- `src/systems/graphicsPresets.js` - the quality preset
- `src/ui/enhanced/enhancedMenu.js` - the screen
- `test/systems/org2_options.test.js` - the map total and disjoint, the tabs
- `test/ui/settings/settingsUI.test.js` - the screen's rows and laws
- `tools/featuresProbe.mjs` - each tab's count against its drawn rows in Chromium

## Open

- `src/ui/pauseWindow.js` FLAGGED: DFU's `PauseOptionsDropdown` quick-settings dropdown waits on the settings work.
- `src/ui/enhanced/enhancedMenu.js` FLAGGED: the menu's three-pane screens (rail, list, help) have no arrow-key focus
  order yet; the character wizard alone walks by keys.
