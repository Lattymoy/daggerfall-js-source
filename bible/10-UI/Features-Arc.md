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
| The outdoors sky | Enhanced + Mod Authored | `enhancedEnvironments`, Dynamic Skies `Enabled` | **CONDENSED (FT4, 2026-09-14)** - one three-way row: off, the port's sky, Dynamic Skies' sky (`pixelatedSky` was a third switch until FT3 removed it) |
| Land view distance | Enhanced + DFU Classic | `landViewDistance`, `Experimental/TerrainDistance` | **CONDENSED (FT2, 2026-09-14)** - one row, shows the lane's radius, writes both stores |
| Enemy movement | Enhanced + DFU Classic | `enhancedAI`, `Enhancements/EnhancedCombatAI` | **DECIDED (FT5, 2026-09-14)** - not a merge: the AI row wears Enhanced alone and names DFU's "Smarter Enemies" as a different thing the port does not run; the DFU key stays in Settings, unavailable |
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
| `enhancedAI` | Enhanced AI | off | **MOVED (FT5, 2026-09-14)** - Enhanced; the note names the DFU key it is not |
| `enhancedEnvironments` | Enhanced environments | on | **MOVED (FT4, 2026-09-14)** - condensed with Dynamic Skies' `Enabled` into one three-way row wearing both labels |
| `pixelatedSky` | Pixelated sky | on | **REMOVED (FT3, 2026-09-14, Mac: "Remove our version of pixelated sky")** - the pass, the pref, the row, the doors |
| `landViewDistance` | Land view distance | 5 | **MOVED (FT2, 2026-09-14)** - condensed with `Experimental/TerrainDistance` into one row wearing both labels |
| `grassDensity` | Grass density | 1 | **MOVED (FT7, 2026-09-14)** - Enhanced; the note says it is under the outdoors row |
| `cloudQuality` | Cloud quality | default | **MOVED (FT7, 2026-09-14)** - Enhanced; its tiers pinned as the march table's own keys |
| `enhancedWater` | Enhanced water | on | **MOVED (FT6, 2026-09-14)** - Enhanced; the switch's composition given one home first |
| `enhancedCombatVisuals` | Enhanced combat visuals | on | **MOVED (FT8, 2026-09-14)** - Enhanced; the Settings category it emptied is a pointer now |
| `mwArms` | (no switch - a load/unload button under Morrowind data) | off | open. Needs a real switch on the list |
| `hudScale`, `showFps`, `textScale`, `skin`, `touch*`, `online*` | scattered | - | NOT features. Settings, and they stay in Settings |

### Mod Authored (mod settings, `modSettings.js`) - today on the Mods rail section

| Vendor | Mod | Author | Switches | Status / notes |
|---|---|---|---|---|
| `dynamic-skies` | Dynamic Skies 2.3.4 | BadLuckBurt and carademono | Enabled + 5 | `Enabled` **COVERED (FT4)** by the outdoors row - the Mods pane's row is a pointer; the five knobs open. `MaxParticles` is read and never applied (AUDIT 61, carried as it ships) |
| `seasons-iliac-bay` | Seasons of the Iliac Bay | RosyTheRascal | Enabled | **MOVED (FT9, 2026-09-14)** |
| `roads-hazelnut` | Basic Roads 1.3.1 | Hazelnut | Enabled + 2 | `Enabled` **MOVED (FT9)**; the two knobs stay under its card. BR3 (2026-09-13) had found it had no switch at all |
| `meanerMonsters` | Meaner Monsters 1.5.2 | Ralzar | Enabled | **MOVED (FT9)**. The gate checked: `pcaaoMeanerMonsters.js meanerMonstersOn` reads BOTH switches, as DFU's "is loaded" does |
| `pcaao` | Physical Combat And Armor Overhaul 1.44 | Kirk.O | Enabled + 7 | `Enabled` **MOVED (FT9)**, at once - the registered arms read the switches live; the seven modules stay under its card |
| `unleveledLoot` | Unleveled Loot 1.1.2 | Ralzar | Enabled + 10 | `Enabled` **MOVED (FT9)**; the ten materials stay under its card |
| `windmills-kamer` | Windmills | Kamer | none | **DECIDED (FT9)** - no switch, no row: a row needs a control. Stays vendored, unconditional, credited |
| `raum-book`, `silkscreen-five` | a book, a font | - | none | not features; data. Stay off the list |

