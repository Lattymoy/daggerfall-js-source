# Features

The Features registry declares every switchable, enhanceable feature in one place: the port's own systems, the ported
mods and Daggerfall Unity's optional features. Each feature is one row on the Settings screen
(`10-UI/Settings-Screen-Spec.md`), placed in the tab and section about what it changes. A row wears one or more labels
saying where it began: **Enhanced**, **Mod Authored** or **Classic Option** (`KINDS`). No label names an author.

## How it works

**The registry** (`src/systems/features.js` `FEATURES`). A row has an id, a `group` (what it changes: `GROUP_ORDER`
is sight, interface, sound, world, loot, combat, character), `kinds` (who made it, `KIND_ORDER`), a title, a note, an
effect line (when it takes effect), and a `control`. A control names its store (`STORES`: prefs, settings, mods) and
key, and for a prefs row its `initial` value and its `online` answer (`true` or `false` forces it in the shared
world; `'player'` leaves it to the player). A control may carry `tiers` (a choice of more than two), `also` and
`parts` (extra keys drawn as chips in the row's drawer), and `classic` (the value that is Daggerfall's own).

**One declaration.** The prefs shelf's defaults (`FEATURE_PREF_DEFAULTS`, spread into `PREF_DEFAULTS` in
`src/systems/uiPrefs.js`) and the online lane's forced list (`declareOnlinePrefs(FEATURE_PREF_ONLINE)`) derive from the
rows, so adding a switch is one row.

**Condensed rows.** A row that governs one thing from two origins wears both labels and drives both stores, for
example land view distance (the port's radius and DFU's `Experimental/TerrainDistance`) or the outdoors (off, the port's
sky, Dynamic Skies). Such a row names a `lane`; the lane module registers itself (`registerFeatureLane`,
`src/systems/featureLanes.js`) and the menu reads it through `resolveControl`, so the registry imports no store.

**A mod's row** comes from `src/systems/modSettings.js`: its switch, the mod's name alone as its title (CREDITS-OUT, the
owner), and its description as the note. Its `Modules.` keys show as chips (derived, so a new module needs no edit) and
a curated set of dials (`MOD_CURATED`); other keys keep the mod's shipped values.

**Every control is a bar**, Off its first segment, so a two-state and a five-state control look alike
(`tileStates` answers the segments for every store). Online, a row the room decides is locked and says so.

**All off, Restore and Reset.** All off (asked first) moves every switch to Off, and a row with no Off to its `classic`
value; a choice with neither stays. What each row was is kept (`featuresRestore`) so Restore puts it back. Reset
everything to defaults returns every row, its parts and a mod's modules to how the game ships (`defaultSegment`); online
it leaves rows the room decides.

**Search** (`featureSearchText`, `matchesFeatureQuery`) finds every word, in any order, in the title, note, labels,
parts or a mod's title and key, with accents folded.

## Rules

- One home for every enhanceable feature: mods, setting toggles and enhanced toggles together; smaller dungeons is a
  genuine enhanced feature, not a hidden setting (Mac).
- A row wears one or more of the three labels, and a filter shows all or one kind (Mac).
- A row that condenses switches from two origins wears both labels (Mac).
- Nothing moves in bulk: each row is read against its source and consumers before it is placed.
- The stores stay separate; the row is the presentation.
- A mod's title carries its creator's name (Mac).
- Features rows live on the Settings screen's tabs; there is no separate Features door (Mac).
- Reset everything to defaults exists so a player can return to stock values (issue #399).

## Daggerfall Unity

DFU's optional features are its own settings keys (`settings.ini`); its mods are configured through their
`modsettings.json`. We keep both stores and their defaults and present each under one row beside the port's own. A
mod's description is our own words (`10-UI/Plain-Words.md`).

## Code and tests

- `src/systems/features.js` - the registry, kinds, groups and search
- `src/systems/featureLanes.js` - lanes for condensed rows
- `src/systems/modSettings.js` - the mods' rows and settings
- `src/ui/enhanced/enhancedMenu.js` - `featureTile`, `featureCard`, All off, Restore, Reset
- `test/systems/features.test.js` - the registry's law and placement
- `test/systems/rf4_featuredecl.test.js` - one declaration, lanes registered
- `test/systems/ft18_features.test.js` - All off, Restore, search and Reset to defaults
- `tools/featuresProbe.mjs`, `tools/featureRailProbe.mjs` - every row drawn once, every help pane read, in Chromium
