# Own Work (OWN-WORK, 2026-10-31)

The owner, 2026-10-31: "begin work on removing mods from outside authors and instead replacing them with our own
work". Asked what "Bethesda assets implemented into our codebase" meant: "Sorry I meant ensuring they are not
implemented". Asked how to begin: "Inventory, then code-only". Asked about Kamer and Kab's work: "Counts as ours -
keep".

The arc has two goals. First, no Bethesda data ships in the tree (NO-BETHESDA, below). Second, no outside author's
file ships in the tree: each feature that came from a mod becomes DFO's own code, art, sound, data and words. The
second goal is done in waves. Each wave builds our own replacement, then retires the vendored directory the way
OWN-WORK1 did (section "How a directory is retired").

## What the arc does not cover

- **Kamer and Kab's work stays** (the owner: "Counts as ours - keep"): `world-of-daggerfall`, `windmills-kamer`,
  `daggerfall-arena`, `world-events-raiding-parties`, `warm-ashes-ships`, `low-poly-trees` and
  `daggerfall-enemy-expansion`. They made work for this project.
- **DFO's and Mac's own work**: `project-legacy`, `raum-book`, `pixelify-glyphs` and `layered-armor`.
- **Daggerfall Unity's MIT data**: `dfu-books`, `dfu-icons`, `dfu-cursor`, `dfu-quests`, `dfu-settings` and
  `dfu-text`. DFU is the reference (Port-Doctrine's Scope). NO-BETHESDA found Bethesda's own words inside two of
  them, below.
- **Licensed pieces**: `silkscreen-five` (one glyph, SIL OFL 1.1) and `vorbis-fsb-setups` (two codec headers, ISC
  and BSD-3-Clause). Their licences travel with them.

## NO-BETHESDA: what the scan found

`tools/bethesdaScan.mjs` reads every tracked file against the freeware ARENA2 (`sh tools/fetch-data.sh`). It checks
each file's sha256 against every ARENA2 file and BSA record, and looks for any run of 64 bytes or more of ARENA2
inside a file. It also sets every PNG against every TEXTURE, IMG and CIF/RCI frame in ART_PAL and PAL.PAL: an exact
copy at 1x to 4x, mirrored or not, or a near one (a repaint whose light follows the record's).
`test/tooling/nobethesda.test.js` pins each measure on made-up data and scans the tree's bytes when `ARENA2_PATH` is
set. A second measure counted, per picture, the drawn pixels that are exactly a classic record's.

The run of 2026-10-31 read 48,300 tracked files against 1,590 ARENA2 files.

- **No ARENA2 file and no BSA record is in the tree.** The site and the desktop app read the player's own ARENA2
  (`scenes/dataSource.js`, `app/lib/arena2Detect.cjs`). `vite.config.js` serves `/arena2` to the dev server alone.
- **Copies of Daggerfall's pictures, outside every exception.** Five mods carried them as their own art.
  NO-BETHESDA2 took them out (below).
- **Approved and expected.** The four exceptions' directories are Daggerfall's art repainted, as Port-Doctrine says,
  and their indexed PNGs carry Daggerfall's palette in their `PLTE` chunk.

### NO-BETHESDA2: the copies, rebuilt from the player's files

A picture whose drawn pixels are 60% or more a classic record's, exactly, is not carried (DEX0's law, Port-Doctrine's
fourth exception). `tools/classicDerive.mjs` writes it as a spec: the TEXTURE, CIF or RCI record, its palette (most are
PAL.PAL, not the pipeline's ART_PAL), its offset and the author's changed pixels. `formats/classicPictures.js`
builds it from the player's own file at runtime, through `systems/classicArt.js`. Every spec rebuilds its old PNG
byte for byte. `test/tooling/doctrine.test.js` holds each folder: a picture is a file or a spec, never both.

| mod | rebuilt | still carried, the author's own | listing |
|---|---|---|---|
| Eye of the Beholder | 2,869 sprites (TEXTURE.096, .264, .269, .475-.495) | 166 | `vendor/eye-of-the-beholder/derived.json` |
| Handheld Torches | 22 candle frames (TEXTURE.210 records 3 and 4) | 17 | `vendor/handheld-torches/derived.json` |
| Climates & Calories | 4 (two spoiled faces, the tent's canvas and pole) | 14 | `vendor/climates-calories/derived.json` |
| Roleplay & Realism | 2 keeper sprites, 17 BUTTONS.RCI buttons | 5 | `vendor/roleplay-realism/derived-art.json` |
| Roleplay & Realism: Items | 46 helmet masks, 4 Dwarven helmets | 230 | `vendor/roleplay-realism-items/derived-art.json` |

A player without ARENA2 stored sees these pictures as a failed load, as any missing file. A texture-door entry is
built once a world pipeline is up.

The scan after NO-BETHESDA2 read 45,248 tracked files. Outside the exceptions it found only Diverse Weapons' magic
daggers, the rotten cooked fish, and DFU's quest and TEXT.RSC text.

### NO-BETHESDA3: the daggers and the fish (the owner: "Rebuild DW's 7 daggers", "Also rebuild the rotten fish ourself")

Twelve Diverse Weapons sprites are 60% or more Daggerfall's own hand (WEAPON02.CIF, 62.7% to 84.5%), and the scan's
seven are among them. They are rebuilt like the rest, the author's blades kept as edits
(`vendor/diverse-weapons/derived-art.json`, loaded on first use); 12,612 stay as files. 687 more draw 10% or more of
a CIF frame, under the law's line. The rotten cooked fish was the author's re-shade of TEXTURE.211 record 10: it is
gone, and in its place is our own rot (`systems/survival/rotPicture.js`), drawn at runtime over the player's own
cooked fish.

### Open: the owner's call


- **Bethesda's words in Daggerfall Unity's MIT data.** `vendor/dfu-quests` carries DFU's 265 quest scripts, whose
  messages are Daggerfall's quest text (eight runs of 68 to 77 bytes match the QRC files byte for byte). Its
  `dfu-text/Internal_RSC.csv` is TEXT.RSC's strings (954 bytes matched, runs up to 161). The owner chose our own
  words over reading ARENA2: "We plan on moving away from arena so whatever works for future proofing". OWN-WORDS1
  and OWN-WORDS2 rewrote all 264 quests with messages, and the build no longer bundles DFU's quest text
  (`06-Systems/Own-Words.md`). Internal_RSC's 1,448 rows remain, counted by `tools/bethesdaWordsBaseline.json`,
  which only goes down.
- **The rest of Diverse Weapons' hands.** 687 sprites draw between 10% and 60% of a classic WEAPON CIF frame
  exactly, under NO-BETHESDA2's line. Wave 3 replaces the mod's art.
- **The exceptions themselves.** Vanilla Enhanced, Sands of the Alik'r, Snowfall and the class skins are outside
  authors' repaints of Daggerfall's art. Layered Gearing and Enemy Expansion's repaints stay (ours, and Kamer and
  Kab's). Wave 3 can replace the four with our own art.
- **What the scan cannot see.** Audio beyond raw 8-bit runs (DAGGER.SND, MIDI.BSA). Morrowind's data, which is not
  freeware and not here, so Weapon Sheathing's meshes are unchecked. Three PNGs it cannot decode (a 4-bit Vanilla
  Enhanced tile and two greyscale skin maps of ours).

## The inventory

Forty directories under `vendor/` held an outside author's work on 2026-10-31. OWN-WORK1 retired twelve of them and
OWN-WORK2 four more (the next section). The 24 left are below, sorted by what replacing them needs. "Runtime" means the game loads the
files, so a replacement has to exist before the directory can go. The registry (`Mod-Registry.md`) keeps each one's
provenance until it is retired.

| vendor | author | what the tree carries | runtime | kind | wave |
|---|---|---|---|---|---|
| `beautiful-villages` | carademono | one world-data pack, 7,317 locations and 209 blocks | yes | world data | 2 |
| `beautiful-cities` | carademono | one world-data pack, 410 cities and 611 blocks | yes | world data | 2 |
| `climates-calories` | Ralzar | item templates, 13 item icons (the rules are already an overhaul) | yes | data, art | 2 |
| `foraging` | Harbinger451 | 12 item templates, 22 quests, 7 textures, the assembly and its IL | yes | data, words, art | 2 |
| `travel-options` | Hazelnut | the string table, settings, 3 UI textures | yes | words, art | 2 |
| `roleplay-realism` | Hazelnut | quests, world data, 7 scripts, 5 sprites | yes | mixed | 2 |
| `roleplay-realism-items` | Hazelnut and Ralzar | item templates, string table, 15 scripts, 230 sprites | yes | mixed | 2 |
| `iliac-puddle-no-more` | jet082 | 7 fish templates, 7 fish pictures, the assembly (the coastline bake is already ours) | yes | data, art | 2 |
| `diverse-weapons` | RealAKP | 12,612 weapon sprites (59 MB under `public/art/`), the script | yes | art | 3 |
| `grimoire-ui` | LordSquacquerone | 93 screens, 38 buttons and 2 fonts (23 MB under `public/art/`) | yes | art | 3 |
| `eye-of-the-beholder` | RedRoryOTheGlen | 166 sprites, the assembly's IL | yes | art | 3 |
| `shield-widget` | RedRoryOTheGlen | 600 shield textures, presets | yes | art | 3 |
| `handheld-torches` | RedRoryOTheGlen | 17 torch textures | yes | art | 3 |
| `horse-cart-and-cargo` | demifiend000 | 45 horse pictures, two assemblies and their IL, the text table | yes | art, words | 3 |
| `dynamic-skies` | BadLuckBurt and carademono | sky presets, 19 textures, shaders | yes | art | 3 |
| `come-sail-away` | RedRoryOTheGlen | 12 boats as data, pictures, 5 clips, the assembly | yes | art, sound | 3 |
| `weapon-sheathing` | Greatness7 and others | 71 scabbard meshes and 3 skeleton add-ons (a Morrowind mod) | yes | art | 3 |
| `windfall` | demifiend000 | 27 clips, 3 pictures, shaders, the assembly and its IL | yes | art, sound | 3 |
| `better-ambience` | joshcamas | 29 WAV clips, 16 scripts | yes | sound | 3 |
| `immersive-footsteps` | Kirk.O | 210 MP3 clips, 2 scripts | yes | sound | 3 |
| `vanilla-enhanced` | carademono | 1,415 repainted Daggerfall textures (Port-Doctrine's first exception) | yes | art, Bethesda-derived | 3 |
| `sands-of-the-alikr` | unknown | 47 repainted TEXTURE.002 records (the second exception) | yes | art, Bethesda-derived | 3 |
| `snowfall` | demifiend000 | 168 repainted winter textures (the second exception), the assembly and its IL | yes | art, Bethesda-derived | 3 |
| `class-skins` | not named for the pack | 1,683 repainted class sprites (the fourth exception) | yes | art, Bethesda-derived | 3 |

Wave 2 replaces data, tables and words: our own text, our own tables and our own world edits. Wave 3 replaces art
and sound, and it is the largest. The four packs marked Bethesda-derived serve both of the arc's goals: our own
art in their place also takes Bethesda's silhouettes out of the tree.

## Retired from vendor/

Each row is the record a vendored directory's README and registry row held. The last cell names a commit whose tree
still carries the files.

| vendor | mod | author | licence or permission | what the tree carried | our code, now the record | retired |
|---|---|---|---|---|---|---|
| `pcaao` | Physical Combat And Armor Overhaul 1.44 | Kirk.O | repository states none; granted (Mac handed the bundle over 2026-09-12) - **RECORD OPEN** | manifest, settings (7 module switches) | `combat/pcaao.js`, `combat/pcaaoMeanerMonsters.js`, `systems/modSettings.js` | 2026-10-31, `1b97b3a8f` |
| `unleveledLoot` | Unleveled Loot 1.1.2 | Ralzar | MIT ("Copyright (C) 2020 Ralzar"; "License: MIT License (http://www.opensource.org/licenses/mit-license.php)") | manifest, settings (10 material switches) | `systems/unleveledLoot.js`, `systems/modSettings.js` | 2026-10-31, `1b97b3a8f` |
| `meanerMonsters` | Meaner Monsters 1.5.2 | Ralzar ("Author: Hazelnut & Ralzar") | MIT ("Copyright (C) 2020 Ralzar"; "License: MIT License (http://www.opensource.org/licenses/mit-license.php)") | manifest, 46 sprite-scale XML files | `characters/meanerMonsters.js`, `world/billboardXml.js`, `systems/modSettings.js` | 2026-10-31, `1b97b3a8f` |
| `seasons-iliac-bay` | Seasons of the Iliac Bay 1.1 | RosyTheRascal | granted to Mac 2026-09-05 - **RECORD OPEN** | the manifest alone (the player's own `.dfmod` is read at runtime, and still is) | `systems/seasonsIliacBay.js`, `systems/seasonsIliacBayAssets.js`, `systems/modSettings.js` | 2026-10-31, `1b97b3a8f` |
| `world-tooltips` | World Tooltips 1.1 | jefetienne | MIT ("Copyright (c) 2009-2018 jefetienne"; the full notice is in `LICENSE`) | manifest, settings, the mod's C# source, its LICENSE | `systems/worldTooltips.js`, `systems/worldHover.js`, `systems/modSettings.js` | 2026-10-31, `1b97b3a8f` |
| `readied-spellcasting-hands` | Readied Spellcasting Hands 1.3 | jefetienne | MIT ("Copyright (c) 2009-2018 jefetienne"; the full notice is in `LICENSE`) | manifest, the mod's two C# files, its LICENSE | `combat/fpsSpellCasting.js` (`readiedHandsFrame`), `combat/weapon/weaponRig.js`, `systems/modSettings.js` | 2026-10-31, `1b97b3a8f` |
| `weapon-widget` | Weapon Widget 1.6 | RedRoryOTheGlen | granted (Mac handed the zip over 2026-09-14) - **RECORD OPEN** | manifest, settings (41 keys) | `combat/weapon/weaponWidget.js`, `combat/weapon/weaponWidgetMotion.js`, `combat/weapon/weaponWidgetAssets.js`, `combat/weapon/weaponRig.js`, `systems/modSettings.js` | 2026-10-31, `1b97b3a8f` |
| `oblivion-remaster-leveling` | OblivionRemasterLikeLeveling 0.5.3 (OpenMW Lua, Nexus Morrowind 56569) | not named in any shipped file | the archive states no licence; granted (Mac handed the archive over 2026-09-17) - **RECORD OPEN** | the ten shipped files: five Lua scripts (1,314 lines), the `.omwaddon` (one GMST), the manifest, two l10n files, the author's README | `systems/oblivionLeveling.js`, `systems/modSettings.js` | 2026-10-31, `1b97b3a8f` |
| `physical-items` | Physical Items 0.1.29 | demifiend000 | granted (Mac handed the zip over 2026-10-07: "permission has been granted") - **RECORD OPEN** | manifest, settings (63 keys), the assembly and its IL dump | `systems/physicalItems.js`, `scenes/physicalItemsLayer.js`, `systems/modSettings.js` | 2026-10-31, `1b97b3a8f` |
| `kings-gambit` | The King's Gambit 1 | the bundle names no author | granted (the owner, 2026-10-13: "We also have permission") - **RECORD OPEN** | manifest, the assembly and its IL dump | `net/kingsGambit.js`, `systems/gambit/gambitPatrons.js` | 2026-10-31, `1b97b3a8f` |
| `heat-haze` | Heat Haze 1.0.1 | demifiend000 | granted (Mac handed the four archives over 2026-10-08: "We have permission to use and implement everything into the codebase") - **RECORD OPEN** | manifest, settings, the assembly, its IL dump, its shader read back as GLSL | `systems/heatHaze.js`, `render/heatHaze.js`, `systems/modSettings.js` | 2026-10-31, `1b97b3a8f` |
| `ocean-holes` | There's a Hole in the Bottom of the Ocean 1.1.0 | jet082 | granted (Mac handed the archive over 2026-09-25) - **RECORD OPEN** | manifest, settings (7 sliders), the assembly | `world/oceanHoles.js`, `scenes/oceanHolesHost.js`, `scenes/oceanHolesAbyss.js`, `systems/modSettings.js` | 2026-10-31, `1b97b3a8f` |
| `ambient-text` | Ambient Text 1.8 | Regnier | the bundle states no licence; granted (Mac handed the archive over 2026-09-15: "I now want to implement this as our next mod. 1:1.") - **RECORD OPEN** | manifest, settings (4 sliders), the author's 918-line text table | `systems/ambientText.js`, `systems/ambientTextLines.json` (DFO's own 918 lines, OWN-WORK2), `systems/modSettings.js` | 2026-10-31, `c2fbbbbfa` |
| `mudex` | MUDEX 1.0.1 (`Ralzar81/MUDEX` @ `6b66655`) | Ralzar | approved (Mac, 2026-10-20: "Approve MUDEX"; the repository states no licence) - **RECORD OPEN** | manifest, two tables (35 monster lines, 89 encounter tables) | `systems/enemyExpansion/dexMeaner.js` (OWN-WORK2: our own rules and courts, not MUDEX's), `systems/enemyExpansion/dexSwitches.js`, `net/foeBounds.js` | 2026-10-31, `c2fbbbbfa` |
| `immersive-travel` | Immersive Travel 1.5 | kkgobkk | granted (the owner handed the zip over 2026-10-04: "let this be the next mod we integrate 1:1") - **RECORD OPEN** | manifest, settings (22 keys), the assembly and its IL dump, the author's edit of the four city-gate blocks | `systems/immersiveTravel.js`, `systems/immersiveTravelTables.js`, `world/immersiveTravelGates.js` (OWN-WORK2: our own carriage stand; no gate block is edited), `systems/modSettings.js` | 2026-10-31, `c2fbbbbfa` |
| `roads-hazelnut` | Basic Roads 1.3.1 (`ajrb/dfunity-mods`, `BasicRoads/`) | Hazelnut | code MIT ("Copyright (C) 2020 Hazelnut", in `LICENSE`); the data no licence text, granted to Mac 2026-09-02 - **RECORD OPEN** | four 500,000-byte path masks (roads, tracks, rivers, streams) | `world/roadsProducer.js`, `world/road/riverNetwork.js`, `world/road/roadNetwork.js` (OWN-WORK2: our own Bay network, the provinces' rule), `world/road/roadPainter.js` (his MIT painter, ported) | 2026-10-31, `c2fbbbbfa` |

The MIT rows keep their notice because our JS restates their code closely: `unleveledLoot.js` method by method,
`meanerMonsters.js` the mod's 24-row table value for value, `worldTooltips.js` the mod's tables word for word.
`LICENSE` carries each notice in full, and the About screen the copyright lines.

## How a directory is retired

OWN-WORK1 set the steps. A later wave follows them once our own replacement is in place.

1. Write the directory's facts into the table above: the mod, version, author, licence or permission, what the tree
   carried, our code that is now the record, and the commit whose tree still holds the files.
2. `git rm` the directory and its registry row (`Mod-Registry.md`).
3. A test that compared our values with a vendored file keeps its pin. It holds the values as a literal table, so a
   changed default still fails it. An assertion about the vendored file's own text goes.
4. A comment that cited a path in the directory cites the upstream release by name, with no tree path.
5. The mod's own page gets a dated OWN-WORK paragraph. Its older text is history and stays.
6. The About screen keeps the mod's credit while our code follows its design (`retired` in place of `vendor`, in
   `ui/credits.js`). The credit ends when our own design replaces it, and that is its own decision.

`test/systems/hard4_registry.test.js` lets a player's switch name a retired key, and `test/systems/credits.test.js`
holds each retired credit to a row in the table above.