### DFU Classic (DFU settings, `settings.js`) - today under Settings > Game

DFU's `Enhancements` and `Experimental` ini sections, plus the two
Video/GUI keys that are features rather than settings.

| Key | Row today | Default | Tier | Status / notes |
|---|---|---|---|---|
| `Experimental/SmallerDungeons` | Smaller Dungeons | False | live | **MOVED (FT1, 2026-09-14)** - DFU Classic. Two seam faults fixed first (below). Building on it is the open door: the day the port adds its own arm, the row wears Enhanced too |
| `Enhancements/EnemyInfighting` | Enemies Fight Each Other | True | live | **MOVED (FT10, 2026-09-14)** - at once |
| `Enhancements/AlternateRandomEnemySelection` | Varied Dungeon Monsters | False | live | **MOVED (FT10)** - the next dungeon |
| `Enhancements/PlayerTorchFromItems` | Torches Light Your Way | False | live | **MOVED (FT10)** - at once; new gear and the next stocking follow |
| `Enhancements/LoiterLimitInHours` | Maximum Wait Time | 3 | live | **DECIDED (FT11)** - a dial, not a feature; stays in Settings |
| `Enhancements/CombatVoices` | - | True | live | **MOVED (FT11, 2026-09-14)** |
| `Enhancements/NearDeathWarning` | - | True | live | **MOVED (FT11)** |
| `Enhancements/BowLeftHandWithSwitching` | - | False | live | **MOVED (FT11)** |
| `Enhancements/DungeonAmbientLightScale` | - | 1.0 | live | **DECIDED (FT11)** - a dial; stays in Settings |
| `Enhancements/NightAmbientLightScale` | - | 1.0 | live | **DECIDED (FT11)** - a dial; stays in Settings |
| `Enhancements/PlayerTorchLightScale` | - | 1.0 | stored | **DECIDED (FT11)** - a dial, and not read; stays in Settings as stored. Its sibling is live |
| `Enhancements/GuildQuestListBox` | - | False | live | **MOVED (FT11)** |
| `Video/RandomDungeonTextures` | Dungeon Wall Style | 0 | live | **MOVED (FT11)** - the one choice row over a DFU key |
| `Experimental/TerrainDistance` | - | 3 | live | **COVERED (FT2, 2026-09-14)** - written by the condensed row, capped at 4; its Video row is a pointer |
| `Enhancements/EnhancedCombatAI` | - | True | UNAVAILABLE | **DECIDED (FT5)** - off the list: a row for a feature the port does not run would be a lie with a switch. Stays in Settings as the unavailable row it is, named from the AI row's note |
| `Enhancements/AdvancedClimbing` | - | False | UNAVAILABLE | open. Ledger A, same shape |
| `Experimental/CustomBooksImport` | - | True | unavailable | open |
| `Enhancements/LypyL_GameConsole`, `LypyL_ModSystem`, `AssetInjection`, `CompressModdedTextures`, `Experimental/AssetCacheThreshold`, `TerrainHeightmapPixelError` | - | - | stored | NOT features. DFU's mod-system and cache plumbing; stay in Settings > Data & Mods |

## Slices

