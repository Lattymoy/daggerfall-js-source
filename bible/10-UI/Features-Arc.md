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
| The outdoors sky | Enhanced + Mod Authored | `enhancedEnvironments`, Dynamic Skies `Enabled` | Mac's example. One sky, two switches in two panes (`pixelatedSky` was the third until FT3 removed it) |
| Land view distance | Enhanced + DFU Classic | `landViewDistance`, `Experimental/TerrainDistance` | **CONDENSED (FT2, 2026-09-14)** - one row, shows the lane's radius, writes both stores |
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
| `pixelatedSky` | Pixelated sky | on | **REMOVED (FT3, 2026-09-14, Mac: "Remove our version of pixelated sky")** - the pass, the pref, the row, the doors |
| `landViewDistance` | Land view distance | 5 | **MOVED (FT2, 2026-09-14)** - condensed with `Experimental/TerrainDistance` into one row wearing both labels |
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
| `Experimental/SmallerDungeons` | Smaller Dungeons | False | live | **MOVED (FT1, 2026-09-14)** - DFU Classic. Two seam faults fixed first (below). Building on it is the open door: the day the port adds its own arm, the row wears Enhanced too |
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
| `Experimental/TerrainDistance` | - | 3 | live | **COVERED (FT2, 2026-09-14)** - written by the condensed row, capped at 4; its Video row is a pointer |
| `Enhancements/EnhancedCombatAI` | - | True | UNAVAILABLE | open. Ledger A: the port runs the classic AI only. Stored True, runs False. Decide: honest row on the list, or off it |
| `Enhancements/AdvancedClimbing` | - | False | UNAVAILABLE | open. Ledger A, same shape |
| `Experimental/CustomBooksImport` | - | True | unavailable | open |
| `Enhancements/LypyL_GameConsole`, `LypyL_ModSystem`, `AssetInjection`, `CompressModdedTextures`, `Experimental/AssetCacheThreshold`, `TerrainHeightmapPixelError` | - | - | stored | NOT features. DFU's mod-system and cache plumbing; stay in Settings > Data & Mods |

## Slices

- **FT0** - SHIPPED 2026-09-14. The home, empty. Below.
- **FT1** - SHIPPED 2026-09-14. Smaller Dungeons. Below.
- **FT2** - SHIPPED 2026-09-14. Land view distance, the first condensed row. Below.
- **FT3** - SHIPPED 2026-09-14. The pixelated sky removed. Below.
- One slice per open row after that, in the order Mac picks.

## FT0 - THE HOME (2026-09-14)

**What shipped.** `Features` on all three rails (boot, classic, pause)
and the pause system rail, beside Mods. `src/systems/features.js` is
the registry: `FEATURES` (empty), the three `KINDS` in `KIND_ORDER`
(Enhanced, Mod Authored, DFU Classic), and its law - `checkFeature`
refuses a row without an id, a title or a kind, with an unknown kind
or store, or whose control names a key its store does not hold (a
typo cannot ship a switch wired to nothing); `checkFeatures` adds a
repeated id and two rows over one switch. `filterFeatures` shows a
two-kind row under both kinds; `featureCounts` counts it under both.

The pane (`enhancedMenu.js` `paneFeatures`): a chip row - All, then
the three kinds, each with its count - over one card of rows. A row
is drawn by the builder its store already has (`prefRow`/`choiceRow`,
`settingRow` compact, `modRow`) and dressed with its kind labels, the
registry's title and note, and its "takes effect" line. `modRow` was
lifted out of `paneMods`, which draws through it still - one row, two
homes, until the row moves. An empty registry says "Nothing here yet"
and where the switches are meanwhile (the rail-hole law).

**Colours.** Three kinds, three of the skin's own tokens: brass
(Enhanced), verdigris (Mod Authored - the live tier's colour already),
bone (DFU Classic). No fourth colour was born.

**What did not move.** Nothing. Settings > Enhanced and Mods keep every
row. The five exact-rail pins (enhancedMenu, settingsUI, uiSkin tests;
the menu probe) were widened by the one word.

**Known at FT0, for FT1+.** A `settings`-store row's main button opens
the settings help sheet (`pickedKey`), which only the Settings pane
draws; the first settings row to move (Smaller Dungeons) decides what
that click does on the home. `test/features.test.js`.

## FT1 - SMALLER DUNGEONS (2026-09-14)

**The audit.** `world/smallerDungeons.js` (AUDIT 28 W4) read again
against MapsFile's four members and its consumers. The 1:1 body stands:
the gate order, the five-block plus, the raw-MapId seed, the border
filter, the two verbatim throws, the quest's frozen state. Three of the
four hosts size the location through `dungeonLocationFor` and the
fourth (`dungeonContext.js`) is handed the sized one; `exterior.js`
passes no `online` because it has no online arm. Two faults at the
seams, both in the dungeon host:

1. **Two enum literals.** The save stamp was `getBool(...) ? 2 : 1` and
   the load warp compared `=== 2`, two copies of
   QuestSmallerDungeonsState beside the module that exports it. ONE DFU
   MEMBER, ONE EXPORT: both are the module's now (`smallerDungeonsStamp`,
   `needsStartWarp`), the host reads neither the setting nor the enum.
