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
- **GrimoireUI stays** (the owner, 2026-10-31: "Grimoire ui can stay"): `grimoire-ui`, its pictures and fonts as
  the pack ships them, under its author's permission.
- **DFO's and Mac's own work**: `project-legacy`, `raum-book`, `pixelify-glyphs` and `layered-armor` (the owner,
  2026-10-31: "Layered Gear is ours", its cloak layer included, though it was drawn from the class skins' sheets).
- **Daggerfall Unity's MIT data**: `dfu-books`, `dfu-icons`, `dfu-cursor`, `dfu-quests`, `dfu-settings` and
  `dfu-text`. DFU is the reference (Port-Doctrine's Scope). NO-BETHESDA found Bethesda's own words inside two of
  them, below.
- **Licensed pieces**: `silkscreen-five` (one glyph, SIL OFL 1.1), whose licence travels with it. `vorbis-fsb-setups`
  went with Come Sail Away's clips (OWN-WORK4).

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
| Eye of the Beholder | 2,869 sprites (TEXTURE.096, .264, .269, .475-.495) | 0 (OWN-WORK4) | `src/player/eyeOfTheBeholder/eotbDerived.json` |
| Handheld Torches | 20 candle frames (TEXTURE.210 records 3 and 4) | 0 (OWN-WORK4) | `src/systems/handheldTorchesDerived.json` |
| Climates & Calories | 3 (a spoiled face, the tent's canvas and pole) | 0 (OWN-WORK4) | `src/systems/survival/derivedIcons.json` |
| Roleplay & Realism | 1 keeper sprite (197_4-0) | 0 (OWN-WORK4) | `src/systems/roleplayRealism/rrDerivedArt.json` |
| Roleplay & Realism: Items | 0 (OWN-WORK4: all 280 ours) | 0 | none |

**OWN-WORK4 (2026-10-31, the owner: "no latching onto other mod authors").** A spec's edits are the author's own pixels laid over Daggerfall's record, so a spec with edits was not ours. Each one is now our own picture: RRI's 50 (31,833 pixels), Diverse Weapons' 12 daggers, Roleplay & Realism's 18, two candle frames and one spoiled face. A spec with no edits is Daggerfall's record alone, and it stays.

A player without ARENA2 stored sees these pictures as a failed load, as any missing file. A texture-door entry is
built once a world pipeline is up.

The scan after NO-BETHESDA2 read 45,248 tracked files. Outside the exceptions it found only Diverse Weapons' magic
daggers, the rotten cooked fish, and DFU's quest and TEXT.RSC text.

### NO-BETHESDA3: the daggers and the fish (the owner: "Rebuild DW's 7 daggers", "Also rebuild the rotten fish ourself")

Twelve Diverse Weapons sprites are 60% or more Daggerfall's own hand (WEAPON02.CIF, 62.7% to 84.5%), and the scan's
seven are among them. They were rebuilt like the rest, the author's blades kept as edits; 12,612 stayed as files. OWN-WORK4 took all of
them out: every Diverse Weapons frame is now our own rule over the player's classic CIF frame. The rotten cooked fish was the author's re-shade of TEXTURE.211 record 10: it is
gone, and in its place is our own rot (`systems/survival/rotPicture.js`), drawn at runtime over the player's own
cooked fish.

### OWN-AUDIT: wave 3 against the packs it retired (2026-11-01, the owner: "better than the removed mods in every way")

Each retired pack was measured against our replacement: every picture, sound, model and setting it supplied. Every
one has ours at runtime. Where ours was worse it was fixed: the sand, snow and sky, the war axe, dagger and sheaths,
the shield faces, the shop keepers (composed from the player's own townspeople), the class skins' robes and three
bare chests, the horse's front view, the surf, and every sound's level. Long sound beds are layered loops that come
round after hours. Every setting that did nothing either works now or is retired. A copy of Eye of the Beholder's
per-sprite offsets was found and replaced by offsets our code measures. The four ARENA2 town pins wave 2 left on
Beautiful Cities' blocks were re-aimed (`03-World/Town-Shapes.md`). Each feature's page holds its dated OWN-AUDIT
record.

### Open: the owner's call

- **Homes made in the town packs' layouts (OWN-WORK3).** A house, room, quest site or anchor a save stamped with
  Beautiful Villages' or Beautiful Cities' layout now sleeps (`systems/layoutPins.js`). Online, `homes.layout` still
  names the packs: those homes sleep and their towns refuse new claims until each is moved to a classic house of the
  same town, as ARENA4b moved the arena's. This must be settled before the branch reaches players.
- **The packs' code.** The art, models and sound are ours. The behaviour code of every row in "Retired from
  vendor/" whose code is not MIT is still a port of the author's, on Mac's word of permission: Snowfall's
  (`systems/snowfall.js`, `snowfallRuntime.js`, pinned to the author's C# by nine hash traces), Windfall's, Horse
  Cart and Cargo's, Come Sail Away's, Eye of the Beholder's and Handheld Torches' among them. Rewriting each in our
  own design is a wave of its own.
- **Features rows name the authors** ("Foraging by Harbinger451"), by Mac's FT9 rule (2026-09-08), sixteen of them
  for packs now retired.
- **Past the Bay, 20 of 1,221 yards** stand off the cells the code of `2036a509e` gave them, on Daggerfall's own
  blocks (`03-World/Town-Shapes.md` section 16).
- **Words still the authors' outside the retired files.** About 100 dish and drink names in
  `systems/survival/tavernMenu.js` and the meal and camp lines (`SURVIVAL_USE_TEXT`, `CAMP_TEXT`) are Climates &
  Calories'; several look like another game's recipe names. Foraging's and Roleplay & Realism's quests keep the
  authors' QBN logic byte for byte, as DFU's quests keep DFU's.

- **Bethesda's words in Daggerfall Unity's MIT data.** `vendor/dfu-quests` carries DFU's 265 quest scripts, whose
  messages are Daggerfall's quest text (eight runs of 68 to 77 bytes match the QRC files byte for byte). Its
  `dfu-text/Internal_RSC.csv` is TEXT.RSC's strings (954 bytes matched, runs up to 161). The owner chose our own
  words over reading ARENA2: "We plan on moving away from arena so whatever works for future proofing". OWN-WORDS1
  and OWN-WORDS2 rewrote all 264 quests with messages, and the build no longer bundles DFU's quest text
  (`06-Systems/Own-Words.md`). Internal_RSC's 1,448 rows remain, counted by `tools/bethesdaWordsBaseline.json`,
  which only goes down.
- **The rest of Diverse Weapons' hands.** Closed by OWN-WORK4: none of the mod's sprites is carried.
- **The exceptions themselves.** OWN-WORK4 retired Vanilla Enhanced, Sands of the Alik'r and Snowfall: our own rules
  build their looks from the player's records. Layered Gearing and Enemy Expansion's repaints stay (ours, and Kamer and
  Kab's).
- **What the scan cannot see.** Audio beyond raw 8-bit runs (DAGGER.SND, MIDI.BSA). Morrowind's data, which is not
  freeware and not here (OWN-WORK4 took out Weapon Sheathing's meshes and its copy of Morrowind's skeleton). Two PNGs it cannot decode, greyscale skin maps
  of ours (`public/skin/`; OWN-WORK4 took out the third, a 4-bit Vanilla Enhanced tile).

## The inventory

Forty directories under `vendor/` held an outside author's work on 2026-10-31. OWN-WORK1 retired twelve of them,
OWN-WORK2 four, OWN-WORK3 two and OWN-WORK4 twenty-one more (the next section). The one left is below, sorted by what
replacing them needs. "Runtime" means the game loads the files, so a replacement has to exist before the directory can
go. The registry (`Mod-Registry.md`) keeps each one's
provenance until it is retired.

| vendor | author | what the tree carries | runtime | kind | wave |
|---|---|---|---|---|---|
| `grimoire-ui` | LordSquacquerone | 93 screens, 38 buttons and 2 fonts (23 MB under `public/art/`) | yes | art | stays (the owner) |

Wave 2 replaced data, tables and words: our own text, our own tables and our own world edits (OWN-WORK2 and
OWN-WORK3, 2026-10-31). A folder that held art too was cut down to its art, listed by a file of ours, until wave 3.
Wave 3 (OWN-WORK4, 2026-10-31) replaced the art and sound of twenty-one packs, the largest wave. The four that were
Bethesda-derived served both of the arc's goals: our own art in their place also took Bethesda's silhouettes out of
the tree.

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
| `beautiful-villages` | Beautiful Villages of Daggerfall 1.4.2 | carademono | granted (Mac handed the archive over 2026-10-01: "We have permission") - **RECORD OPEN** | manifest, one world-data pack (7,317 locations, 209 blocks: the author's edit of MAPS.BSA and BLOCKS.BSA) | `world/townDress.js`, `scenes/townDressHost.js` (OWN-WORK3: every town dressed by our own rules; no town laid out again), `world/townStandIns.js`, `systems/layoutPins.js` | 2026-10-31, `8d110d8f7`; credit ended |
| `beautiful-cities` | Beautiful Cities of Daggerfall 0.5.0 | carademono | granted (Mac handed the archive over 2026-10-01: "We have permission") - **RECORD OPEN** | manifest, one world-data pack (410 cities, 611 blocks: the author's edit of MAPS.BSA and BLOCKS.BSA) | `world/townDress.js`, `scenes/townDressHost.js`, `world/townStandIns.js`, `systems/layoutPins.js` | 2026-10-31, `8d110d8f7`; credit ended |
| `climates-calories` | Climates & Calories 1.7.1 | Ralzar | "**Permission: the author's, relayed by Mac (2026-09-17) - an overhaul, not a 1:1 port, with the mod's own item art carried.**" | 13 item icons, `derived.json` (4 specs), README | `survival/itemIcons.js`, `survival/survivalArt.js`, `survival/rotPicture.js`, `survival/derivedIcons.json`, `art/ownPainter.js` | 2026-10-31, `cc44705af` |
| `foraging` | Foraging 1.7 | Harbinger451 | granted (Mac, 2026-09-28: "Yes, permission") - **RECORD OPEN** | 7 textures (11600-11606), the listing, README | `foraging/foragingArt.js`, `foraging/foragingInstall.js` | 2026-10-31, `cc44705af` |
| `travel-options` | Travel Options 1.11 | Hazelnut | code MIT ("Copyright (C) 2020 Hazelnut"; `PlayerAutoPilot.cs` "Copyright (C) 2019 Jedidia"); the textures carried no licence text - **RECORD OPEN** | 3 interface textures, the listing, README | `ui/travel/travelArt.js`, `ui/travel/travelControlUI.js`, `ui/travel/travelMapWindow.js` | 2026-10-31, `cc44705af` |
| `roleplay-realism` | Roleplay & Realism 1.8 | Hazelnut | scripts MIT ("Copyright (C) 2020 Hazelnut", "Copyright (C) 2021 Hazelnut"); the pictures carried no licence line - **RECORD OPEN** | 5 keeper sprites, `derived-art.json` (19 specs), the listing, README | `roleplayRealism/rrKeepers.js` (each keeper composed from the player's own townspeople), `roleplayRealism/rrKeeperArt.js`, `roleplayRealism/rrVariants.js`, `roleplayRealism/rrDerivedArt.json` | 2026-10-31, `cc44705af` |
| `roleplay-realism-items` | Roleplay & Realism: Items 1.3 | Hazelnut and Ralzar | code MIT (every script's header); the sprites carried no licence text - granted (Mac handed the zip over 2026-09-23) - **RECORD OPEN** | 230 sprites, `derived-art.json` (50 specs), the listing of 280 names, README, `tools/rriExtract.mjs` (DELETED) | `roleplayRealismItems/rriArt.js`, `roleplayRealismItems/rriInstall.js`, `roleplayRealismItems/rriIndex.js` | 2026-10-31, `cc44705af` |
| `iliac-puddle-no-more` | Iliac Puddle No More 1.2.2 | jet082 | "**Permission: granted (Mac handed the archive over 2026-09-25) - the archive carries no licence text and no readme.**" - **RECORD OPEN** | 7 fish pictures, the listing, README | `deepWater/fishArt.js`, `deepWater/deepWatersFishItems.js`, `scenes/deepWater/deepWatersFish.js` | 2026-10-31, `cc44705af` |
| `handheld-torches` | Handheld Torches 1.4.1 | RedRoryOTheGlen | granted (Mac: "Next mod to integrate 1:1 is this.") - **RECORD OPEN** | manifest, settings (52 keys), 17 textures, `derived.json` (22 specs), README | `systems/handheldTorchesArt.js`, `systems/handheldTorches.js`, `scenes/droppedTorches.js`, `systems/handheldTorchesDerived.json` | 2026-10-31, `cc44705af` |
| `windfall` | Windfall 1.0.0 | demifiend000 | granted (Mac, 2026-10-08: "We have permission to use and implement everything into the codebase") - **RECORD OPEN**; the bundle states no licence | manifest, settings (56 keys), `Windfall.dll` and its IL, 2 shaders, 3 pictures, 27 clips, README | `systems/windfall/windfallSynth.js`, `systems/windfall/windfallPictures.js`, `render/windfallSway.js`, `systems/windfallEffects.js`, `scenes/windfallHost.js` | 2026-10-31, `cc44705af` |
| `better-ambience` | Better Ambience 0.1.4 | Joshua Steinhauer (joshcamas) | MIT ("Copyright (c) 2020 Josh Steinhauer"; the full notice is in `LICENSE`) | manifest, settings (20 keys), 16 C# sources, the LICENSE, 29 WAV clips, README | `systems/betterAmbience.js`, `systems/reverbPresets.js`, `audio/synth/` | 2026-10-31, `cc44705af` |
| `immersive-footsteps` | Immersive Footsteps 1.01 | Kirk.O | MIT ("Copyright (C) 2024 Kirk.O"; the full notice is in `LICENSE`) - **RECORD OPEN** | manifest, settings (10 keys), 2 C# sources, 210 MP3 clips, README | `systems/immersiveFootsteps.js`, `audio/synth/` | 2026-10-31, `cc44705af` |
| `dynamic-skies` | Dynamic Skies 2.3.4 | BadLuckBurt and carademono | "**Permission: granted by the authors to Mac (Lattymoy), 2026-09-04.**" - **RECORD OPEN** | manifest, settings (5 keys), 7 sky and 5 fog presets, the light curve, 19 textures, the shader and two include files, README | `systems/dynamicSkies/dynamicSkies.js`, `systems/dynamicSkies/dynamicSkiesRuntime.js`, `systems/dynamicSkies/dynamicSkiesAssets.js`, `render/dynamicSkiesRenderer.js`, `render/dynamicSkiesBridge.js` | 2026-10-31, `cc44705af` |
| `diverse-weapons` | Diverse Weapons 1.7.3 | RealAKP (the script: "Author: RealAKP & Kirk.O") | the script MIT ("Copyright (C) 2022 Kirk.O"); the sprites carried no licence line - granted (Mac handed the zip over 2026-09-23) - **RECORD OPEN** | the script, manifest, the widget preset, readmes, `derived-art.json` (12 specs), 12,612 sprites under `public/art/diverse-weapons/`, two tools | `combat/diverseWeapons/diverseWeaponsArt.js`, `combat/diverseWeapons/diverseWeaponsIndex.js`, `combat/diverseWeapons/diverseWeaponsAssets.js`, `combat/diverseWeapons/diverseWeaponsIcons.js` | 2026-10-31, `cc44705af` |
| `weapon-sheathing` | Weapon Sheathing 1.6 (OpenMW, Nexus Morrowind 46069) | Greatness7; art by akortunov, Greatness7, Heinrich, London Rook, Lord Berandas, Melchior Dahrk, MementoMoritius, Petethegoat, PikachunoTM, Remiros | "Everything included in this mod is free to use for your own Morrowind projects, so long as you give credit to the original authors and do not charge a monetary fee." | 71 scabbard NIFs, 3 skeleton add-ons (one a copy of retail Morrowind's skeleton), the mod's readme, README | `systems/ownSheathing.js`, `systems/weaponSheathing.js`, `systems/weaponSheathingAssets.js`, `formats/morrowind/mwNifWrite.js`, `tools/ownBiped.mjs` | 2026-10-31, `cc44705af` |
| `shield-widget` | Shield Widget 1.6 (Nexus 733) | RedRoryOTheGlen; frame animation by WilhelmBlack | granted (Mac handed the zip over 2026-09-19) - **RECORD OPEN** | manifest, settings, presets, 600 shield sprites, README | `combat/shieldFaces.js`, `combat/shieldWidgetAssets.js`, `combat/shieldWidget.js` | 2026-10-31, `cc44705af` |
| `vanilla-enhanced` | Vanilla Enhanced 3.4.7 (Base, Masked Roads, Snowless Swamps and Jungles) | carademono (Masked Roads: carademono and Kokey) | granted (Mac, 2026-10-05: "Approved and yes"); the repository states no licence - **RECORD OPEN** | 3 manifests, 3 listings, the door index, README; 1,436 repainted textures under `public/art/vanilla-enhanced/`; its vendoring tool | `systems/ownTextures/ownTextureRules.js` (1,238 of the Base's 1,246 names; the 8 left are rock textures for meshes the port never draws), `systems/ownTextures/ownTexturePacks.js`, `systems/vanillaEnhanced/vanillaEnhancedPack.js`, `systems/vanillaEnhanced/vanillaEnhancedDecodeWorker.js` | 2026-10-31, `cc44705af` |
| `sands-of-the-alikr` | Sands of the Alik'r 2 (Nexus 1390) | unknown (the archive names none) | granted (Mac, 2026-10-08: "We have permission to use and implement everything into the codebase") - **RECORD OPEN** | the listing, the index, README; 47 repainted TEXTURE.002 records under `public/art/sands-of-the-alikr/` | `systems/ownTextures/ownTextureRules.js` (`desert`), `systems/vanillaEnhanced/vanillaEnhancedPack.js` | 2026-10-31, `cc44705af` |
| `snowfall` | Snowfall 1.0.5 (Nexus 1401) | demifiend000 | granted (Mac, 2026-10-08, as above) - **RECORD OPEN** | manifest, settings, `DynamicSnow.dll` and its IL, the shader, Basic Roads' MIT notice, the listing, the index; 168 repainted winter records, the snow albedo and 3 masks under `public/art/snowfall/` | `systems/snowfall.js`, `systems/snowfallRuntime.js`, `render/snowfallGlsl.js`, `render/snowfallSurface.js`, `scenes/snowfallHost.js`, `systems/ownTextures/ownTextureRules.js` (`snow`) | 2026-10-31, `cc44705af` |
| `class-skins` | Daggerfall class skins (Mac's `ExistingClasses.rar`, no version) | not named for the pack (one folder: "KAMER - Bounty Hunter") | granted (Mac handed the archive over 2026-09-25) - **RECORD OPEN**; carried under Port-Doctrine's fourth exception | 1,683 repainted class sprites in 20 sheets, `skins.json`, the listing, README, `tools/classSkinsListing.mjs` (DELETED) | `player/classSkins.js`, `player/classSkinArt.js`, `player/eyeOfTheBeholder/eotbSprite.js` | 2026-10-31, `cc44705af` |
| `eye-of-the-beholder` | Eye Of The Beholder 2.1 | RedRoryOTheGlen | granted (Mac handed the archive over 2026-09-15) - **RECORD OPEN** | manifest, settings, presets, states, `spriteInfo.json`, `derived.json` (2,869 specs), 166 death sprites, the DLL and its IL, README, `tools/eotbIl.mjs` (DELETED) | `player/eyeOfTheBeholder/eotbSprite.js`, `player/eyeOfTheBeholder/eotbDeath.js`, `player/eyeOfTheBeholder/eotbDerived.json`, `player/eyeOfTheBeholder/eotbSpriteInfo.json`, `player/eyeOfTheBeholder/eotbBillboard.js` | 2026-10-31, `cc44705af` |
| `horse-cart-and-cargo` | Horse Cart and Cargo 1.0.0-rc12 (Nexus 1374) | demifiend000 | granted (Mac handed the bundle over 2026-09-23) - **RECORD OPEN** | manifest, settings, the text table, two DLLs and their IL, 45 horse pictures, README, `tools/hccAssets.mjs` (DELETED) | `systems/horse/horseArt.js`, `systems/horse/horseCart.js`, `systems/horse/horseCartLaw.js`, `scenes/horseCartPool.js` | 2026-10-31, `cc44705af` |
| `come-sail-away` | Come Sail Away 2.1 (Nexus 1131) | RedRoryOTheGlen | "**Permission: granted (Mac handed the archive over 2026-09-26) - the archive carries no licence text and no readme.**" - **RECORD OPEN** | manifest, settings, item templates, the DLL, 12 boats as prefabs and meshes, 27 pictures, `derived.json` (32 specs), 5 clips, README, the extractor and three of its libraries | `world/ships/ownBoats/`, `systems/comeSailAway/csaPictures.js`, `systems/comeSailAway/csaSynth/`, `systems/comeSailAway/comeSailAwayModels.js`, `systems/comeSailAway/comeSailAwayItems.js` | 2026-10-31, `cc44705af` |
| `vorbis-fsb-setups` | two Vorbis setup headers for FSB5 (vgmstream's table, ISC-style; libvorbis's encoder output, BSD-3-Clause) | vgmstream and Xiph.org | the two licences, carried with the files | the two headers and their licences | none: only Come Sail Away's clips needed them, and they are ours now | 2026-10-31, `cc44705af`; credit ended |

The MIT rows keep their notice because our JS restates their code closely: `unleveledLoot.js` method by method,
`meanerMonsters.js` the mod's 24-row table value for value, `worldTooltips.js` the mod's tables word for word,
`immersiveFootsteps.js` and `betterAmbience.js` their scripts' laws. The art and sound they carried is ours now.
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