- **FT0** - SHIPPED 2026-09-14. The home, empty. Below.
- **FT1** - SHIPPED 2026-09-14. Smaller Dungeons. Below.
- **FT2** - SHIPPED 2026-09-14. Land view distance, the first condensed row. Below.
- **FT3** - SHIPPED 2026-09-14. The pixelated sky removed. Below.
- **FT4** - SHIPPED 2026-09-14. The outdoors, one row. Below.
- **FT5** - SHIPPED 2026-09-14. Enhanced AI. Below.
- **FT6** - SHIPPED 2026-09-14. Enhanced water. Below.
- **FT7** - SHIPPED 2026-09-14. Grass density and cloud quality. Below.
- **FT8** - SHIPPED 2026-09-14. Combat visuals, and the emptied category as a pointer. Below.
- **FT9** - SHIPPED 2026-09-14. The five packs with a switch. Below.
- **FT10** - SHIPPED 2026-09-14. Three of DFU's dungeon enhancements. Below.
- **FT11** - SHIPPED 2026-09-14. The rest of DFU's switches; the dials stay. Below.
- **FT12** - SHIPPED 2026-09-14. The outdoors test door to the Test Room; the Enhanced category off the rail. Below.
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

## FT4 - THE OUTDOORS, ONE ROW (2026-09-14)

Mac's own condensing example: "our enhanced environments + dynamic
skies". Two switches in two panes decided what the sky is - the
Enhanced category's Enhanced environments (EE1, the whole enhanced
outdoors as one switch) and the Mods pane's Dynamic Skies `Enabled`
(the mod's skybox in place of the port's dome while the outdoors are
enhanced) - and a player reading either could not see the other's hand
in what they were looking at.

**The row.** ONE row wearing Enhanced and Mod Authored, a THREE-WAY
CHOICE (`world/outdoors.js`): Daggerfall's outdoors; the enhanced
outdoors under the port's own sky; under Dynamic Skies' sky. It reads
the two stores the way the host composes them (environments off is off
whatever the mod says; on, the mod's switch picks the sky) and writes
both - OFF leaves the mod's switch as it was, so off-and-on-again gets
the sky the player had. The host's composition (`shared.js` enhancedLane,
dynamicOn) is untouched: the row writes the stores that line reads.
The mod's other knobs - fog density, the pixel snow - are the mod's own
and stay on the Mods page; its `Enabled` row there is a pointer.

**The registry grew** `control.default`: a condensed row's tiers are
its own vocabulary, so it names its default itself, and the law checks
it is a tier (the pref's own value, `true`, is no tier here).

**Not done, by name.** The Enhanced category still holds the AI, the
water, the grass, the clouds and the combat visuals - each its own
slice. `test/ft4_outdoors.test.js`.

## FT5 - ENHANCED AI (2026-09-14)

**The audit.** The row's words (AUDIT 59 F3's) read against the arc:
still true - dungeons only, the doors and the crowd (4b) and the
exteriors and interiors (5) still ahead. The switch's reach (AUDIT 55:
the motor, the dungeon host, the pref, the row) unchanged. One thing
nothing said: the pref shares half a name with DFU's
`Enhancements/EnhancedCombatAI` ("Smarter Enemies" in Settings), a
DIFFERENT feature the port does not run (Ledger A). A player reading
"Enhanced AI" beside an unavailable "Smarter Enemies" could take them
for one thing.

**The row.** Enhanced alone, over the pref, off by default. The note
keeps its claims and gains one sentence: this is the port's own, not
DFU's Smarter Enemies, which the port does not run. The claims are
PINNED AGAINST THE ARC, not remembered: the test reads the arc's
"slices ahead" list and fails the day it stops listing what the note
still calls ahead.

**Decided, not merged.** The condensing candidate "enemy movement" is
two things, one dead. The DFU key stays in Settings as the unavailable
row it is - a row for it on the home would be a lie with a switch. The
readers pin (AUDIT 55) moved its menu reader to the registry.
`test/ft5_enhancedai.test.js`.

## FT6 - ENHANCED WATER (2026-09-14)