2. **The stamp recorded the setting where the build differs from it.**
   DFU stamps the raw setting (SerializablePlayer.cs:224) and warps when
   the setting at load differs (:462-472), which is exact wherever DFU
   can reach. The port builds a size the setting did not choose in two
   places - online every dungeon is full (AUDIT WORLD34 B2), and a
   quest's frozen state overrides the setting - so a save made online
   with the setting on, loaded offline, stood the player in a block the
   plus does not have and never warped. The clone now says it is small
   (`dungeon.smaller`), the stamp is the BUILD, the warp compares the
   saved layout with the built one. A recorded departure: Ledger A,
   THE SMALLER-DUNGEON SAVE STAMP IS THE BUILD. Mac has not been asked
   about this one specifically; it is the slice's "some settings might
   need fixing" and it is a one-line revert if he would rather keep
   DFU's wrong answer.

**The move.** The registry's first row: DFU Classic, over
`Experimental/SmallerDungeons`, with the law in plain words and its
"takes effect" line. The settings pane keeps the key in its category -
the map is total, and a key that vanished from Game would read as a key
that vanished - but draws it as a POINTER (`movedRow`: the labels, the
name, "On the Features page.", a walk to the home from face and control
alike, `goFeatures` knowing both doors' rails). One home per idea: the
switch operates nowhere but the home. On the home a settings switch's
face toggles it (there is no help sheet there to open), as prefRow's
face does.

**Not done, by name.** The standalone dev host `scenes/dungeon.js:102`
still reads the raw location - a probe door, sized by nothing, as the
struck Ledger C row already says. Building on the feature (Mac's
"genuine enhanced feature we can build on") is a design decision, not
taken here: a size tier, a shape other than the plus, or a seed the
player picks would each earn the Enhanced label. `test/ft1_smallerdungeons.test.js`.

## FT2 - LAND VIEW DISTANCE, THE FIRST CONDENSED ROW (2026-09-14)

**The fault.** Two controls for one radius: the Enhanced category's Land
view distance over `uiPrefs.landViewDistance` (LV1, the enhanced lane's
1..6) and Video's Land View Distance over DFU's
`Experimental/TerrainDistance` (D1, the 1:1 lane's 1..4), both named
"Land view distance", in two panes. A player who set one could not see
they had not moved the other, and the world host composed the read
inline at its mount (LV1) - a second copy of "which lane, which store".

**The row.** ONE row wearing Enhanced and DFU Classic (Mac's condensing
rule). It SHOWS the radius the current lane will use - `landViewRead`,
the same function the world host now reads at mount - and its control
WRITES BOTH STORES - `landViewWrite`: the pref whole, DFU's key capped
at its own [Range(1,4)] - so the lanes agree after every press. The
tiers span both lanes, 1..6, because the row must be able to name any
value either lane can hold (an imported settings.ini with
TerrainDistance 2 shows 2 on the classic skin). The registry grew the
words for it: `control.read`/`control.write` (functions, together or
neither) and `control.also` (the other controls the write covers - a
real key of its store, and a covered control is a control, so two rows
cannot own one key). `featureForControl` resolves a covered key to the
row that writes it, so Video's TerrainDistance row is a POINTER to the
home, as is any pane's row over a moved key: `prefRow`, `choiceRow`
and `modRow` all ask the registry first now, the way `settingRow` did
from FT1 - one rule, every store. The Enhanced category's row left with
its copy.

**Not done, by name.** DFU's Video category still lists
`TerrainDistance` (the map is total; the row there is the pointer).
`test/ft2_landview.test.js`.

## FT3 - THE PIXELATED SKY, REMOVED (2026-09-14)

Mac: "Remove our version of pixelated sky". Not a move - a deletion,
root and branch, the way VC1 did it once before and PS1 undid: the
port's retro pass over the sky. What went: ES1e's angular pixel and
26-level ordered posterise over the dome (`RETRO`, `retroFor`, the
`uRetroStep`/`uRetroLevels` uniforms, the snap before the dome and the
posterise after it); ES1f/ES1g's grid as the dome's; PS2's copy of the
same over the volumetric clouds' composite and Dynamic Skies' skybox;
PS1's `pixelatedSky` pref and its row; the `?sky=retro` and
`?sky=smooth` doors; the lab's and the probe's use of them; the
retro-pass pins (ES1e/ES1f/ES1g in `enhancedSky.test.js`, PS1/PS2 in
`macfive.test.js`). The dome is the smooth pass only - its interleaved
gradient dither, the ONE dither it has now.

What stays, by name: Dynamic Skies' OWN colour reduction (REDUCE_COLOR,
the mod's) and PS3's ordered dither over it, which is the port's fix
for the mod's progressing circles and not a pixelation. PS3 read two
of the pass's GLSL functions, so they outlive it: `render/retroPixel.js`
became `render/orderedDither.js` holding `ringSnap` (ES1g's ring grid,
now only naming a world-fixed cell a third of a degree across) and
`bayer4`. The world-fixed dither is still what stops the stipple
crawling when the camera turns.

Records: Ledger rows PS1, PS2, ES1g struck; the ENHANCED SKY row and
the Rendering-Arc ES1e/ES1f headings say REMOVED; the Enhanced-Visuals
arc's three paragraphs carry the note at their heads. AUDIT 39 F53's
star-layer pin keeps its 1/26 visibility bar as the bar it was.
