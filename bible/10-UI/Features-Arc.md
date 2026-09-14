# Features Arc - one home for every enhanceable feature

Mac, 2026-09-13: "merging mods, certain setting toggles and enhanced
pane toggles into one universal place to toggle enhanceable features
... smaller dungeons should be a genuine enhanced feature that we can
build on instead of being hidden in the settings menu ... go one by
one, ensure proper detail and development and then organize everything
under one roof." Decided the same day: ONE home on the menu rail - ONE LIST, not
tabs (Mac, 2026-09-14): every row wears one OR MORE of three
colour-coded labels (Mac, 2026-09-14: a row that condenses switches
from two origins wears both), and a filter row at the top shows all of them or
one kind:

- **Enhanced** - built in house (the port's own departures).
- **Mod Authored** - the mods ported 1:1 so far, under their authors' names.
- **DFU Classic** - Daggerfall Unity's own optional features.

The law of the work: NOTHING MOVES IN BULK. Each row below is its own
slice - read against its source, its consumers and its neighbours
(duplicates, dead switches, wrong defaults), fixed where wrong, THEN
moved. A row moves when its slice closes, not before.

## Condensing: one row, two labels

Switches that govern one thing from two origins condense into ONE
row wearing both labels. The stores behind them stay separate; the
row is the presentation, and the slice that condenses it decides how
the one switch drives the two keys. Candidates already visible:

| Row | Labels | Today's switches | Note |
|---|---|---|---|
| The outdoors sky | Enhanced + Mod Authored | `enhancedEnvironments`, Dynamic Skies `Enabled`, `pixelatedSky` | Mac's example. One sky, three switches in two panes |
| Land view distance | Enhanced + DFU Classic | `landViewDistance`, `Experimental/TerrainDistance` | two controls for one radius, read side by side |
| Enemy movement | Enhanced + DFU Classic | `enhancedAI`, `Enhancements/EnhancedCombatAI` | NOT a merge - different things, one dead. The slice decides what the row says |
| Monster stats | Mod Authored x2 | Meaner Monsters `Enabled`, PCAAO `Enabled` | the meaner numbers change under the overhaul; one row may explain both |

## The stores stay (what "one roof" does not mean)

Three stores back these rows and all three stay where they are:

| Store | File | Why it cannot merge |
|---|---|---|
| DFU settings | `src/systems/settings.js` | DFU's ini, pinned at exactly 171 keys (`test/settings.test.js`); `SmallerDungeons` is stamped into quest saves through it |
| Port prefs | `src/systems/uiPrefs.js` | the port's own shelf, kept OUT of DFU's file on purpose |
| Mod settings | `src/systems/modSettings.js` | each mod's own modsettings, keyed by vendor folder |

The roof is the PRESENTATION: one declared registry that says, per
feature, its tab, its store and key, its classic side and when it
takes effect. The list renders from the registry; the labels and the filter come from its kind. The settings pane's
`enhanced` category (empty in `settingsMap.js`; its rows are hand-built
in `enhancedMenu.js` `portRowsEnhanced`) and the `Mods` rail section
(`paneMods`) are what the home replaces, one row at a time.

## The inventory (2026-09-13, before any slice)

Status: `open` = not yet audited. A row's slice closes it with the
finding and the move.

### Enhanced (port prefs, `uiPrefs.js`) - today on Settings > Enhanced

| Key | Row today | Default | Status / notes |
|---|---|---|---|
| `enhancedAI` | Enhanced AI | off | open. NAME COLLIDES with DFU's `Enhancements/EnhancedCombatAI` (below), which is a different thing and unavailable |
| `enhancedEnvironments` | Enhanced environments | on | open. One switch over sky, ground, clouds, grass, weather; overlaps Dynamic Skies' `Enabled` and its pixel snow |
| `pixelatedSky` | Pixelated sky | on | open |
| `landViewDistance` | Land view distance | 5 | open. DUPLICATE SUSPECT: DFU's `Experimental/TerrainDistance` is LIVE and read beside it in `scenes/world.js:547-550` - two view-distance controls in two panes |
| `grassDensity` | Grass density | 1 | open |
| `cloudQuality` | Cloud quality | default | open |
| `enhancedWater` | Enhanced water | on | open |
| `enhancedCombatVisuals` | Enhanced combat visuals | on | open |
| `mwArms` | (no switch - a load/unload button under Morrowind data) | off | open. Needs a real switch on the list |
| `hudScale`, `showFps`, `textScale`, `skin`, `touch*`, `online*` | scattered | - | NOT features. Settings, and they stay in Settings |

### Mod Authored (mod settings, `modSettings.js`) - today on the Mods rail section

| Vendor | Mod | Author | Switches | Status / notes |
|---|---|---|---|---|
| `dynamic-skies` | Dynamic Skies 2.3.4 | BadLuckBurt and carademono | Enabled + 5 | open. `MaxParticles` is read and never applied (AUDIT 61, carried as it ships) |
| `seasons-iliac-bay` | Seasons of the Iliac Bay | RosyTheRascal | Enabled | open |
| `roads-hazelnut` | Basic Roads 1.3.1 | Hazelnut | Enabled + 2 | open. BR3 (today) found it had no switch at all until this morning |
| `meanerMonsters` | Meaner Monsters 1.5.2 | Ralzar | Enabled | open. Its text says "with the combat overhaul on, Kirk.O's edit takes over" - check that gate against PCAAO's own switch |
| `pcaao` | Physical Combat And Armor Overhaul 1.44 | Kirk.O | Enabled + 7 | open |
| `unleveledLoot` | Unleveled Loot 1.1.2 | Ralzar | Enabled + 10 | open |
| `windmills-kamer` | Windmills | Kamer | none | open. Vendored with permission, no switch - decide whether it gets one |
| `raum-book`, `silkscreen-five` | a book, a font | - | none | not features; data. Stay off the list |

### DFU Classic (DFU settings, `settings.js`) - today under Settings > Game

DFU's `Enhancements` and `Experimental` ini sections, plus the two
Video/GUI keys that are features rather than settings.

| Key | Row today | Default | Tier | Status / notes |
|---|---|---|---|---|
| `Experimental/SmallerDungeons` | Smaller Dungeons | False | live | open. **Mac: the first one.** AUDIT 28 W4 ported it 1:1; the slice designs what building on it means, then it moves |
| `Enhancements/EnemyInfighting` | Enemies Fight Each Other | True | live | open |
| `Enhancements/AlternateRandomEnemySelection` | Varied Dungeon Monsters | False | live | open |
| `Enhancements/PlayerTorchFromItems` | Torches Light Your Way | False | live | open |
| `Enhancements/LoiterLimitInHours` | Maximum Wait Time | 3 | live | open |
| `Enhancements/CombatVoices` | - | True | live | open |
| `Enhancements/NearDeathWarning` | - | True | live | open |
| `Enhancements/BowLeftHandWithSwitching` | - | False | live | open |
| `Enhancements/DungeonAmbientLightScale` | - | 1.0 | live | open |
| `Enhancements/NightAmbientLightScale` | - | 1.0 | live | open |
| `Enhancements/PlayerTorchLightScale` | - | 1.0 | stored | open. Its sibling is live; this one is not read |
| `Enhancements/GuildQuestListBox` | - | False | live | open |
| `Video/RandomDungeonTextures` | Dungeon Wall Style | - | live | open |
| `Experimental/TerrainDistance` | - | 3 | live | open. See `landViewDistance` |
| `Enhancements/EnhancedCombatAI` | - | True | UNAVAILABLE | open. Ledger A: the port runs the classic AI only. Stored True, runs False. Decide: honest row on the list, or off it |
| `Enhancements/AdvancedClimbing` | - | False | UNAVAILABLE | open. Ledger A, same shape |
| `Experimental/CustomBooksImport` | - | True | unavailable | open |
| `Enhancements/LypyL_GameConsole`, `LypyL_ModSystem`, `AssetInjection`, `CompressModdedTextures`, `Experimental/AssetCacheThreshold`, `TerrainHeightmapPixelError` | - | - | stored | NOT features. DFU's mod-system and cache plumbing; stay in Settings > Data & Mods |

## Slices

- **FT0** - the home: the rail section, the one list with its three labels and the filter row, the registry and its pins. An empty list is allowed (the rail-hole law: a section with no engine still has a home). Not started.
- **FT1** - Smaller Dungeons. Not started.
- One slice per open row after that, in the order Mac picks.