**The audit.** WATER1's switch - the enhanced skin, the pref, the
`?water=off` kill door - was composed inline in BOTH exterior hosts,
word for word (`world.js`, `exterior.js`): two copies of one law, the
shape ONE DFU MEMBER, ONE EXPORT exists to stop, on a law of the port's
own. It is `render/waterSurface.js` `waterSwitchOn` now, and both hosts
read it; the town still asks `tilemapRectHasWater` beside it, which is
the town's question, not the switch's. THE FOUR HOSTS, named: the two
exterior hosts read the switch; `worldModes.js` (interiors) and
`dungeonContext.js` have no terrain grid to shade and draw no water,
pinned as knowing nothing of it.

**The row.** Enhanced, over the pref, on by default; the words are
WATER1's. `test/ft6_water.test.js`.

## FT7 - GRASS DENSITY AND CLOUD QUALITY (2026-09-14)

The two quality tiers of the enhanced outdoors (PERF1), taken together
because they are the same shape. **The audit.** Both the port's own
dials; both INERT unless the outdoors row is on - the world host gates
the grass on `enhancedEnvironments`, the clouds ride the enhanced lane
- which neither note said. Both say it now. The cloud tiers are pinned
as the march table's own keys, both ways, so a QUALITY the clouds can be
built at is always a tier and a tier is always a QUALITY. **The rows.**
Enhanced, over their prefs, PERF1's tiers and defaults.
`test/ft7_quality.test.js`.

What is left in the Enhanced category of Settings: the combat visuals,
and the outdoors test door (a test door, not a switch).

## FT8 - COMBAT VISUALS, AND THE EMPTIED CATEGORY (2026-09-14)

ECV1's switch, the last row the Enhanced category of Settings held.
**The row.** Enhanced, over the pref, on by default; ECV1's words; it
takes effect AT ONCE, because every foe host reads `combatVisualsOn`
once per frame - the one row on the home with no reload behind it.
**The category.** Emptied of switches, it stays on the settings rail (a
category that vanished would teach the player its switches vanished)
as a POINTER to the home - one row wearing all three labels, "The
port's own switches", walking to Features from face and control - and
keeps the outdoors test door. Its blurb says so. The pause door's
quick settings draw the same pointer.

The Enhanced category's six switches are all on the home now: the
outdoors (with Dynamic Skies' switch), the AI, the water, the grass,
the clouds, the combat visuals - and land view distance beside them.
Left on the inventory: the Mods pane's packs and Dynamic Skies' five
knobs (Mod Authored), and DFU's own Enhancements (DFU Classic), one
by one. `test/ft8_combatvisuals.test.js`.

## FT9 - THE FIVE PACKS WITH A SWITCH (2026-09-14)

Seasons of the Iliac Bay, Basic Roads, Meaner Monsters, Physical
Combat And Armor Overhaul, Unleveled Loot - one row each, Mod Authored,
over the mod's own `Enabled`. **One source.** A mod's row is built from
`modSettings.js` (`modFeature`): its title with the creator's name in
it (Mac, 2026-09-08), its own modsettings description as the note. The
port adds the one thing the mod cannot say - WHEN the switch lands:
the world's next load (Seasons, Basic Roads), monsters spawned after
(Meaner Monsters; the sentence left its description for the effect
line), at once (the overhaul: its registered arms read the switches
live), the next roll (Unleveled Loot). **The audit.** Meaner Monsters'
"with the overhaul on, Kirk.O's edit takes over" checked against the
gate: `meanerMonstersOn` reads both switches, as DFU's "is loaded"
does. **What stays on the Mods page.** Each mod's other knobs - Basic
Roads' two, the overhaul's seven modules, Unleveled Loot's ten
materials, Dynamic Skies' five - under the mod's card, whose `Enabled`
row is a pointer to the home. **Windmills** has no switch and so no
row: a row needs a control. Pinned both ways: every vendored mod with a
switch has a row, and every mod row names a real switch, so a mod
vendored tomorrow fails the pin rather than sitting off the home.
`test/ft9_mods.test.js`.

Left on the inventory: DFU's own Enhancements (DFU Classic), one by
one, and the mods' knobs if Mac wants them on the home too.

## FT10 - THREE OF DFU'S DUNGEON ENHANCEMENTS (2026-09-14)

Enemies Fight Each Other, Varied Dungeon Monsters, Torches Light Your
Way - the three switches of DFU's Enhancements section that change
what happens in a dungeon. **The audit.** Each read against its port
site: infighting is read at the point of use (`enemyTargets.js`, the
CombatVoices idiom); alternate selection as the dungeon's enemies are
collected (`dungeonEnemies.js`, the 1:1 pick by the player's power
with the variance band); the torch inside the tick as
EnablePlayerTorch.Update reads it, and again for the starting gear and
the shop shelf. All 1:1, all live. **The rows.** DFU Classic, over the
DFU keys, titled as the settings pane titles them so the pointer there
and the row here say one name. Each note ends with what DFU ships it
as, PINNED against the baked default, so a re-bake cannot make the
note lie. The effects are the port's word: at once; the next dungeon;
at once with new gear and the next stocking following.
`test/ft10_dfu_dungeon.test.js`.

## FT11 - THE REST OF DFU'S SWITCHES (2026-09-14)

Combat Voices, Near Death Warning, Bows In Left Hand, Choose Guild
Jobs - the four booleans left in DFU's Enhancements section - and
Dungeon Wall Style, Video's RandomDungeonTextures, the one CHOICE row
over a DFU key: the settings law's own enum (Classic, Climate, Climate
Only, Random, Random Only), which the home draws with the law's own
stepper. Each read against its port site (the voices at the point of
use, the flicker per cycle, the bow hand at the weapon and the item's
hands, the guild list at the offer, the wall style as the dungeon's
table is chosen), each note ending with DFU's own default pinned
against the baked ini. **Decided:** the section's DIALS - the wait
limit, the two ambient light scales, the torch light scale (stored,
not read) - are settings, not features, and stay in Settings; the pin
says so by name. `test/ft11_dfu_rest.test.js`.

THE INVENTORY IS CLOSED. Every row on it is moved, condensed, removed
or decided. The home holds 21 rows: 7 Enhanced, 6 Mod Authored, 10 DFU
Classic, two of them wearing two labels (22 and 8 since LR1 added the
first row BUILT for the home - Loot rarity, below). What remains outside it by
decision: the mods' own knobs under their cards on the Mods page, the
dials in Settings, the two dead DFU keys as the unavailable rows they
are, and the outdoors test door.

**Proved in a browser (2026-09-14).** `tools/featuresProbe.mjs`, against
the dev server with no ARENA2: the home renders every registry row with
its labels, the chip row's counts (21 / 7 / 6 / 10) agree with the rows
each chip filters to, a two-label row shows under both of its chips, a
condensed row's ONE press moves BOTH stores (Land view distance: the
pref to 6, DFU's TerrainDistance to 4), and the Settings pane draws a
moved key as a pointer that walks to the home. 12/12. And
`tools/enhancedMenuProbe.mjs`, which had been stale since SO1 put the
Enhanced category first (its settings step read the Game rows off the
first category, its home-door count was R7's six, its classic block
predated FD1's Begin pane and ONLINE1's rail), re-aimed: the Game
category clicked before its rows are read, the Enhanced-section step
now the home's outdoors row, 29/29.

## FT12 - THE TEST DOOR TO THE TEST ROOM, THE CATEGORY OFF THE RAIL (2026-09-14)

Mac: "Move the test the outdoors to the test room tab and remove the
enhanced tab from settings." The outdoors test door - a season, a
weather, a random town - is a card on the Test Room pane now, with the
other test doors (it is boot-only, as the Test Room is). The Enhanced
category of Settings, emptied by FT2-FT8 and standing as a pointer
since FT8, is off the rail: `settingsMap.js` no longer declares it,
Game leads the rail again, and `portRowsEnhanced`/`featuresPointerRow`
are gone. The category map is seven categories over the 171 keys. The
settings step of the menu probe already clicked Game by name (its
re-aim at FT11); the Features probe checks the rail has no Enhanced
entry. Pins re-aimed: SO1's category count and order, MENU T1's
per-category counts, FT8's pointer pins, R7/SO1's category sweep (it
walks the registry's pref rows now).

## LR1 - LOOT RARITY, THE FIRST ROW BUILT FOR THE HOME (2026-09-14)

Mac: "building on unleveled loot. My goal is to transform things into
a diablo style system with rarity ... Make this the most detailed and
best that it can be." The first Enhanced row that is not a move - a
feature built in house for the home: `loot-rarity`, over the pref
`lootRarity`, off by default (it changes what drops, and DFU's loot is
the 1:1 law), forced on online (OL1). The ladder, the roll, the affixes,
the fold, the identify loop, the skins and the drop chime are one
module (`src/systems/lootRarity.js`) with its own page,
`bible/06-Systems/Loot-Rarity.md`; the record here is the row's.

The row's note says the whole law in the player's words: the ladder
(Magic, Rare, Legendary; Daggerfall's own magic items as Magic, its
artifacts at the top), that affixes are numbers you can read, that the
odds follow the SOURCE and never your level, that a Rare or Legendary
drops unidentified until the Identify spell or the Mages Guild reads
it, and that Off is Daggerfall's loot exactly - items already rolled
keep their tier and names but their affixes rest. `effect`: the next
roll; a worn set follows within a magic round. The home holds 22 rows
now: 8 Enhanced, 6 Mod Authored, 10 DFU Classic. Pins re-aimed: FT0's
id list, FT2's and FT8's counts.

The Test Room gains a door beside the ride: "The loot ladder", one of
everything the ladder can mint in the pack, the switch turned on for
the session. `test/lr1_lootrarity.test.js` (16, after the LR4 audit -
`bible/06-Systems/Loot-Rarity.md`).

## RF4 - ONE FEATURE DECLARATION (2026-09-14)

Mac's refactor pass, the fourth. Adding loot rarity's switch touched
four places: the pref default on the uiPrefs shelf (with a paragraph
of prose), the online lane's forced list, the row here, and the count
pins. The row is the ONE declaration now: a prefs-store control
carries `initial` (the shelf's default) and `online` (the lane's
answer - `true`/`false` forces it, `'player'` leaves it to the player
by name), and the two stores derive theirs (`FEATURE_PREF_DEFAULTS`
spread into PREF_DEFAULTS; `declareOnlinePrefs(FEATURE_PREF_ONLINE)`
at the registry's load). The eight switches' prose (RA1/EE1, the AI,
ECV1, WATER1, LV1, PERF1, LR1) moved from the shelf onto the rows.

THE REGISTRY SITS UNDER THE STORES. To be their source it can import
neither, and it used to import the two lane modules (world/landView.js,
world/outdoors.js) for the condensed rows' tiers and read/write - both
of which import the shelf, a cycle that would have put this file's
constants in the TDZ from one entry point and not another. So a
condensed row names a `lane`, the lane module registers itself
(`registerFeatureLane`) at its own load, and the menu and the checks
read the row through `resolveControl`, which folds the lane in at use;
the menu loads both lanes so a row is never drawn before its lane
stands. The registry's law grew three checks: a prefs row declares
its initial value, its online answer, and a lane it names must be
registered. `test/rf4_featuredecl.test.js` (3); FT0's, FT2's and FT4's
pins re-aimed at the resolved control; the graph proved from three
entry points (the shelf, a lane, the mod store).

Adding a switch is one row now, and the two count pins.
